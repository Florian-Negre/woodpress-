import { state } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export async function showContainerizeModal(site) {
  const existing = document.getElementById('wp-containerize-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-containerize-modal'
  modalOverlay.className = 'modal-overlay'

  let proposedPort = 8085
  try {
    proposedPort = await invoke('get_free_port', { start: 8085, end: 8199 })
  } catch {}

  let selectedPhp = '8.4'
  let isConverting = false

  function render() {
    modalOverlay.innerHTML = `
      <div class="modal" style="width: 560px; max-width: 95vw;">
        <!-- Header -->
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px">⚡</span>
            <div>
              <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">
                Conteneuriser vers Docker en 1 clic
              </div>
              <div style="font-size:12px;color:var(--tx3);margin-top:2px;">
                Site détecté : "${site.name}" (${site.legacy_stack || 'Laragon / WAMP'})
              </div>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <div style="background:var(--surf2);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;font-size:13px;color:var(--tx);line-height:1.5;">
            WoodPress a détecté un site WordPress autonome (issu de <strong>${site.legacy_stack || 'Laragon, WAMP ou XAMPP'}</strong>).<br>
            Nous allons générer un environnement <strong>Docker isolé et ultra-performant</strong> sans modifier ni écraser vos fichiers sources !
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Port HTTP local :</div>
              <input id="containerize-port-input" type="number" class="input input-mono" value="${proposedPort}" />
            </div>
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Version PHP souhaitée :</div>
              <select id="containerize-php-select" class="input" style="background:var(--surf);color:var(--tx);">
                <option value="8.4" ${selectedPhp === '8.4' ? 'selected' : ''}>PHP 8.4 (Moderne)</option>
                <option value="8.3" ${selectedPhp === '8.3' ? 'selected' : ''}>PHP 8.3 (Stable)</option>
                <option value="8.2" ${selectedPhp === '8.2' ? 'selected' : ''}>PHP 8.2 (Legacy)</option>
                <option value="8.5" ${selectedPhp === '8.5' ? 'selected' : ''}>PHP 8.5 (RC)</option>
              </select>
            </div>
          </div>

          <div style="background:var(--surf);border:1px solid var(--bd);border-radius:8px;padding:12px 14px;font-size:12px;color:var(--tx3);">
            📦 Services inclus : <strong>WordPress Apache/PHP</strong>, <strong>MariaDB 10.11</strong>, <strong>PhpMyAdmin</strong> (:${proposedPort + 1000}) et <strong>Mailpit</strong> (:8025).
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="window.modalClose()">Annuler</button>
          <button class="btn btn-primary" ${isConverting ? 'disabled' : ''} onclick="window.applyContainerize()">
            ${isConverting ? 'Génération Docker…' : '⚡ Créer l\'environnement Docker'}
          </button>
        </div>
      </div>
    `

    const pInput = document.getElementById('containerize-port-input')
    if (pInput) pInput.addEventListener('input', e => proposedPort = parseInt(e.target.value, 10) || 8085)
    const phpSelect = document.getElementById('containerize-php-select')
    if (phpSelect) phpSelect.addEventListener('change', e => selectedPhp = e.target.value)
  }

  window.applyContainerize = async () => {
    isConverting = true
    render()

    try {
      await invoke('containerize_legacy_site', {
        sitePath: site.path,
        phpVersion: selectedPhp,
        httpPort: proposedPort,
      })

      alert(`Site "${site.name}" conteneurisé avec succès sur Docker (Port :${proposedPort}) !`)
      modalOverlay.remove()
      if (window.wpScan) window.wpScan()
    } catch (e) {
      isConverting = false
      render()
      alert(`Erreur lors de la conteneurisation : ${e}`)
    }
  }

  render()
  document.body.appendChild(modalOverlay)
}
