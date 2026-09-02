use serde::{Deserialize, Serialize};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::time::Duration;
use std::path::Path;
use super::docker::new_command;

#[derive(Debug, Serialize, Deserialize)]
pub struct IdeInfo {
    pub name: String,
    pub command: String,
    pub detected: bool,
}

/// Ports deja publies par des conteneurs Docker, y compris a l'arret : leur reprendre
/// un port empecherait le projet correspondant de redemarrer.
pub fn docker_published_ports() -> std::collections::HashSet<u16> {
    let mut taken = std::collections::HashSet::new();

    let output = new_command("docker")
        .args(["ps", "-a", "--format", "{{.Ports}}"])
        .output();

    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout);
        // Exemples : « 0.0.0.0:8081->80/tcp », « :::8086->80/tcp »
        for segment in text.split(&[',', ' '][..]) {
            if let Some((left, _)) = segment.split_once("->") {
                if let Some((_, port)) = left.rsplit_once(':') {
                    if let Ok(p) = port.trim().parse::<u16>() {
                        taken.insert(p);
                    }
                }
            }
        }
    }

    taken
}

/// Teste si un port est reellement disponible.
///
/// Un seul bind sur 127.0.0.1 ne suffit pas : sous Docker Desktop pour Windows, un port
/// publie par un conteneur reste liable en boucle locale alors qu'il repond deja. Trois
/// signaux sont donc croises : reservation sur toutes les interfaces, absence de service
/// a l'ecoute, et absence de publication cote Docker.
pub fn is_port_available(port: u16, docker_taken: &std::collections::HashSet<u16>) -> bool {
    if docker_taken.contains(&port) {
        return false;
    }

    if TcpListener::bind(("0.0.0.0", port)).is_err() {
        return false;
    }

    // Si quelqu'un repond, le port est pris quoi qu'en dise le bind
    match TcpStream::connect_timeout(
        &SocketAddr::from(([127, 0, 0, 1], port)),
        Duration::from_millis(120),
    ) {
        Ok(_) => false,
        Err(_) => true,
    }
}

/// Retourne un port TCP libre dans la plage donnée
#[tauri::command]
pub async fn get_free_port(start: u16, end: u16) -> Result<u16, String> {
    let docker_taken = docker_published_ports();

    for port in start..=end {
        if is_port_available(port, &docker_taken) {
            return Ok(port);
        }
    }
    Err(format!("Aucun port libre trouvé entre {} et {}", start, end))
}

/// Attribue plusieurs ports distincts d'un coup (site, phpMyAdmin, Mailpit...).
pub fn allocate_ports(start: u16, end: u16, count: usize) -> Result<Vec<u16>, String> {
    let docker_taken = docker_published_ports();
    let mut chosen: Vec<u16> = Vec::with_capacity(count);

    for port in start..=end {
        if chosen.len() == count {
            break;
        }
        if chosen.contains(&port) {
            continue;
        }
        if is_port_available(port, &docker_taken) {
            chosen.push(port);
        }
    }

    if chosen.len() < count {
        return Err(format!(
            "Impossible de trouver {} ports libres entre {} et {}",
            count, start, end
        ));
    }

    Ok(chosen)
}

/// Détecte les IDEs installés sur la machine avec vérification du PATH et des dossiers d'installation Windows
#[tauri::command]
pub async fn detect_ides() -> Result<Vec<IdeInfo>, String> {
    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let program_files = std::env::var("ProgramFiles").unwrap_or_default();
    let _program_files_x86 = std::env::var("ProgramFiles(x86)").unwrap_or_default();

    let candidates = vec![
        (
            "VS Code",
            "code",
            vec![
                format!("{}\\Programs\\Microsoft VS Code\\Code.exe", local_app_data),
                format!("{}\\Microsoft VS Code\\Code.exe", program_files),
            ],
        ),
        (
            "Cursor",
            "cursor",
            vec![
                format!("{}\\Programs\\cursor\\Cursor.exe", local_app_data),
                format!("{}\\Programs\\Cursor\\Cursor.exe", local_app_data),
            ],
        ),
        (
            "Windsurf",
            "windsurf",
            vec![
                format!("{}\\Programs\\windsurf\\Windsurf.exe", local_app_data),
                format!("{}\\Programs\\Windsurf\\Windsurf.exe", local_app_data),
            ],
        ),
        (
            "PhpStorm",
            "phpstorm",
            vec![
                format!("{}\\JetBrains\\PhpStorm\\bin\\phpstorm64.exe", program_files),
                format!("{}\\JetBrains\\PhpStorm\\bin\\phpstorm64.exe", local_app_data),
            ],
        ),
        (
            "WebStorm",
            "webstorm",
            vec![
                format!("{}\\JetBrains\\WebStorm\\bin\\webstorm64.exe", program_files),
            ],
        ),
        (
            "Sublime Text",
            "subl",
            vec![
                format!("{}\\Sublime Text\\sublime_text.exe", program_files),
                format!("{}\\Sublime Text 3\\sublime_text.exe", program_files),
            ],
        ),
    ];

    let which_cmd = if cfg!(target_os = "windows") { "where" } else { "which" };
    let ides = candidates
        .into_iter()
        .map(|(name, cmd, paths)| {
            let mut detected = new_command(which_cmd)
                .arg(cmd)
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);

            if !detected {
                for p in paths {
                    if Path::new(&p).exists() {
                        detected = true;
                        break;
                    }
                }
            }

            #[cfg(not(target_os = "windows"))]
            if !detected {
                let linux_candidates = [
                    format!("/usr/bin/{}", cmd),
                    format!("/usr/local/bin/{}", cmd),
                    format!("/snap/bin/{}", cmd),
                ];
                for lp in &linux_candidates {
                    if Path::new(lp).exists() {
                        detected = true;
                        break;
                    }
                }
            }

            IdeInfo {
                name: name.to_string(),
                command: cmd.to_string(),
                detected,
            }
        })
        .collect();

    Ok(ides)
}

/// Ouvre le dossier d'un site dans l'IDE sélectionné
#[tauri::command]
pub async fn open_in_ide(ide_command: String, path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Les guillemets sont indispensables : sans eux, cmd decoupe le chemin a la
        // premiere espace et l'IDE ouvre un dossier inexistant.
        // « start "" » evite que cmd prenne le premier argument pour un titre de fenetre.
        let quoted = format!("start \"\" \"{}\" \"{}\"", ide_command, path);
        new_command("cmd")
            .args(["/C", &quoted])
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir {} : {}", ide_command, e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        new_command(&ide_command)
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir {} : {}", ide_command, e))?;
    }
    Ok(())
}

/// Ouvre une URL dans le navigateur par défaut sans console
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Une URL contenant « & » serait coupee par cmd si elle n'etait pas entre guillemets
        let quoted = format!("start \"\" \"{}\"", url);
        new_command("cmd")
            .args(["/C", &quoted])
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'URL : {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        new_command("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'URL : {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        new_command("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'URL : {}", e))?;
    }
    Ok(())
}
