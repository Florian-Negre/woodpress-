use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Espace de travail déclaré par l'utilisateur.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub name: String,
    pub path: String,
    #[serde(default = "default_color")]
    pub color: String,
}

fn default_color() -> String {
    "#38BDF8".to_string()
}

/// Préférences d'affichage et de comportement.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub auto_docker: bool,
    pub auto_check_updates: bool,
    pub security_alerts: bool,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            auto_docker: true,
            auto_check_updates: true,
            security_alerts: true,
        }
    }
}

/// Configuration complète de l'application, telle qu'elle est écrite sur le disque.
///
/// Elle remplace le stockage du navigateur embarqué : celui-ci disparaît si les données
/// du composant web sont réinitialisées, et ne suit pas l'utilisateur d'un poste à l'autre.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct AppConfig {
    /// Version du format, pour permettre des migrations ultérieures.
    pub version: u32,
    pub workspaces: Vec<WorkspaceEntry>,
    pub theme: String,
    /// « preferredIde » est le nom utilise par la version .NET : l'alias evite
    /// de perdre le reglage lors d'une reprise de configuration.
    #[serde(alias = "preferredIde")]
    pub ide: String,
    pub layout: String,
    pub preferences: Preferences,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: 1,
            workspaces: Vec::new(),
            theme: "dark".to_string(),
            ide: "code".to_string(),
            layout: "grid".to_string(),
            preferences: Preferences::default(),
        }
    }
}

/// Résultat du chargement : `existed` distingue un premier lancement d'une reprise,
/// ce qui permet au front de récupérer une éventuelle configuration héritée.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedConfig {
    pub config: AppConfig,
    pub existed: bool,
    pub path: String,
}

/// Dossier de configuration de l'utilisateur, selon les conventions du système :
/// `%APPDATA%\WoodPress` sous Windows, `~/.config/WoodPress` sous Linux,
/// `~/Library/Application Support/WoodPress` sous macOS.
pub fn config_dir() -> Result<PathBuf, String> {
    // WOODPRESS_CONFIG_DIR permet de deporter la configuration : utile pour une
    // installation portable (cle USB, profil partage) et pour les tests.
    if let Ok(custom) = std::env::var("WOODPRESS_CONFIG_DIR") {
        if !custom.trim().is_empty() {
            return Ok(PathBuf::from(custom));
        }
    }

    let base = dirs::config_dir()
        .ok_or_else(|| "Dossier de configuration de l'utilisateur introuvable".to_string())?;
    Ok(base.join("WoodPress"))
}

pub fn config_file() -> Result<PathBuf, String> {
    Ok(config_dir()?.join("config.json"))
}

