use serde::{Deserialize, Serialize};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Serialize, Deserialize)]
pub struct DockerStatus {
    pub running: bool,
    pub version: Option<String>,
    pub containers_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContainerInfo {
    pub name: String,
    pub status: String,
    pub image: String,
    pub ports: Vec<String>,
}

/// Helper pour créer une commande sans fenêtre de console sous Windows
pub fn new_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Vérifie si Docker Desktop est en cours d'exécution et compte les conteneurs actifs
#[tauri::command]
pub async fn get_docker_status() -> Result<DockerStatus, String> {
    let output = new_command("docker")
        .args(["info", "--format", "{{.ServerVersion}}"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let running = !version.is_empty();

            let count_out = new_command("docker")
                .args(["ps", "-q"])
                .output()
                .unwrap_or_else(|_| std::process::Output {
                    status: std::process::ExitStatus::default(),
                    stdout: vec![],
                    stderr: vec![],
                });

            let containers_count = String::from_utf8_lossy(&count_out.stdout)
                .lines()
                .filter(|l| !l.is_empty())
                .count() as u32;

            Ok(DockerStatus {
                running,
                version: if running { Some(version) } else { None },
                containers_count,
            })
        }
        _ => Ok(DockerStatus {
            running: false,
            version: None,
            containers_count: 0,
        }),
    }
}

/// Démarre Docker Desktop en arrière-plan sans console
#[tauri::command]
pub async fn start_docker() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        new_command("cmd")
            .args(["/C", "start", "", "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"])
            .spawn()
            .map_err(|e| format!("Impossible de démarrer Docker Desktop : {}", e))?;
    }
    Ok(())
}

/// Récupère les conteneurs d'un site spécifique via docker compose ps ou fallback docker ps
#[tauri::command]
pub async fn get_site_containers(project_path: String) -> Result<Vec<ContainerInfo>, String> {
    let output = new_command("docker")
        .args(["compose", "ps", "--format", "json"])
        .current_dir(&project_path)
        .output();

    let mut containers = vec![];

    if let Ok(out) = output {
        let raw = String::from_utf8_lossy(&out.stdout).to_string();
        for line in raw.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('{') && trimmed.ends_with('}') {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) {
                    let name = v["Name"]
                        .as_str()
                        .or_else(|| v["Names"].as_str())
                        .unwrap_or("")
                        .to_string();
                    let status = v["State"]
                        .as_str()
                        .or_else(|| v["Status"].as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let image = v["Image"].as_str().unwrap_or("").to_string();

                    let mut ports = vec![];
                    if let Some(publishers) = v["Publishers"].as_array() {
                        for p in publishers {
                            if let Some(host) = p["PublishedPort"].as_u64() {
                                if host > 0 {
                                    let entry = format!(":{}", host);
                                    if !ports.contains(&entry) {
                                        ports.push(entry);
                                    }
                                }
                            }
                        }
                    }
                    if ports.is_empty() {
                        if let Some(ports_str) = v["Ports"].as_str() {
                            ports.push(ports_str.to_string());
                        }
                    }

                    if !name.is_empty() {
                        containers.push(ContainerInfo {
                            name,
                            status,
                            image,
                            ports,
                        });
                    }
                }
            }
        }
    }

    // Si compose ps n'a rien trouvé, fallback sur docker ps avec filtre sur le nom du dossier
    if containers.is_empty() {
        let folder_name = std::path::Path::new(&project_path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
            .to_lowercase();

        let ps_out = new_command("docker")
            .args(["ps", "-a", "--format", "{{json .}}"])
            .output();

        if let Ok(out) = ps_out {
            let raw = String::from_utf8_lossy(&out.stdout);
            for line in raw.lines() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(line.trim()) {
                    let name = v["Names"].as_str().unwrap_or("").to_string();
                    let lower_name = name.to_lowercase();
                    if lower_name.contains(&folder_name) || (folder_name == "docker" && lower_name.contains("axpc84")) {
                        let status = v["State"].as_str().unwrap_or("unknown").to_string();
                        let image = v["Image"].as_str().unwrap_or("").to_string();
                        let ports = v["Ports"]
                            .as_str()
                            .map(|p| vec![p.to_string()])
                            .unwrap_or_default();

                        containers.push(ContainerInfo {
                            name,
                            status,
                            image,
                            ports,
                        });
                    }
                }
            }
        }
    }

    Ok(containers)
}
