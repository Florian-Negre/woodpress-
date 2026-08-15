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
                $manifest_content = file_get_contents($manifest_file);
                $manifest = json_decode($manifest_content, true);
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

            // 5. Search & Replace automatique des URLs compatible données sérialisées
            $new_url = untrailingslashit(home_url());
            if (!empty($old_url) && $old_url !== $new_url) {
                self::search_and_replace_urls_serialized($old_url, $new_url);
            }

            // Nettoyage temporaire
            self::delete_dir($extract_dir);

            wp_send_json_success(array(
                'message' => 'Site importé et restauré avec succès avec Search & Replace !'
            ));
        } catch (Throwable $e) {
            self::delete_dir($extract_dir);
            wp_send_json_error(array('message' => $e->getMessage()));
        }
    }

    private static function import_database($sql_file)
    {
        global $wpdb;
        $queries = file_get_contents($sql_file);
        if (empty($queries)) return;

        $sql_statements = explode(";\n", $queries);
        foreach ($sql_statements as $statement) {
            $statement = trim($statement);
            if (!empty($statement)) {
                $wpdb->query($statement);
            }
        }
    }

    /**
     * Search & Replace récursif compatible avec les données PHP sérialisées (Divi, Elementor, ACF, Widgets)
     */
    private static function search_and_replace_urls_serialized($old_url, $new_url)
    {
        global $wpdb;

        // 1. Tables principales
        $tables = array(
            $wpdb->options  => array('option_value', 'option_id'),
            $wpdb->posts    => array('post_content', 'ID'),
            $wpdb->postmeta => array('meta_value', 'meta_id')
        );

        foreach ($tables as $table => $cols) {
            $val_col = $cols[0];
            $id_col  = $cols[1];

            $rows = $wpdb->get_results("SELECT {$id_col}, {$val_col} FROM {$table} WHERE {$val_col} LIKE '%" . $wpdb->esc_like($old_url) . "%'", ARRAY_A);
            if (!empty($rows)) {
                foreach ($rows as $row) {
                    $id = $row[$id_col];
                    $val = $row[$val_col];

                    $new_val = self::recursive_unserialize_replace($old_url, $new_url, $val);
                    $wpdb->update($table, array($val_col => $new_val), array($id_col => $id));
                }
            }
        }

        // Remplacement simple dans guid
        $wpdb->query($wpdb->prepare("UPDATE {$wpdb->posts} SET guid = REPLACE(guid, %s, %s)", $old_url, $new_url));
    }

    private static function recursive_unserialize_replace($from, $to, $data)
    {
        if (is_serialized($data)) {
            $unserialized = @unserialize($data);
            if ($unserialized !== false || $data === 'b:0;') {
                $replaced = self::recursive_replace($from, $to, $unserialized);
                return serialize($replaced);
            }
        }

        if (is_string($data)) {
            return str_replace($from, $to, $data);
        }

        return $data;
    }

    private static function recursive_replace($from, $to, $data)
    {
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                $data[$key] = self::recursive_replace($from, $to, $value);
            }
        } elseif (is_object($data)) {
            foreach ($data as $key => $value) {
                $data->$key = self::recursive_replace($from, $to, $value);
            }
        } elseif (is_string($data)) {
            $data = str_replace($from, $to, $data);
        }
        return $data;
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
        @rmdir($dir);
    }
}
