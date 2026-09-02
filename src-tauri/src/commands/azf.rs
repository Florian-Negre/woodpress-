use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use super::docker::new_command;
use super::sites::SiteInfo;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
// Les champs absents prennent leur valeur par defaut : une archive produite par une
// version anterieure de WoodPress (format 1.0.0) reste importable.
#[serde(default)]
pub struct AzfManifest {
    #[serde(rename = "formatVersion")]
    pub format_version: String,
    pub signature: String,
    pub generator: String,
    #[serde(rename = "generatorVersion")]
    pub generator_version: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub author: String,

    #[serde(rename = "projectName")]
    pub project_name: String,
    #[serde(rename = "siteName")]
    pub site_name: String,
    #[serde(rename = "siteUrl")]
    pub site_url: String,
    #[serde(rename = "homeUrl")]
    pub home_url: String,
    #[serde(rename = "tablePrefix")]
    pub table_prefix: String,
    #[serde(rename = "wpVersion")]
    pub wp_version: String,
    #[serde(rename = "phpVersion")]
    pub php_version: String,
    #[serde(rename = "originalHttpPort")]
    pub original_http_port: u16,

    #[serde(rename = "hasDatabaseDump")]
    pub has_database_dump: bool,
    #[serde(rename = "hasWpContent")]
    pub has_wp_content: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAzfParams {
    pub archive_path: String,
    pub workspace_path: String,
    pub site_name: String,
    pub http_port: u16,
}

/// Inspecte une archive .AZF et lit son manifest.azf.json
#[tauri::command]
pub async fn inspect_azf(archive_path: String) -> Result<AzfManifest, String> {
    let file = File::open(&archive_path)
        .map_err(|e| format!("Impossible d'ouvrir l'archive : {}", e))?;

    let mut zip = ZipArchive::new(file)
        .map_err(|e| format!("Fichier .AZF invalide ou corrompu : {}", e))?;

    let mut manifest_file = zip
        .by_name("manifest.azf.json")
        .map_err(|_| "Ce fichier n'est pas une archive WoodPress valide (manifest.azf.json absent)".to_string())?;

    let mut content = String::new();
    manifest_file
        .read_to_string(&mut content)
        .map_err(|e| format!("Erreur lecture manifeste : {}", e))?;

    let manifest: AzfManifest = serde_json::from_str(&content)
        .map_err(|e| format!("Format de manifeste non reconnu : {}", e))?;

    // Les champs manquants etant tolerés, la validite de l'archive se controle ici.
    if manifest.signature != "CODINFLO_AZF_PROPRIETARY" {
        return Err("Ce fichier n'est pas une archive WoodPress valide (signature absente ou incorrecte)".to_string());
    }

    Ok(manifest)
}

/// Exporte un site en archive .AZF complète (fichiers wp-content + dump database.sql + manifest.azf.json)
#[tauri::command]
pub async fn export_azf(site_path: String, output_path: Option<String>) -> Result<String, String> {
    let site_dir = Path::new(&site_path);
    if !site_dir.exists() {
        return Err(format!("Le dossier {} n'existe pas", site_path));
    }

    let site_name = site_dir
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let temp_dir = site_dir.join(".woodpress_export_temp");
    let _ = fs::create_dir_all(&temp_dir);

    // 1. Dump SQL depuis le conteneur Docker ou dump local
    let sql_file = temp_dir.join("database.sql");
    let mut has_db = false;

    let compose_dir = if site_dir.join("docker").join("docker-compose.yml").exists() {
        site_dir.join("docker")
    } else {
        site_dir.to_path_buf()
    };

    // Tenter mysqldump via docker compose
    let dump_output = new_command("docker")
        .args(["compose", "exec", "-T", "db", "mysqldump", "-u", "root", "-proot_wordpress", "--all-databases"])
        .current_dir(&compose_dir)
        .output();

    if let Ok(out) = dump_output {
        if out.status.success() && !out.stdout.is_empty() {
            let _ = fs::write(&sql_file, out.stdout);
            has_db = true;
        }
    }

    if !has_db {
        // Fallback: dump avec user wordpress
        let dump_fallback = new_command("docker")
            .args(["compose", "exec", "-T", "db", "mysqldump", "-u", "wordpress", "-pwordpress", "wordpress"])
            .current_dir(&compose_dir)
            .output();
        if let Ok(out) = dump_fallback {
            if out.status.success() && !out.stdout.is_empty() {
                let _ = fs::write(&sql_file, out.stdout);
                has_db = true;
            }
        }
    }

    // 2. Définir le chemin de l'archive finale
    let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let export_filename = format!("woodpress_{}_{}.azf", site_name, timestamp);

    let final_dest: PathBuf = if let Some(out) = output_path {
        PathBuf::from(out)
    } else {
        let downloads = dirs::download_dir().unwrap_or_else(|| site_dir.to_path_buf());
        downloads.join(&export_filename)
    };

    let zip_file = File::create(&final_dest)
        .map_err(|e| format!("Impossible de créer le fichier d'archive : {}", e))?;

    let mut zip = ZipWriter::new(zip_file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    // 3. Ajouter database.sql
    if has_db && sql_file.exists() {
        zip.start_file("database.sql", options)
            .map_err(|e| format!("Erreur ZIP sql : {}", e))?;
        if let Ok(bytes) = fs::read(&sql_file) {
            zip.write_all(&bytes).map_err(|e| format!("Erreur écriture sql : {}", e))?;
        }
    }

    // 4. Ajouter wp-content/
    let wp_content_candidates = [
        site_dir.join("wordpress").join("wp-content"),
        site_dir.join("wp-content"),
    ];

    let wp_content_dir = wp_content_candidates.iter().find(|p| p.exists());
    let mut has_content = false;

    if let Some(src_content) = wp_content_dir {
        has_content = true;
        for entry in WalkDir::new(src_content).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            let relative = match path.strip_prefix(src_content) {
                Ok(r) => r,
                Err(_) => continue,
            };

            let rel_str = relative.to_string_lossy().replace('\\', "/");
            if rel_str.is_empty() {
                continue;
            }

            // Exclure les dossiers de cache / logs
            if rel_str.starts_with("cache")
                || rel_str.starts_with("upgrade")
                || rel_str.starts_with("woodpress-storage")
                || rel_str.starts_with("wflogs")
            {
                continue;
            }

            let zip_entry_name = format!("wp-content/{}", rel_str);

            if path.is_dir() {
                let _ = zip.add_directory(&zip_entry_name, options);
            } else if path.is_file() {
                if let Ok(mut f) = File::open(path) {
                    let _ = zip.start_file(&zip_entry_name, options);
                    let mut buffer = Vec::new();
                    if f.read_to_end(&mut buffer).is_ok() {
                        let _ = zip.write_all(&buffer);
                    }
                }
            }
        }
    }

    // 5. Générer le manifeste officiel v3.0.0
    let manifest = AzfManifest {
        format_version: "3.0.0".to_string(),
        signature: "CODINFLO_AZF_PROPRIETARY".to_string(),
        generator: "WoodPress-App".to_string(),
        generator_version: "2.0.0".to_string(),
        created_at: Utc::now().to_rfc3339(),
        author: "Florian Nègre — Atelier Codinflo".to_string(),
        project_name: site_name.clone(),
        site_name: site_name.clone(),
        site_url: format!("http://localhost:8080"),
        home_url: format!("http://localhost:8080"),
        table_prefix: "wp_".to_string(),
        wp_version: "7.0.4".to_string(),
        php_version: "8.4".to_string(),
        original_http_port: 8080,
        has_database_dump: has_db,
        has_wp_content: has_content,
    };

    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Erreur encodage JSON manifeste : {}", e))?;

    zip.start_file("manifest.azf.json", options)
        .map_err(|e| format!("Erreur ZIP manifest : {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Erreur écriture manifest : {}", e))?;

    zip.finish().map_err(|e| format!("Erreur finalisation ZIP : {}", e))?;

    // Nettoyage dossier temporaire
    let _ = fs::remove_dir_all(&temp_dir);

    Ok(final_dest.to_string_lossy().to_string())
}

/// Déploie une archive .AZF dans un workspace cible
#[tauri::command]
pub async fn import_azf(params: ImportAzfParams) -> Result<SiteInfo, String> {
    let archive_path = Path::new(&params.archive_path);
    if !archive_path.exists() {
        return Err("Fichier d'archive introuvable".to_string());
    }

    let target_dir = Path::new(&params.workspace_path).join(&params.site_name);
    if target_dir.exists() {
        return Err(format!("Le dossier destination {} existe déjà", target_dir.display()));
    }

    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Impossible de créer le dossier {} : {}", target_dir.display(), e))?;

    let wp_dir = target_dir.join("wordpress");
    let _ = fs::create_dir_all(&wp_dir);

    // Ouvrir l'archive ZIP
    let file = File::open(archive_path)
        .map_err(|e| format!("Erreur ouverture archive : {}", e))?;
    let mut zip = ZipArchive::new(file)
        .map_err(|e| format!("Erreur décompression archive : {}", e))?;

    let mut has_sql = false;
    let sql_extract_path = target_dir.join("database.sql");

    // Extraire les fichiers
    for i in 0..zip.len() {
        let mut entry = match zip.by_index(i) {
            Ok(e) => e,
            Err(_) => continue,
        };

        let raw_name = entry.name().to_string();

        if raw_name == "database.sql" {
            let mut out = File::create(&sql_extract_path)
                .map_err(|e| format!("Erreur extraction database.sql : {}", e))?;
            std::io::copy(&mut entry, &mut out)
                .map_err(|e| format!("Erreur copie database.sql : {}", e))?;
            has_sql = true;
            continue;
        }

        if raw_name.starts_with("wp-content/") {
            let relative_part = raw_name.strip_prefix("wp-content/").unwrap_or("");
            if relative_part.is_empty() {
                continue;
            }

            let outpath = wp_dir.join("wp-content").join(relative_part);

            if entry.is_dir() {
                let _ = fs::create_dir_all(&outpath);
            } else {
                if let Some(parent) = outpath.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                if let Ok(mut outfile) = File::create(&outpath) {
                    let _ = std::io::copy(&mut entry, &mut outfile);
                }
            }
        }
    }

    // Générer docker-compose.yml avec les ports choisis
    let pma_port = params.http_port + 1000;
    let mail_port = 8025;

    let compose_content = format!(
        r#"services:
  wordpress:
    image: wordpress:7.0.4-php8.4-apache
    container_name: {name}-wp
    restart: unless-stopped
    ports:
      - "{port}:80"
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wordpress
    volumes:
      - ./wordpress:/var/www/html
    depends_on:
      - db

  db:
    image: mariadb:10.11
    container_name: {name}-db
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wordpress
      MYSQL_ROOT_PASSWORD: root_wordpress
    volumes:
      - ./db_data:/var/lib/mysql

  pma:
    image: phpmyadmin:latest
    container_name: {name}-pma
    restart: unless-stopped
    ports:
      - "{pma_port}:80"
    environment:
      PMA_HOST: db
      MYSQL_ROOT_PASSWORD: root_wordpress
    depends_on:
      - db

  mailpit:
    image: axllent/mailpit:latest
    container_name: {name}-mail
    restart: unless-stopped
    ports:
      - "{mail_port}:8025"
"#,
        name = params.site_name,
        port = params.http_port,
        pma_port = pma_port,
        mail_port = mail_port,
    );

    let compose_file = target_dir.join("docker-compose.yml");
    fs::write(&compose_file, compose_content)
        .map_err(|e| format!("Erreur écriture compose : {}", e))?;

    let clean_name = params.site_name.to_lowercase();

    // Démarrer Docker Compose avec isolation du projet (-p)
    let _ = new_command("docker")
        .args(["compose", "-p", &clean_name, "up", "-d"])
        .current_dir(&target_dir)
        .output();

    // Si database.sql est présent, attendre que db soit prêt et injecter
    if has_sql {
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        let sql_file = target_dir.join("database.sql");
        if sql_file.exists() {
            if let Ok(sql_data) = fs::read_to_string(&sql_file) {
                use std::io::Write;
                if let Ok(mut child) = new_command("docker")
                    .args(["compose", "-p", &clean_name, "exec", "-T", "db", "mysql", "-u", "root", "-proot_wordpress", "wordpress"])
                    .current_dir(&target_dir)
                    .stdin(std::process::Stdio::piped())
                    .spawn()
                {
                    if let Some(mut stdin) = child.stdin.take() {
                        let _ = stdin.write_all(sql_data.as_bytes());
                    }
                    let _ = child.wait();
                }
            }
            let _ = fs::remove_file(sql_file);
        }
    }

    Ok(SiteInfo {
        name: params.site_name.clone(),
        path: target_dir.to_string_lossy().to_string(),
        compose_dir: target_dir.to_string_lossy().to_string(),
        workspace: params.workspace_path,
        status: "online".to_string(),
        http_port: Some(params.http_port),
        custom_domain: Some(format!("{}.local", params.site_name.to_lowercase())),
        primary_url: Some(format!("http://localhost:{}", params.http_port)),
        admin_url: Some(format!("http://localhost:{}/wp-admin", params.http_port)),
        wp_version: Some("7.0.4".to_string()),
        php_version: Some("PHP 8.4".to_string()),
        has_update: false,
        latest_wp: None,
        has_port_conflict: false,
        conflict_reason: None,
        is_legacy: false,
        legacy_stack: None,
    })
}
