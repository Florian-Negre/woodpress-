<?php
if (!defined('ABSPATH')) {
    exit;
}

class WoodPress_Azf_Importer
{
    public static function ajax_import()
    {
        check_ajax_referer('woodpress_bridge_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => 'Autorisation refusée.'));
        }

        @set_time_limit(600);
        @ini_set('memory_limit', '512M');

        if (!isset($_FILES['azf_file']) || $_FILES['azf_file']['error'] !== UPLOAD_ERR_OK) {
            wp_send_json_error(array('message' => 'Fichier .AZF manquant ou erreur lors du téléversement.'));
        }

        $file_tmp = $_FILES['azf_file']['tmp_name'];
        $upload_dir = wp_upload_dir();
        $extract_dir = trailingslashit($upload_dir['basedir']) . 'woodpress_import_' . time();
        wp_mkdir_p($extract_dir);

        try {
            // 1. Décompression de l'archive .AZF
            $zip = new ZipArchive();
            if ($zip->open($file_tmp) !== true) {
                throw new Exception("Impossible d'ouvrir l'archive .AZF.");
            }
            $zip->extractTo($extract_dir);
            $zip->close();

            // 2. Lecture du Manifeste
            $manifest_file = $extract_dir . '/manifest.azf.json';
            $old_url = '';
            if (file_exists($manifest_file)) {
                $manifest = json_decode(file_contents($manifest_file), true);
                if (!empty($manifest['siteUrl'])) {
                    $old_url = untrailingslashit($manifest['siteUrl']);
                }
            }

            // 3. Restauration de la Base de Données SQL
            $sql_file = $extract_dir . '/database.sql';
            if (file_exists($sql_file)) {
                self::import_database($sql_file);
            }

            // 4. Copie des fichiers wp-content
            $extracted_wp_content = $extract_dir . '/wp-content';
            if (is_dir($extracted_wp_content)) {
                self::copy_dir($extracted_wp_content, WP_CONTENT_DIR);
            }

            // 5. Search & Replace automatique des URLs si demandé
            $new_url = untrailingslashit(home_url());
            if (!empty($old_url) && $old_url !== $new_url) {
                self::search_and_replace_urls($old_url, $new_url);
            }

            // Nettoyage temporaire
            self::delete_dir($extract_dir);

            wp_send_json_success(array(
                'message' => 'Site importé et restauré avec succès avec Search & Replace !'
            ));
        } catch (Exception $e) {
            self::delete_dir($extract_dir);
            wp_send_json_error(array('message' => $e->getMessage()));
        }
    }

    private static function import_database($sql_file)
    {
        global $wpdb;
        $queries = file_get_contents($sql_file);
        if (empty($queries)) return;

        // Découpage des requêtes
        $sql_statements = explode(";\n", $queries);
        foreach ($sql_statements as $statement) {
            $statement = trim($statement);
            if (!empty($statement)) {
                $wpdb->query($statement);
            }
        }
    }

    private static function search_and_replace_urls($old_url, $new_url)
    {
        global $wpdb;

        // Remplacement dans wp_options (siteurl & home)
        $wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value = REPLACE(option_value, %s, %s) WHERE option_name IN ('siteurl', 'home')", $old_url, $new_url));

        // Remplacement dans wp_posts (guid, post_content)
        $wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET post_content = REPLACE(post_content, %s, %s)", $old_url, $new_url));
        $wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET guid = REPLACE(guid, %s, %s)", $old_url, $new_url));

        // Remplacement dans wp_postmeta
        $wpdb->query($wpdb->prepare("UPDATE {$wpdb->postmeta} SET meta_value = REPLACE(meta_value, %s, %s)", $old_url, $new_url));
    }

    private static function copy_dir($src, $dst)
    {
        $dir = opendir($src);
        @mkdir($dst);
        while (false !== ($file = readdir($dir))) {
            if (($file != '.') && ($file != '..')) {
                if (is_dir($src . '/' . $file)) {
                    self::copy_dir($src . '/' . $file, $dst . '/' . $file);
                } else {
                    copy($src . '/' . $file, $dst . '/' . $file);
                }
            }
        }
        closedir($dir);
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
