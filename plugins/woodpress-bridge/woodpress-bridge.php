<?php
/**
 * Plugin Name: WoodPress Bridge (Format .AZF)
 * Plugin URI: https://github.com/Florian-Negre/woodpress-
 * Description: Extension officielle WoodPress pour l'exportation et l'importation de paquets propriétaires .AZF sans accès serveur (Migration 1-Clic, Sauvegarde BDD + wp-content et Search & Replace).
 * Version: 1.0.0
 * Author: Florian Nègre — Atelier Codinflo
 * Author URI: https://github.com/Florian-Negre
 * License: GPLv2 or later
 * Text Domain: woodpress-bridge
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WOODPRESS_BRIDGE_VERSION', '1.0.0');
define('WOODPRESS_BRIDGE_PATH', plugin_dir_path(__FILE__));
define('WOODPRESS_BRIDGE_URL', plugin_dir_url(__FILE__));

require_once WOODPRESS_BRIDGE_PATH . 'includes/class-azf-exporter.php';
require_once WOODPRESS_BRIDGE_PATH . 'includes/class-azf-importer.php';

class WoodPressBridge
{
    private static $instance = null;

    public static function get_instance()
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct()
    {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_assets'));
        
        // AJAX Endpoints
        add_action('wp_ajax_woodpress_export_azf', array('WoodPress_Azf_Exporter', 'ajax_export'));
        add_action('wp_ajax_woodpress_import_azf', array('WoodPress_Azf_Importer', 'ajax_import'));
    }

    public function add_admin_menu()
    {
        add_menu_page(
            'WoodPress .AZF',
            'WoodPress .AZF',
            'manage_options',
            'woodpress-bridge',
            array($this, 'render_admin_page'),
            'dashicons-archive',
            80
        );
    }

    public function enqueue_assets($hook)
    {
        if ($hook !== 'toplevel_page_woodpress-bridge') {
            return;
        }

        wp_enqueue_style(
            'woodpress-bridge-css',
            WOODPRESS_BRIDGE_URL . 'assets/admin.css',
            array(),
            WOODPRESS_BRIDGE_VERSION
        );

        wp_enqueue_script(
            'woodpress-bridge-js',
            WOODPRESS_BRIDGE_URL . 'assets/admin.js',
            array('jquery'),
            WOODPRESS_BRIDGE_VERSION,
            true
        );

        wp_localize_script('woodpress-bridge-js', 'woodpress_bridge', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('woodpress_bridge_nonce')
        ));
    }

    public function render_admin_page()
    {
        ?>
        <div class="wrap woodpress-wrap">
            <div class="woodpress-header">
                <div class="woodpress-logo-title">
                    <span class="woodpress-badge">🪵 WoodPress</span>
                    <h1>Passerelle de Migration .AZF</h1>
                </div>
                <p class="woodpress-desc">Exportez et importez l'intégralité de votre site WordPress (BDD + Médias + Extensions) en format propriétaire .AZF 100% autonome sans accès serveur.</p>
            </div>

            <div class="woodpress-grid">
                <!-- PANNEAU EXPORT -->
                <div class="woodpress-card">
                    <div class="card-header">
                        <h2>📦 Exporter en Paquet .AZF</h2>
                        <span class="card-tag tag-export">1-Clic</span>
                    </div>
                    <p>Génère un paquet tout-en-un contenant la base de données SQL, vos thèmes, extensions et médias <code>wp-content</code>.</p>
                    
                    <div class="export-options">
                        <label>
                            <input type="checkbox" id="wp_include_uploads" checked> Inclure le dossier des médias (Uploads)
                        </label>
                        <label>
                            <input type="checkbox" id="wp_include_plugins" checked> Inclure les extensions (Plugins)
                        </label>
                        <label>
                            <input type="checkbox" id="wp_include_themes" checked> Inclure les thèmes (Themes)
                        </label>
                    </div>

                    <button type="button" id="btn-export-azf" class="button button-primary button-hero">
                        🚀 Générer &amp; Télécharger le Paquet .AZF
                    </button>

                    <div id="export-progress" class="woodpress-progress-box" style="display:none;">
                        <div class="progress-bar"><div class="progress-fill" id="export-fill"></div></div>
                        <span id="export-status-text" class="status-text">Préparation de l'exportation...</span>
                    </div>
                </div>

                <!-- PANNEAU IMPORT -->
                <div class="woodpress-card">
                    <div class="card-header">
                        <h2>📥 Importer un Paquet .AZF</h2>
                        <span class="card-tag tag-import">Restauration</span>
                    </div>
                    <p>Restaure un paquet <code>.azf</code> créé avec WoodPress Desktop ou ce plugin, avec Search &amp; Replace automatique des URLs.</p>

                    <div class="import-dropzone" id="azf-dropzone">
                        <input type="file" id="azf-file-input" accept=".azf,.zip" style="display:none;">
                        <div class="dropzone-content" onclick="document.getElementById('azf-file-input').click();">
                            <span class="dashicons dashicons-cloud-upload"></span>
                            <p><strong>Cliquez ici pour sélectionner votre fichier .AZF</strong> ou glissez-le dans cette zone.</p>
                            <span id="selected-file-name" class="file-name">Aucun fichier sélectionné</span>
                        </div>
                    </div>

                    <div class="import-options">
                        <label>
                            <input type="checkbox" id="wp_auto_search_replace" checked> Search &amp; Replace automatique des URLs vers <code><?php echo esc_html(home_url()); ?></code>
                        </label>
                    </div>

                    <button type="button" id="btn-import-azf" class="button button-secondary button-hero" disabled>
                        📥 Lancer l'Importation du Site
                    </button>

                    <div id="import-progress" class="woodpress-progress-box" style="display:none;">
                        <div class="progress-bar"><div class="progress-fill" id="import-fill"></div></div>
                        <span id="import-status-text" class="status-text">Importation et décompression en cours...</span>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}

WoodPressBridge::get_instance();
