// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands; // public : les tests d'integration verifient les vraies structures

use commands::{azf, config, docker, sites, system};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            docker::get_docker_status,
            docker::start_docker,
            docker::get_site_containers,
            sites::scan_workspaces,
            sites::create_site,
            sites::start_site,
            sites::stop_site,
            sites::fetch_latest_wp_version,
            sites::get_site_details,
            sites::clone_site,
            sites::delete_site,
            sites::reset_wp_password,
            sites::get_php_patch_notes,
            sites::change_php_version,
            sites::resolve_port_conflict,
            sites::set_site_domain,
            sites::containerize_legacy_site,
            sites::add_wp_user,
            sites::get_wp_changelogs,
            sites::get_live_wp_release_details,
            sites::update_site_stack,
            sites::auto_discover_workspaces,
            azf::inspect_azf,
            azf::export_azf,
            azf::import_azf,
            system::get_free_port,
            system::detect_ides,
            system::open_in_ide,
            system::open_url,
            config::load_app_config,
            config::save_app_config,
            config::get_config_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WoodPress application");
}
