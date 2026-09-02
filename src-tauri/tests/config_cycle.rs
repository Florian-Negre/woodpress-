// Cycle complet de la configuration sur un dossier temporaire :
// ecriture, relecture, remplacement atomique, et tolerance aux fichiers abimes.
use std::fs;
use woodpress_lib::commands::config::{
    config_file, load_app_config, save_app_config, AppConfig, WorkspaceEntry,
};

// Les trois tests partagent la variable d'environnement du processus : sans verrou,
// ils se voleraient mutuellement le dossier de configuration.
static VERROU: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn dossier_temporaire(nom: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("woodpress_cfg_{}", nom));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    std::env::set_var("WOODPRESS_CONFIG_DIR", &dir);
    dir
}

#[tokio::test]
async fn ecriture_puis_relecture_conserve_les_reglages() {
    let _garde = VERROU.lock().unwrap_or_else(|e| e.into_inner());
    let dir = dossier_temporaire("cycle");

    let premier = load_app_config().await.expect("chargement initial");
    assert!(!premier.existed, "aucun fichier au depart");
    assert!(premier.config.workspaces.is_empty());

    let mut config = AppConfig::default();
    config.workspaces.push(WorkspaceEntry {
        name: "Sites clients".into(),
        path: "D:\\Prod".into(),
        color: "#8BC34A".into(),
    });
    config.theme = "light".into();
    config.ide = "phpstorm".into();
    config.preferences.auto_docker = false;

    save_app_config(config).await.expect("enregistrement");
    assert!(config_file().unwrap().exists(), "le fichier doit exister");

    let relu = load_app_config().await.expect("relecture");
    assert!(relu.existed);
    assert_eq!(relu.config.workspaces.len(), 1);
    assert_eq!(relu.config.workspaces[0].path, "D:\\Prod");
    assert_eq!(relu.config.theme, "light");
    assert_eq!(relu.config.ide, "phpstorm");
    assert!(!relu.config.preferences.auto_docker);

    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn aucun_fichier_temporaire_ne_subsiste() {
    let _garde = VERROU.lock().unwrap_or_else(|e| e.into_inner());
    let dir = dossier_temporaire("atomique");

    save_app_config(AppConfig::default()).await.expect("enregistrement");

    let restes: Vec<_> = fs::read_dir(&dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| n.ends_with(".tmp"))
        .collect();

    assert!(restes.is_empty(), "fichiers temporaires laisses : {:?}", restes);

    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn un_fichier_abime_est_mis_de_cote_et_non_ecrase() {
    let _garde = VERROU.lock().unwrap_or_else(|e| e.into_inner());
    let dir = dossier_temporaire("abime");
    fs::write(config_file().unwrap(), "{ ceci n'est pas du json").unwrap();

    let resultat = load_app_config().await;
    assert!(resultat.is_err(), "un fichier illisible doit etre signale");

    let sauvegarde = dir.join("config.json.corrompu");
    assert!(sauvegarde.exists(), "l'original doit etre conserve pour recuperation");

    let _ = fs::remove_dir_all(&dir);
}
