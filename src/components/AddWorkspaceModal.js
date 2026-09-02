import { state, navigate } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export function showAddWorkspaceModal() {
  const existing = document.getElementById('wp-add-ws-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-add-ws-modal'
  modalOverlay.className = 'modal-overlay'

  let name = 'Mon Espace'
  let path = 'G:\\Workspace'
  let color = '#38BDF8'

  const COLORS = ['#38BDF8', '#8BC34A', '#F59E0B', '#EC4899', '#A855F7', '#6366F1']

  function render() {
    modalOverlay.innerHTML = `
      <div class="modal" style="width: 520px; max-width: 95vw;">
        <!-- Header -->
        <div class="modal-header">
          <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">Ajouter un dossier de travail</div>
          <div style="font-size:12px;color:var(--tx3);margin-top:3px;">Ce dossier sera scanné pour détecter vos projets WordPress</div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <!-- Nom de l'espace -->
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Nom du dossier</div>
            <input id="ws-name-input" class="input" value="${name}" placeholder="Ex: Projets Clients, Workspace Pro..." />
          </div>

          <!-- Chemin absolu -->
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Chemin sur votre disque</div>
            <div style="display:flex;gap:8px;">
              <input id="ws-path-input" class="input font-mono" style="flex:1;" value="${path}" placeholder="G:\\Workspace ou /home/user/projects" />
            </div>
            <div style="font-size:11px;color:var(--tx3);margin-top:6px;">
              Tous les sous-dossiers contenant un fichier docker-compose ou WordPress seront détectés.
            </div>
          </div>

          <!-- Couleur -->
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Couleur de repère</div>
            <div style="display:flex;gap:10px;align-items:center;">
              ${COLORS.map(c => `
                <span onclick="window.wsSetColor('${c}')"
                  style="
                    width:24px; height:24px; border-radius:6px; background:${c}; cursor:pointer;
                    box-shadow: ${color === c ? '0 0 0 3px var(--surf), 0 0 0 5px ' + c : 'none'};
                    transition: transform 0.1s;
                  "
                ></span>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="window.wsCloseModal()">Annuler</button>
          <button class="btn btn-primary" style="margin-left:auto;" onclick="window.wsSubmit()">
            📁 Ajouter et Scanner
          </button>
        </div>
      </div>
    `

    const nameIn = document.getElementById('ws-name-input')
    if (nameIn) nameIn.addEventListener('input', (e) => { name = e.target.value })
    const pathIn = document.getElementById('ws-path-input')
    if (pathIn) pathIn.addEventListener('input', (e) => { path = e.target.value })
  }

  window.wsSetColor = (c) => { color = c; render() }
  window.wsCloseModal = () => modalOverlay.remove()
  window.wsSubmit = async () => {
    if (!path.trim()) return

    const newWs = {
      name: name.trim() || 'Workspace',
      path: path.trim(),
      color: color,
    }

    // Éviter les doublons
    if (!state.workspaces.some(w => w.path === newWs.path)) {
      state.workspaces.push(newWs)
      localStorage.setItem('wp-workspaces', JSON.stringify(state.workspaces))
    }

    modalOverlay.remove()

    // Lancer le scan immédiatement
    try {
      const paths = state.workspaces.map(w => w.path)
      state.sites = await invoke('scan_workspaces', { paths })
    } catch (e) {
      console.warn('Scan après ajout:', e)
    }

    navigate('atelier')
  }

  render()
  document.body.appendChild(modalOverlay)
}
