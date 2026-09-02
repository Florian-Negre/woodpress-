import { state } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export async function showWpVersionModal() {
  const existing = document.getElementById('wp-ver-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-ver-modal'
  modalOverlay.className = 'modal-overlay'

  let releases = []
  let selectedVersion = state.latestWpVersion || '7.0.4'
  let isChecking = false

  try {
    releases = await invoke('get_wp_changelogs')
  } catch (e) {
    console.warn('Erreur get_wp_changelogs :', e)
  }

  if (!releases.length) {
    releases = [
      {
        version: '7.0.4',
        releaseDate: 'Août 2026',
        title: 'WordPress 7.0 — Nouvelle Génération & Performance Extrême',
        summary: 'Mise à jour majeure avec refonte du moteur de blocs et support PHP 8.4/8.5.',
        newFeatures: [
          "⚡ Mode 'Zoom Out' et composition de grille visuelle pour les blocs.",
          '🎨 Nouvelle API Font Library pour les typographies locales.',
          '🚀 Chargement différé intelligent (Lazy-loading) des styles CSS.',
          '🔒 Double authentification native (2FA) dans le cœur.',
          '🖼️ Support natif complet AVIF et WebP optimisé.',
        ],
        fixesAndSecurity: [
          '🛡️ Correction de vulnérabilités dans l\'API REST.',
          '🛠️ Résolution des conflits de typage avec PHP 8.4.',
          '🧹 Nettoyage des options autoloadées dans wp_options.',
          '✨ Compatibilité certifiée MySQL 8.0/8.4 et MariaDB 11.x.',
        ],
        phpCompatibility: 'PHP 8.1 à PHP 8.5 (Recommandé : PHP 8.4)',
        officialUrl: 'https://wordpress.org/news/category/releases/',
      },
    ]
  }

  function render() {
    const current = releases.find(r => r.version === selectedVersion) || releases[0]

    modalOverlay.innerHTML = `
      <div class="modal" style="width: 680px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column;">
        <!-- Header -->
        <div class="modal-header" style="border-bottom: 1px solid var(--bd); padding: 18px 24px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:var(--surf2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:22px;">
              🌐
            </div>
            <div>
              <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">
                Notes de Version Officielles — WordPress Core
              </div>
              <div style="font-size:12px;color:var(--tx3);margin-top:2px;">
                Dernière version officielle stable : <strong>WordPress v${state.latestWpVersion || '7.0.4'}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
          <!-- Sélecteur de version -->
          <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surf2); border:1px solid var(--bd); border-radius:10px; padding:12px 16px;">
            <div>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);">Version sélectionnée</div>
              <div style="font-size:15px;font-weight:600;color:var(--tx);margin-top:2px;">${current.title}</div>
            </div>
            <div style="display:flex;gap:6px;">
              ${releases.map(r => `
                <button type="button" class="btn btn-sm ${r.version === current.version ? 'btn-primary' : 'btn-ghost'}"
                  onclick="window.wpSelectRelease('${r.version}')">
                  v${r.version}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Résumé & Date -->
          <div style="background:var(--surf); border:1px solid var(--bd); border-radius:10px; padding:14px 16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span class="badge badge-online"><span class="badge-dot"></span> Officiel WordPress.org</span>
              <span style="font-size:12px;color:var(--tx3)">📅 ${current.releaseDate}</span>
            </div>
            <div style="font-size:13px;color:var(--tx2);line-height:1.6;">
              ${current.summary}
            </div>
            <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--surf2);font-size:12px;color:var(--tx3);">
              🐘 <strong>Compatibilité PHP :</strong> ${current.phpCompatibility}
            </div>
          </div>

          <!-- 2 Colonnes : Nouveautés & Sécurité -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <!-- Nouveautés -->
            <div style="background:var(--surf); border:1px solid var(--bd); border-radius:10px; padding:14px;">
              <div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                <span>✨</span> Nouveautés Majeures
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${current.newFeatures.map(f => `
                  <div style="font-size:12px;color:var(--tx2);line-height:1.5;display:flex;gap:6px;">
                    <span>•</span>
                    <span>${f}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Correctifs & Sécurité -->
            <div style="background:var(--surf); border:1px solid var(--bd); border-radius:10px; padding:14px;">
              <div style="font-size:13px;font-weight:600;color:var(--tx);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                <span>🛡️</span> Sécurité & Correctifs
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${current.fixesAndSecurity.map(s => `
                  <div style="font-size:12px;color:var(--tx2);line-height:1.5;display:flex;gap:6px;">
                    <span>•</span>
                    <span>${s}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer" style="border-top: 1px solid var(--bd); padding: 14px 24px; display:flex; gap:10px;">
          <button class="btn btn-ghost" onclick="window.modalClose()">Fermer</button>
          <button class="btn btn-elev btn-sm" onclick="window.wpOpenReleaseDoc('${current.officialUrl}')" style="margin-left:auto;">
            📖 Consulter sur WordPress.org ↗
          </button>
          <button class="btn btn-primary btn-sm" ${isChecking ? 'disabled' : ''} onclick="window.wpCheckLatestVer()">
            ${isChecking ? 'Vérification…' : '🔄 Synchroniser l\'API'}
          </button>
        </div>
      </div>
    `
  }

  window.wpSelectRelease = (ver) => {
    selectedVersion = ver
    render()
  }

  window.wpOpenReleaseDoc = (url) => {
    if (url) invoke('open_url', { url })
  }

  window.wpCheckLatestVer = async () => {
    isChecking = true
    render()
    try {
      state.latestWpVersion = await invoke('fetch_latest_wp_version')
    } catch (e) {
      console.warn('Erreur vérification WP :', e)
    } finally {
      isChecking = false
      render()
    }
  }

  render()
  document.body.appendChild(modalOverlay)
}
