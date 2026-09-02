// Garde-fou : les charges utiles envoyees par le front doivent se desérialiser dans les
// structures attendues par les commandes Tauri.
//
// Tauri convertit camelCase -> snake_case pour les ARGUMENTS d'une commande, mais pas pour
// les champs d'une structure imbriquee : la, c'est serde qui decide. Sans
// #[serde(rename_all = "camelCase")], l'appel est rejete avant d'entrer dans la fonction.
use woodpress_lib::commands::azf::ImportAzfParams;
use woodpress_lib::commands::sites::CreateSiteParams;

#[test]
fn charge_utile_de_NewSiteModal() {
    // Copie conforme de src/components/NewSiteModal.js
    let payload = r#"{
        "name": "mon-nouveau-site",
        "workspacePath": "/tmp/ws",
        "wpVersion": "7.1",
        "phpVersion": "8.4",
        "httpPort": 8085,
        "dbName": "wordpress",
        "dbUser": "wordpress",
        "dbPass": "wordpress",
        "installBridge": true
    }"#;

    let p: CreateSiteParams = serde_json::from_str(payload)
        .expect("create_site : le front et le backend ne s'accordent pas");

    assert_eq!(p.name, "mon-nouveau-site");
    assert_eq!(p.workspace_path, "/tmp/ws");
    assert_eq!(p.http_port, 8085);
    assert!(p.install_bridge);
}

#[test]
fn charge_utile_de_ImportModal() {
    // Copie conforme de src/components/ImportModal.js
    let payload = r#"{
        "archivePath": "/tmp/site.azf",
        "workspacePath": "/tmp/ws",
        "siteName": "site-restaure",
        "httpPort": 8086
    }"#;

    let p: ImportAzfParams = serde_json::from_str(payload)
        .expect("import_azf : le front et le backend ne s'accordent pas");

    assert_eq!(p.site_name, "site-restaure");
    assert_eq!(p.http_port, 8086);
}
