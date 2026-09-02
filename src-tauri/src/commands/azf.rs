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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveInspection {
    pub format: String, // "azf" | "zip" | "wpress"
    pub site_name: String,
    pub original_url: Option<String>,
    pub wp_version: Option<String>,
    pub php_version: Option<String>,
    pub original_http_port: u16,
    pub original_db_port: u16,
    pub is_http_port_taken: bool,
    pub is_db_port_taken: bool,
    pub suggested_http_port: u16,
    pub suggested_db_port: u16,
    pub file_size_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportAzfParams {
    pub archive_path: String,
    pub workspace_path: String,
    pub site_name: String,
    pub http_port: u16,
    pub db_port: Option<u16>,
}

fn is_port_in_use(port: u16) -> bool {
    std::net::TcpListener::bind(("0.0.0.0", port)).is_err()
        || std::net::TcpStream::connect_timeout(
            &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
            std::time::Duration::from_millis(60),
        ).is_ok()
}

fn find_next_free_port(start: u16, end: u16) -> u16 {
    for p in start..=end {
        if !is_port_in_use(p) {
            return p;
        }
    }
    start + 5
}

/// Extrait les archives All-in-One WP Migration (.wpress)
/// Format .wpress : blocs successifs de [4377 octets d'en-tête] + [taille brute du fichier]
pub fn extract_wpress_file(
    wpress_path: &Path,
    target_dir: &Path,
) -> Result<(Option<String>, Option<String>, Option<String>), String> {
    let mut file = File::open(wpress_path)
        .map_err(|e| format!("Impossible d'ouvrir le fichier .wpress : {}", e))?;

    let mut header = [0u8; 4377];
    let wp_dir = target_dir.join("wordpress");
    let _ = fs::create_dir_all(&wp_dir);

    let mut site_url = None;
    let mut home_url = None;
    let mut table_prefix = None;

    loop {
        match file.read_exact(&mut header) {
            Ok(_) => {},
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(format!("Erreur lecture flux .wpress : {}", e)),
        }

        // Nom du fichier (octets 0..255, chaîne terminée par \0)
        let name_bytes = &header[0..255];
        let name_end = name_bytes.iter().position(|&b| b == 0).unwrap_or(255);
        let raw_filename = String::from_utf8_lossy(&name_bytes[0..name_end]).trim().to_string();

        if raw_filename.is_empty() {
            break;
        }

        // Taille du fichier (octets 255..269, chaîne décimale ASCII)
        let size_bytes = &header[255..269];
        let size_end = size_bytes.iter().position(|&b| b == 0).unwrap_or(14);
        let size_str = String::from_utf8_lossy(&size_bytes[0..size_end]).trim().to_string();
        let file_size: u64 = size_str.parse().unwrap_or(0);

        let clean_path = raw_filename.replace('\\', "/");

        if clean_path == "package.json" {
            let mut pkg_buf = vec![0u8; file_size as usize];
            if file.read_exact(&mut pkg_buf).is_ok() {
                if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&pkg_buf) {
                    if let Some(s) = val["SiteURL"].as_str() { site_url = Some(s.to_string()); }
                    if let Some(h) = val["HomeURL"].as_str() { home_url = Some(h.to_string()); }
                    if let Some(t) = val["TablePrefix"].as_str() { table_prefix = Some(t.to_string()); }
                }
            }
            continue;
        }

        if clean_path == "database.sql" {
            let sql_dest = target_dir.join("database.sql");
            if let Ok(mut out) = File::create(sql_dest) {
                let mut take = (&mut file).take(file_size);
                let _ = std::io::copy(&mut take, &mut out);
            }
            continue;
        }

        // Fichiers du site (wp-content ou racine)
        let dest_path = if clean_path.starts_with("wp-content/") {
            let rel = clean_path.trim_start_matches("wp-content/");
            wp_dir.join("wp-content").join(rel)
        } else {
            wp_dir.join(&clean_path)
        };

        if clean_path.ends_with('/') || file_size == 0 {
            let _ = fs::create_dir_all(&dest_path);
        } else {
            if let Some(parent) = dest_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Ok(mut out) = File::create(&dest_path) {
                let mut take = (&mut file).take(file_size);
                let _ = std::io::copy(&mut take, &mut out);
            } else {
                let mut take = (&mut file).take(file_size);
                let mut sink = std::io::sink();
                let _ = std::io::copy(&mut take, &mut sink);
            }
        }
    }

    Ok((site_url, home_url, table_prefix))
}

