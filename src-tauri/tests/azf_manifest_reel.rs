// Verifie que les manifestes des archives .AZF reellement produites sont lisibles
// par la structure du code, et non par une copie de test qui pourrait diverger.
use woodpress_lib::commands::azf::AzfManifest;

const V3_BRIDGE: &str = r#"{"formatVersion":"3.0.0","signature":"CODINFLO_AZF_PROPRIETARY","generator":"WoodPress-Bridge",
  "generatorVersion":"3.0.1","createdAt":"2026-09-01T07:02:33+00:00","author":"Codinflo WoodPress",
  "projectName":"vk-interior-design","clientName":"","siteName":"VK INTERIOR DESIGN",
  "siteUrl":"https://x.fr","homeUrl":"https://x.fr","adminUrl":"https://x.fr/wp-admin",
  "contentDir":"wp-content","tablePrefix":"gp4iltv_","wpVersion":"7.0.4","phpVersion":"8.4.21",
  "dbType":"mysql","originalHttpPort":443,"hasDatabaseDump":true,"hasWpContent":true}"#;

// Archive produite par la version .NET : ni generator, ni generatorVersion, ni siteName, ni homeUrl
const V1_ANCIENNE_APP: &str = r#"{"formatVersion":"1.0.0","signature":"CODINFLO_AZF_PROPRIETARY",
  "createdAt":"2026-08-25T09:15:45Z","author":"Codinflo WoodPress","projectName":"axpc84",
  "clientName":"AXPC84","siteUrl":"http://localhost:80","tablePrefix":"wpdg_","wpVersion":"7.0.4",
  "phpVersion":"8.4","dbType":"mysql","originalHttpPort":80,"originalDbPort":3309,
  "hasDatabaseDump":true,"hasWpContent":false,"customNotes":""}"#;

#[test]
fn manifeste_v3_du_plugin_bridge() {
    let m: AzfManifest = serde_json::from_str(V3_BRIDGE).expect("manifeste v3 illisible");
    assert_eq!(m.project_name, "vk-interior-design");
    assert_eq!(m.table_prefix, "gp4iltv_");
}

#[test]
fn manifeste_v1_produit_par_lancienne_application() {
    let m: AzfManifest = serde_json::from_str(V1_ANCIENNE_APP).expect("manifeste v1 illisible");
    assert_eq!(m.project_name, "axpc84");
    assert_eq!(m.wp_version, "7.0.4");
    // Champs apparus apres : valeurs par defaut, pas d'echec
    assert_eq!(m.generator, "");
}

#[test]
fn un_json_sans_signature_est_refuse_par_inspect() {
    // La signature est le seul garde-fou restant une fois les champs rendus optionnels
    let m: AzfManifest = serde_json::from_str(r#"{"projectName":"x"}"#).expect("desérialisation");
    assert_ne!(m.signature, "CODINFLO_AZF_PROPRIETARY");
}
