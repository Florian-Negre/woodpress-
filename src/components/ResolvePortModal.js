import { state } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export async function showResolvePortModal(site) {
  const existing = document.getElementById('wp-port-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-port-modal'
  modalOverlay.className = 'modal-overlay'

  let proposedPort = 8085
  try {
    proposedPort = await invoke('get_free_port', { start: 8085, end: 8199 })
  } catch {}

  let isResolving = false

  function render() {
    modalOverlay.innerHTML = `
      <div class="modal" style="width: 500px; max-width: 95vw;">
        <!-- Header -->
        <div class="modal-header">
          <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">
            ⚠️ Résoudre le conflit de port HTTP
          </div>
          <div style="font-size:12px;color:var(--tx3);margin-top:2px;">
            Site : ${site.name} (port actuel :${site.http_port || 80})
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:14px;">
          <div style="font-size:13px;color:var(--rdT);background:var(--rdBg);border:1px solid var(--rdBd);padding:10px 12px;border-radius:8px;">
            ${site.conflict_reason || `Le port HTTP :${site.http_port || 80} est en conflit ou déjà occupé.`}
          </div>

          <div>
            <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Nouveau port HTTP libre proposé :</div>
            <input id="new-port-input" type="number" class="input input-mono" style="width:140px;" value="${proposedPort}" />
          </div>

          <div style="font-size:11px;color:var(--tx3);line-height:1.5;">
            WoodPress va modifier le fichier docker-compose.yml de ce site et reconfigurer les conteneurs sans perte de données.
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="window.modalClose()">Annuler</button>
          <button class="btn btn-primary" ${isResolving ? 'disabled' : ''} onclick="window.applyPortResolution()">
            ${isResolving ? 'Application…' : `Attribuer le port :${proposedPort}`}
          </button>
        </div>
      </div>
    `

    const pInput = document.getElementById('new-port-input')
    if (pInput) pInput.addEventListener('input', e => proposedPort = parseInt(e.target.value, 10) || 8080)
  }

  window.applyPortResolution = async () => {
    isResolving = true
    render()

    try {
      await invoke('resolve_port_conflict', {
        composeDir: site.compose_dir || site.path,
        newPort: proposedPort,
      })

      site.http_port = proposedPort
      site.has_port_conflict = false
      site.conflict_reason = null

      alert(`Port HTTP mis à jour vers :${proposedPort} avec succès !`)
      modalOverlay.remove()
      if (window.wpScan) window.wpScan()
    } catch (e) {
      isResolving = false
      render()
      alert(`Erreur lors de la résolution du port : ${e}`)
    }
  }

  render()
  document.body.appendChild(modalOverlay)
}
