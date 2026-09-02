import { state, navigate } from '../app.js'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export function showImportModal() {
  const existing = document.getElementById('wp-import-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-import-modal'
  modalOverlay.className = 'modal-overlay'

  let selectedFilePath = null
  let manifest = null
  let siteName = ''
  let targetWs = state.workspaces[0]?.path || 'G:\\Workspace'
  let targetPort = 8086
  let isDeploying = false

  // Récupérer un port libre par défaut
  invoke('get_free_port', { start: 8085, end: 8100 })
    .then(p => { targetPort = p; render() })
    .catch(() => {})

  function render() {
    modalOverlay.innerHTML = `
      <div class="modal" style="width: 620px; max-width: 95vw;">
        <!-- Header -->
        <div class="modal-header">
          <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">Importer une archive .AZF</div>
          <div style="font-size:12px;color:var(--tx3);margin-top:3px;">Passerelle officielle WoodPress Bridge v3.0</div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          ${!manifest ? `
            <!-- Zone Drag & Drop / Sélection -->
            <div id="import-dropzone"
              style="
                cursor:pointer; border:1px dashed var(--bds); border-radius:10px;
                padding:36px 24px; display:flex; flex-direction:column; align-items:center;
                justify-content:center; gap:12px; background:var(--surf);
                transition: border-color .15s, background .15s;
              "
              onclick="window.importPickFile()"
              onmouseenter="this.style.borderColor='var(--cy)';this.style.background='var(--surf2)'"
              onmouseleave="this.style.borderColor='var(--bds)';this.style.background='var(--surf)'"
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--cy)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 4v10M8 10l4 4 4-4M4 18h16"/>
              </svg>
              <div style="font-size:14px;font-weight:600;color:var(--tx)">Cliquez pour sélectionner une archive .AZF</div>
              <div style="font-size:12px;color:var(--tx3)">Fichiers .azf et .zip générés par WoodPress Bridge</div>
            </div>
          ` : `
            <!-- Fichier inspecté & validé -->
            <div class="card" style="display:flex;align-items:center;gap:12px;background:var(--surf2);border:1px solid var(--grnBd)">
              <span style="font-size:28px">📦</span>
              <div style="flex:1">
                <div style="font-size:14px;font-weight:600;color:var(--tx)">${manifest.siteName || manifest.projectName}</div>
                <div class="font-mono" style="font-size:11px;color:var(--grnT);margin-top:2px;">
                  WordPress v${manifest.wpVersion || '7.0.4'} · PHP ${manifest.phpVersion || '8.4'} · Format AZF ${manifest.formatVersion}
                </div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="window.importResetFile()">Changer</button>
            </div>

            <!-- Nom du projet local -->
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Nom du dossier local</div>
              <input id="import-site-name" class="input" value="${siteName}" placeholder="nom-du-site" />
            </div>

            <!-- Destination Workspace -->
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Dossier de travail cible</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                ${state.workspaces.map(ws => `
                  <div onclick="window.importSetWs('${ws.path.replace(/\\/g, '\\\\')}')"
                    style="
                      cursor:pointer; background:var(--surf);
                      border:1px solid ${targetWs === ws.path ? 'var(--grn)' : 'var(--bd)'};
                      border-radius:8px; padding:10px 12px;
                    "
                  >
                    <div style="font-size:12px;font-weight:600;color:var(--tx)">${ws.name}</div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--tx3);">${ws.path}</div>
                  </div>
                `).join('')}
              </div>
              <div class="font-mono" style="font-size:11px;color:var(--tx3);margin-top:6px;">
                → ${targetWs}\\${siteName}
              </div>
            </div>

            <!-- Port HTTP -->
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Port HTTP local</div>
              <input id="import-site-port" type="number" class="input input-mono" style="width:140px;" value="${targetPort}" />
            </div>
          `}
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <div style="font-size:12px;color:var(--tx3);flex:1;">Restauration complète BDD + Fichiers</div>
          <button class="btn btn-ghost" onclick="window.modalClose()">Annuler</button>
          <button id="import-deploy-btn" class="btn btn-primary" ${!manifest || isDeploying ? 'disabled' : ''} onclick="window.importExecute()">
            ${isDeploying ? 'Déploiement en cours…' : '🚀 Déployer le site'}
          </button>
        </div>
      </div>
    `

    const nameInput = document.getElementById('import-site-name')
    if (nameInput) {
      nameInput.addEventListener('input', (e) => { siteName = e.target.value })
    }
    const portInput = document.getElementById('import-site-port')
    if (portInput) {
      portInput.addEventListener('input', (e) => { targetPort = parseInt(e.target.value, 10) || 8080 })
    }
  }

  window.importPickFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Archives WoodPress', extensions: ['azf', 'zip'] }]
      })

      if (selected) {
        selectedFilePath = selected
        // Inspecter l'archive via le backend Rust
        manifest = await invoke('inspect_azf', { archivePath: selected })
        siteName = (manifest.projectName || manifest.siteName || 'imported-site')
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, '-')
        render()
      }
    } catch (e) {
      alert("Erreur lors de l'inspection de l'archive : " + e)
    }
  }

  window.importResetFile = () => { manifest = null; selectedFilePath = null; render() }
  window.importSetWs = (p) => { targetWs = p; render() }
  window.importExecute = async () => {
    if (!selectedFilePath || !manifest || !siteName.trim()) return

    isDeploying = true
    render()

    try {
      const newSite = await invoke('import_azf', {
        params: {
          archivePath: selectedFilePath,
          workspacePath: targetWs,
          siteName: siteName.trim(),
          httpPort: targetPort,
        }
      })

      state.sites.unshift(newSite)
      modalOverlay.remove()
      navigate('atelier')
    } catch (e) {
      isDeploying = false
      render()
      alert("Erreur lors de l'importation : " + e)
    }
  }

  render()
  document.body.appendChild(modalOverlay)
}
