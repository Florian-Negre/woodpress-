import { state } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export async function showWpVersionModal() {
  const existing = document.getElementById('wp-ver-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-ver-modal'
  modalOverlay.className = 'modal-overlay'

  let isChecking = false

  function render() {
    modalOverlay.innerHTML = `
      <div class="modal" style="width: 540px; max-width: 95vw;">
        <!-- Header -->
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px">🌐</span>
            <div>
              <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">
                WordPress Core — Version & Mises à jour
              </div>
              <div style="font-size:12px;color:var(--tx3);margin-top:2px;">
                Dernière version officielle : WordPress v${state.latestWpVersion || '6.7.2'}
              </div>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <div style="background:var(--surf2);border:1px solid var(--bd);border-radius:10px;padding:16px;display:flex;align-items:center;gap:14px;">
            <div style="width:42px;height:42px;border-radius:10px;background:var(--surf);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:20px;">
              🪵
            </div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:600;color:var(--tx)">WordPress ${state.latestWpVersion || '6.7.2'}</div>
              <div style="font-size:12px;color:var(--tx2);margin-top:2px;">Canal de publication : Officiel WordPress.org</div>
            </div>
            <div class="badge badge-online">
              <span class="badge-dot"></span> Stable
            </div>
          </div>

          <div style="font-size:13px;color:var(--tx2);line-height:1.6;">
            WoodPress synchronise automatiquement les versions officielles de WordPress avec l'API centrale. Tous vos nouveaux sites utilisent par défaut la dernière version stable ou l'image Docker compatible.
          </div>

          <div style="background:var(--surf);border:1px solid var(--bd);border-radius:8px;padding:12px 14px;font-size:12px;color:var(--tx3);">
            💡 Pour mettre à jour un site existant vers cette version, rendez-vous dans l'<strong>Établi</strong> du site concerné.
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="window.modalClose()">Fermer</button>
          <button class="btn btn-primary" ${isChecking ? 'disabled' : ''} onclick="window.wpCheckLatestVer()">
            ${isChecking ? 'Vérification…' : '🔄 Vérifier les mises à jour'}
          </button>
        </div>
      </div>
    `
  }

  window.wpCheckLatestVer = async () => {
    isChecking = true
    render()
    try {
      state.latestWpVersion = await invoke('fetch_latest_wp_version')
      alert(`Version officielle WordPress.org : v${state.latestWpVersion}`)
    } catch (e) {
      alert(`Erreur de vérification : ${e}`)
    }
    isChecking = false
    render()
  }

  render()
  document.body.appendChild(modalOverlay)
}