/// Inspecte une archive (.azf, .wpress ou .zip)
#[tauri::command]
pub async fn inspect_archive(archive_path: String) -> Result<ArchiveInspection, String> {
    let p = Path::new(&archive_path);
    if !p.exists() {
        return Err("Fichier d'archive introuvable".to_string());
    }

    let file_size_bytes = fs::metadata(p).map(|m| m.len()).unwrap_or(0);
    let ext = p.extension().unwrap_or_default().to_string_lossy().to_lowercase();
    let file_stem = p.file_stem().unwrap_or_default().to_string_lossy().to_string();

    // Extraire un nom de site propre depuis le nom du fichier
    let mut clean_name = file_stem.to_lowercase();
    for prefix in &["woodpress_", "dev-", "backup-", "export-", "site-"] {
        if clean_name.starts_with(prefix) {
            clean_name = clean_name.trim_start_matches(prefix).to_string();
        }
    }
    // Couper les horodatages et hashs éventuels
    if let Some(pos) = clean_name.find('_') {
        clean_name = clean_name[..pos].to_string();
    }
    if let Some(_pos) = clean_name.find('-') {
        let parts: Vec<&str> = clean_name.split('-').collect();
        if parts.len() > 1 && parts.last().map(|s| s.chars().all(|c| c.is_ascii_digit())).unwrap_or(false) {
            clean_name = parts[..parts.len() - 1].join("-");
        }
    }
    if clean_name.is_empty() {
        clean_name = "nouveau-site".to_string();
    }

    let default_http: u16 = 8082;
    let default_db: u16 = 3306;

    let is_http_port_taken = is_port_in_use(default_http);
    let is_db_port_taken = is_port_in_use(default_db);

    let suggested_http_port = if is_http_port_taken {
        find_next_free_port(8085, 8150)
    } else {
        default_http
    };

    let suggested_db_port = if is_db_port_taken {
        find_next_free_port(3310, 3350)
    } else {
        default_db
    };

    if ext == "wpress" {
        // Inspection All-in-One WP Migration
        let mut original_url = None;
        if let Ok(mut f) = File::open(p) {
            let mut header = [0u8; 4377];
            if f.read_exact(&mut header).is_ok() {
                let name_bytes = &header[0..255];
                let name_end = name_bytes.iter().position(|&b| b == 0).unwrap_or(255);
                let raw_filename = String::from_utf8_lossy(&name_bytes[0..name_end]).trim().to_string();
                if raw_filename == "package.json" {
                    let size_bytes = &header[255..269];
                    let size_end = size_bytes.iter().position(|&b| b == 0).unwrap_or(14);
                    let size_str = String::from_utf8_lossy(&size_bytes[0..size_end]).trim().to_string();
                    if let Ok(file_size) = size_str.parse::<u64>() {
                        let mut pkg_buf = vec![0u8; file_size as usize];
                        if f.read_exact(&mut pkg_buf).is_ok() {
                            if let Ok(val) = serde_json::from_slice::<serde_json::Value>(&pkg_buf) {
                                if let Some(s) = val["SiteURL"].as_str() {
                                    original_url = Some(s.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        return Ok(ArchiveInspection {
            format: "wpress".to_string(),
            site_name: clean_name,
            original_url,
            wp_version: Some("7.0.4".to_string()),
            php_version: Some("8.4".to_string()),
            original_http_port: default_http,
            original_db_port: default_db,
            is_http_port_taken,
            is_db_port_taken,
            suggested_http_port,
            suggested_db_port,
            file_size_bytes,
        });
    }

    if ext == "azf" {
        if let Ok(file) = File::open(p) {
            if let Ok(mut zip) = ZipArchive::new(file) {
                if let Ok(mut mf) = zip.by_name("manifest.azf.json") {
                    let mut content = String::new();
                    if mf.read_to_string(&mut content).is_ok() {
                        if let Ok(manifest) = serde_json::from_str::<AzfManifest>(&content) {
                            return Ok(ArchiveInspection {
                                format: "azf".to_string(),
                                site_name: if !manifest.site_name.is_empty() { manifest.site_name } else { clean_name },
                                original_url: Some(manifest.site_url),
                                wp_version: Some(manifest.wp_version),
                                php_version: Some(manifest.php_version),
                                original_http_port: if manifest.original_http_port > 0 { manifest.original_http_port } else { default_http },
                                original_db_port: default_db,
                                is_http_port_taken,
                                is_db_port_taken,
                                suggested_http_port,
                                suggested_db_port,
                                file_size_bytes,
                            });
                        }
                    }
                }
            }
        }
    }

    // Format ZIP générique
    Ok(ArchiveInspection {
        format: "zip".to_string(),
        site_name: clean_name,
        original_url: None,
        wp_version: Some("7.0.4".to_string()),
        php_version: Some("8.4".to_string()),
        original_http_port: default_http,
        original_db_port: default_db,
        is_http_port_taken,
        is_db_port_taken,
        suggested_http_port,
        suggested_db_port,
        file_size_bytes,
    })
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

    let clean_name = site_name.to_lowercase();
    let temp_dir = std::env::temp_dir().join(format!("woodpress_export_{}", clean_name));
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Impossible de créer le dossier temporaire : {}", e))?;

    // Dump MySQL depuis le conteneur db
    let sql_path = temp_dir.join("database.sql");
    let dump_output = new_command("docker")
        .args([
            "compose",
            "-p",
            &clean_name,
            "exec",
            "-T",
            "db",
            "mysqldump",
            "-u",
            "root",
            "-proot_wordpress",
            "--databases",
            "wordpress",
            "--default-character-set=utf8mb4",
            "--single-transaction",
            "--quick",
        ])
        .current_dir(site_dir)
        .output();

    let mut has_db = false;
    if let Ok(out) = dump_output {
        if out.status.success() && !out.stdout.is_empty() {
            let _ = fs::write(&sql_path, out.stdout);
            has_db = true;
        }
    }

    let final_dest = if let Some(out) = output_path {
        PathBuf::from(out)
    } else {
        let filename = format!(
            "woodpress_{}_{}.azf",
            clean_name,
            Utc::now().format("%Y-%m-%d_%H-%M-%S")
        );
        dirs::download_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(filename)
    };

    let azf_file = File::create(&final_dest)
        .map_err(|e| format!("Impossible de créer le fichier .AZF : {}", e))?;

    let mut zip = ZipWriter::new(azf_file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let manifest = AzfManifest {
        format_version: "2.0.0".to_string(),
        signature: "CODINFLO_AZF_PROPRIETARY".to_string(),
        generator: "WoodPress".to_string(),
        generator_version: "2.0.0".to_string(),
        created_at: Utc::now().to_rfc3339(),
        author: "Codinflo".to_string(),
        project_name: site_name.clone(),
        site_name: site_name.clone(),
        site_url: format!("http://localhost:8080"),
        home_url: format!("http://localhost:8080"),
        table_prefix: "wp_".to_string(),
        wp_version: "7.0.4".to_string(),
        php_version: "8.4".to_string(),
        original_http_port: 8080,
        has_database_dump: has_db,
        has_wp_content: true,
    };

    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Erreur sérialisation manifeste : {}", e))?;

    zip.start_file("manifest.azf.json", options)
        .map_err(|e| format!("Erreur ZIP manifest : {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Erreur écriture manifest : {}", e))?;

    if has_db && sql_path.exists() {
        if let Ok(sql_bytes) = fs::read(&sql_path) {
            zip.start_file("database.sql", options)
                .map_err(|e| format!("Erreur ZIP database.sql : {}", e))?;
            zip.write_all(&sql_bytes)
                .map_err(|e| format!("Erreur écriture database.sql : {}", e))?;
        }
    }

    let wp_content_candidates = [
        site_dir.join("wordpress").join("wp-content"),
        site_dir.join("wp-content"),
    ];

    for wp_content in &wp_content_candidates {
        if wp_content.exists() && wp_content.is_dir() {
            for entry in WalkDir::new(wp_content).into_iter().filter_map(|e| e.ok()) {
                let entry_path = entry.path();
                if let Ok(rel_path) = entry_path.strip_prefix(wp_content) {
                    let zip_entry_name = format!("wp-content/{}", rel_path.to_string_lossy().replace('\\', "/"));
                    if entry_path.is_dir() {
                        let _ = zip.add_directory(&zip_entry_name, options);
                    } else if entry_path.is_file() {
                        if let Ok(data) = fs::read(entry_path) {
                            if zip.start_file(&zip_entry_name, options).is_ok() {
                                let _ = zip.write_all(&data);
                            }
                        }
                    }
                }
            }
            break;
        }
    }

    zip.finish().map_err(|e| format!("Erreur finalisation archive : {}", e))?;
    let _ = fs::remove_dir_all(&temp_dir);

    Ok(final_dest.to_string_lossy().to_string())
}

/// Déploie une archive (.AZF, .wpress ou .ZIP) dans un workspace cible
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

    let is_wpress = params.archive_path.to_lowercase().ends_with(".wpress");
    let mut has_sql = false;
    let sql_extract_path = target_dir.join("database.sql");

    if is_wpress {
        let (_site_url, _home_url, _prefix) = extract_wpress_file(archive_path, &target_dir)?;
        if sql_extract_path.exists() {
            has_sql = true;
        }
    } else {
        // Extraction archive ZIP / AZF
        let file = File::open(archive_path)
            .map_err(|e| format!("Erreur ouverture archive : {}", e))?;
        let mut zip = ZipArchive::new(file)
            .map_err(|e| format!("Erreur décompression archive : {}", e))?;

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
    }

    // Générer docker-compose.yml avec les ports choisis
    let db_port = params.db_port.unwrap_or(3306);
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
    ports:
      - "{db_port}:3306"
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wordpress
      MYSQL_ROOT_PASSWORD: root_wordpress
    volumes:
      - db_data:/var/lib/mysql

  phpmyadmin:
    image: phpmyadmin:latest
    container_name: {name}-pma
    restart: unless-stopped
    ports:
      - "{pma_port}:80"
    environment:
      PMA_HOST: db
      PMA_USER: root
      PMA_PASSWORD: root_wordpress
    depends_on:
      - db

  mailpit:
    image: axllent/mailpit:latest
    container_name: {name}-mail
    restart: unless-stopped
    ports:
      - "{mail_port}:8025"

volumes:
  db_data:
"#,
        name = params.site_name,
        port = params.http_port,
        db_port = db_port,
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

                // Adapter l'URL du site en base pour qu'il réponde immédiatement en local
                let update_sql = format!(
                    "UPDATE wp_options SET option_value = 'http://localhost:{port}' WHERE option_name IN ('siteurl', 'home');",
                    port = params.http_port
                );
                let _ = new_command("docker")
                    .args(["compose", "-p", &clean_name, "exec", "-T", "db", "mysql", "-u", "root", "-proot_wordpress", "wordpress", "-e", &update_sql])
                    .current_dir(&target_dir)
                    .output();
            }
            let _ = fs::remove_file(sql_file);
        }
    }

    let site_url = format!("http://localhost:{}", params.http_port);
    let admin_url = format!("http://localhost:{}/wp-admin", params.http_port);

    Ok(SiteInfo {
        name: params.site_name.clone(),
        path: target_dir.to_string_lossy().to_string(),
        compose_dir: target_dir.to_string_lossy().to_string(),
        workspace: params.workspace_path,
        status: "online".to_string(),
        http_port: Some(params.http_port),
        custom_domain: Some(format!("{}.local", params.site_name.to_lowercase())),
        primary_url: Some(site_url),
        admin_url: Some(admin_url),
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
