<?php
if (!defined('ABSPATH')) {
    exit;
}

class WoodPress_Azf_Exporter
{
    public static function ajax_export()
    {
        check_ajax_referer('woodpress_bridge_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => 'Autorisation refusée.'));
        }

        // Augmenter les limites de temps et de mémoire pour les gros sites
        @set_time_limit(600);
        @ini_set('memory_limit', '512M');

        $include_uploads = isset($_POST['include_uploads']) && $_POST['include_uploads'] === 'true';
        $include_plugins = isset($_POST['include_plugins']) && $_POST['include_plugins'] === 'true';
        $include_themes  = isset($_POST['include_themes']) && $_POST['include_themes'] === 'true';

        $upload_dir = wp_upload_dir();
        $temp_dir = trailingslashit($upload_dir['basedir']) . 'woodpress_temp_' . time();
        if (!file_exists($temp_dir)) {
            wp_mkdir_p($temp_dir);
        }

        try {
            // 1. Dump SQL de la BDD
            $sql_file = $temp_dir . '/database.sql';
            self::dump_database($sql_file);

            // 2. Génération du Manifeste .AZF
            $manifest_file = $temp_dir . '/manifest.azf.json';
            $manifest_data = array(
                'projectName'      => sanitize_title(get_bloginfo('name')),
                'clientName'       => get_bloginfo('name'),
                'siteUrl'          => home_url(),
                'wpVersion'        => get_bloginfo('version'),
                'phpVersion'       => phpversion(),
                'tablePrefix'      => $GLOBALS['wpdb']->prefix,
                'originalHttpPort' => 80,
                'originalDbPort'   => 3306,
                'customNotes'      => 'Exporté depuis WordPress via WoodPress Bridge',
                'createdAt'        => gmdate('Y-m-d\TH:i:s\Z')
            );
            file_put_contents($manifest_file, json_encode($manifest_data, JSON_PRETTY_PRINT));

            // 3. Fichier docker-compose.yml par défaut
            $compose_file = $temp_dir . '/docker-compose.yml';
            $slug = sanitize_title(get_bloginfo('name'));
            $compose_yaml = "version: '3.8'\n\nservices:\n  wordpress:\n    image: wordpress:php8.4-apache\n    container_name: {$slug}-wp\n    restart: always\n    ports:\n      - \"8081:80\"\n    environment:\n      WORDPRESS_DB_HOST: db:3306\n      WORDPRESS_DB_USER: wp_user\n      WORDPRESS_DB_PASSWORD: wp_password\n      WORDPRESS_DB_NAME: wordpress\n    volumes:\n      - ./:/var/www/html\n    depends_on:\n      - db\n\n  db:\n    image: mysql:8.0\n    container_name: {$slug}-db\n    restart: always\n    environment:\n      MYSQL_DATABASE: wordpress\n      MYSQL_USER: wp_user\n      MYSQL_PASSWORD: wp_password\n      MYSQL_ROOT_PASSWORD: rootpassword\n    volumes:\n      - db_data:/var/lib/mysql\n\nvolumes:\n  db_data:\n";
            file_put_contents($compose_file, $compose_yaml);

            // 4. Création de l'archive .AZF
            $zip_file_name = sanitize_title(get_bloginfo('name')) . '_' . date('Ymd_His') . '.azf';
            $zip_file_path = trailingslashit($upload_dir['basedir']) . $zip_file_name;

            $zip = new ZipArchive();
            if ($zip->open($zip_file_path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new Exception("Impossible de créer l'archive .AZF.");
            }

            // Ajouter database.sql, manifest et docker-compose
            $zip->addFile($sql_file, 'database.sql');
            $zip->addFile($manifest_file, 'manifest.azf.json');
            $zip->addFile($compose_file, 'docker-compose.yml');

            // Ajouter wp-content
            $wp_content_dir = WP_CONTENT_DIR;
            if ($include_plugins && is_dir($wp_content_dir . '/plugins')) {
                self::add_dir_to_zip($zip, $wp_content_dir . '/plugins', 'wp-content/plugins');
            }
            if ($include_themes && is_dir($wp_content_dir . '/themes')) {
                self::add_dir_to_zip($zip, $wp_content_dir . '/themes', 'wp-content/themes');
            }
            if ($include_uploads && is_dir($upload_dir['basedir'])) {
                self::add_dir_to_zip($zip, $upload_dir['basedir'], 'wp-content/uploads', array('woodpress_temp_'));
            }

            $zip->close();

            // Nettoyage dossier temporaire
            self::delete_dir($temp_dir);

            $download_url = trailingslashit($upload_dir['baseurl']) . $zip_file_name;

            wp_send_json_success(array(
                'message'      => 'Exportation .AZF réussie !',
                'download_url' => $download_url,
                'file_name'    => $zip_file_name
            ));
        } catch (Exception $e) {
            self::delete_dir($temp_dir);
            wp_send_json_error(array('message' => $e->getMessage()));
        }
    }

    private static function dump_database($output_file)
    {
        global $wpdb;
        $handle = fopen($output_file, 'w');
        if (!$handle) throw new Exception("Impossible d'écrire le fichier SQL.");

        fwrite($handle, "-- Dump SQL WoodPress .AZF\n-- Date: " . gmdate('Y-m-d H:i:s') . "\n\nSET FOREIGN_KEY_CHECKS=0;\n\n");

        $tables = $wpdb->get_col("SHOW TABLES");
        foreach ($tables as $table) {
            $create_table = $wpdb->get_row("SHOW CREATE TABLE `{$table}`", ARRAY_N);
            fwrite($handle, "DROP TABLE IF EXISTS `{$table}`;\n" . $create_table[1] . ";\n\n");

            $rows = $wpdb->get_results("SELECT * FROM `{$table}`", ARRAY_A);
            if (!empty($rows)) {
                foreach ($rows as $row) {
                    $fields = array();
                    foreach ($row as $val) {
                        if (is_null($val)) {
                            $fields[] = "NULL";
                        } else {
                            $fields[] = "'" . $wpdb->_real_escape($val) . "'";
                        }
                    }
                    fwrite($handle, "INSERT INTO `{$table}` VALUES (" . implode(',', $fields) . ");\n");
                }
                fwrite($handle, "\n");
            }
        }

        fwrite($handle, "SET FOREIGN_KEY_CHECKS=1;\n");
        fclose($handle);
    }

    private static function add_dir_to_zip(&$zip, $dir, $zip_prefix, $exclude_prefixes = array())
    {
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($files as $file) {
            $file_path = $file->getRealPath();
            $relative_path = substr($file_path, strlen(rtrim($dir, '/\\')) + 1);

            $skip = false;
            foreach ($exclude_prefixes as $ex) {
                if (strpos($relative_path, $ex) !== false) {
                    $skip = true;
                    break;
                }
            }
            if ($skip) continue;

            $zip_path = $zip_prefix . '/' . str_replace('\\', '/', $relative_path);

            if ($file->isDir()) {
                $zip->addEmptyDir($zip_path);
            } else if ($file->isFile()) {
                $zip->addFile($file_path, $zip_path);
            }
        }
    }

    private static function delete_dir($dir)
    {
        if (!is_dir($dir)) return;
        $files = array_diff(scandir($dir), array('.', '..'));
        foreach ($files as $file) {
            $path = "$dir/$file";
            is_dir($path) ? self::delete_dir($path) : unlink($path);
        }
        rmdir($dir);
    }
}
