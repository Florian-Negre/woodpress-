use serde::{Deserialize, Serialize};
use std::net::TcpListener;
use std::path::Path;
use super::docker::new_command;

#[derive(Debug, Serialize, Deserialize)]
pub struct IdeInfo {
    pub name: String,
    pub command: String,
    pub detected: bool,
}

/// Retourne un port TCP libre dans la plage donnée
#[tauri::command]
pub async fn get_free_port(start: u16, end: u16) -> Result<u16, String> {
    for port in start..=end {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }
    Err(format!("Aucun port libre trouvé entre {} et {}", start, end))
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

    let ides = candidates
        .into_iter()
        .map(|(name, cmd, paths)| {
            let mut detected = new_command("where")
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
        new_command("cmd")
            .args(["/C", &ide_command, &path])
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
        new_command("cmd")
            .args(["/C", "start", "", &url])
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