/// Charge la configuration. Un fichier absent ou illisible ne bloque pas le démarrage :
/// l'application repart sur des valeurs par défaut plutôt que de refuser de s'ouvrir.
#[tauri::command]
pub async fn load_app_config() -> Result<LoadedConfig, String> {
    let path = config_file()?;
    let path_str = path.to_string_lossy().to_string();

    if !path.exists() {
        return Ok(LoadedConfig {
            config: AppConfig::default(),
            existed: false,
            path: path_str,
        });
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Lecture de la configuration impossible : {}", e))?;

    match serde_json::from_str::<AppConfig>(&content) {
        Ok(config) => Ok(LoadedConfig {
            config,
            existed: true,
            path: path_str,
        }),
        Err(e) => {
            // Fichier corrompu : on le met de côté au lieu de l'écraser en silence,
            // pour que l'utilisateur puisse récupérer ses espaces de travail à la main.
            let backup = path.with_extension("json.corrompu");
            let _ = fs::rename(&path, &backup);
            Err(format!(
                "Configuration illisible ({}). L'ancien fichier a été conservé sous {}",
                e,
                backup.display()
            ))
        }
    }
}

/// Enregistre la configuration. L'écriture passe par un fichier temporaire renommé
/// ensuite : une coupure en cours d'écriture ne peut pas laisser un fichier tronqué.
#[tauri::command]
pub async fn save_app_config(config: AppConfig) -> Result<String, String> {
    let dir = config_dir()?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Création du dossier de configuration impossible : {}", e))?;

    let path = config_file()?;
    let tmp = path.with_extension("json.tmp");

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Sérialisation de la configuration impossible : {}", e))?;

    fs::write(&tmp, json).map_err(|e| format!("Écriture de la configuration impossible : {}", e))?;

    // rename écrase la cible de façon atomique sur les systèmes de fichiers courants
    fs::rename(&tmp, &path)
        .map_err(|e| format!("Remplacement de la configuration impossible : {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

/// Chemin du fichier, affiché dans les réglages pour que l'utilisateur sache où il est.
#[tauri::command]
pub async fn get_config_path() -> Result<String, String> {
    Ok(config_file()?.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn la_configuration_par_defaut_est_vide_de_tout_chemin() {
        let c = AppConfig::default();
        assert!(c.workspaces.is_empty(), "aucun dossier ne doit être supposé");
        assert_eq!(c.theme, "dark");
        assert_eq!(c.ide, "code");
        assert!(c.preferences.auto_docker);
    }

    #[test]
    fn un_fichier_partiel_est_complete_par_les_valeurs_par_defaut() {
        let json = r#"{"workspaces":[{"name":"Projets","path":"/srv/www"}]}"#;
        let c: AppConfig = serde_json::from_str(json).expect("config partielle lisible");

        assert_eq!(c.workspaces.len(), 1);
        assert_eq!(c.workspaces[0].path, "/srv/www");
        assert_eq!(c.workspaces[0].color, "#38BDF8");
        assert_eq!(c.theme, "dark");
        assert_eq!(c.version, 1);
    }

    #[test]
    fn le_format_ecrit_est_relu_a_lidentique() {
        let mut c = AppConfig::default();
        c.workspaces.push(WorkspaceEntry {
            name: "Clients".into(),
            path: "D:\\Sites".into(),
            color: "#F59E0B".into(),
        });
        c.theme = "light".into();
        c.preferences.security_alerts = false;

        let json = serde_json::to_string(&c).unwrap();
        let relu: AppConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(relu.workspaces[0].path, "D:\\Sites");
        assert_eq!(relu.theme, "light");
        assert!(!relu.preferences.security_alerts);
    }

    #[test]
    fn un_fichier_laisse_par_la_version_precedente_est_repris() {
        // Format ecrit par l'application .NET : champs supplementaires, noms differents
        let json = r#"{
            "workspaces": [
                {"id":"ws_workspace","name":"Workspace Projets","path":"G:\\Workspace","type":"workspace","isDefault":true},
                {"id":"ws_learning","name":"Learnspace WordPress","path":"E:\\E-Dev\\WordPress","type":"learning","isDefault":false}
            ],
            "isConfigured": true,
            "preferredIde": "cursor",
            "customIdePath": "",
            "theme": "dark",
            "autoScanOnStartup": true
        }"#;

        let c: AppConfig = serde_json::from_str(json).expect("ancien format lisible");
        assert_eq!(c.workspaces.len(), 2, "les dossiers de travail doivent etre repris");
        assert_eq!(c.workspaces[0].name, "Workspace Projets");
        assert_eq!(c.ide, "cursor", "le choix d'IDE doit suivre");
        assert_eq!(c.theme, "dark");
    }

    #[test]
    fn le_json_est_ecrit_en_camel_case_pour_le_front() {
        let json = serde_json::to_string(&AppConfig::default()).unwrap();
        assert!(json.contains("\"autoDocker\""), "les cles doivent etre en camelCase");
        assert!(json.contains("\"autoCheckUpdates\""));
        assert!(!json.contains("auto_docker"));
    }
}
