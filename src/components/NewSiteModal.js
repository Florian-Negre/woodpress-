import { state, navigate } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export function showNewSiteModal() {
  const existing = document.getElementById('wp-new-site-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-new-site-modal'
  modalOverlay.className = 'modal-overlay'

  let step = 1
  let form = {
    name: 'mon-nouveau-site',
    workspace: state.workspaces[0]?.path || 'G:\\Workspace',
    wpVersion: '7.1',
    phpVersion: '8.4',
    httpPort: 8085,
    dbName: 'wordpress',
    dbUser: 'wordpress',
    dbPass: 'wordpress',
    installBridge: true,
  }

  // Obtenir un port libre automatiquement
  invoke('get_free_port', { start: 8080, end: 8100 })
    .then(port => {
      form.httpPort = port
      render()
    })
    .catch(() => {})

  function render() {
    const selectedWs = state.workspaces.find(w => w.path === form.workspace) || state.workspaces[0]
    const fullPath = `${form.workspace}\\${form.name}`

    modalOverlay.innerHTML = `
      <div class="modal" style="width: 680px; max-width: 95vw;">
        <!-- Header -->
        <div class="modal-header" style="display:flex; align-items:center; gap:12px;">
          <div style="flex:1;">
            <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">Nouveau site</div>
            <div style="font-size:12px;color:var(--tx3);margin-top:3px;">
              ${step === 1 ? 'Étape 1 sur 2 · identité' : 'Étape 2 sur 2 · récapitulatif & création'}
            </div>
          </div>
          <!-- Stepper -->
          <div style="display:flex;gap:5px;">
            <span style="width:22px;height:3px;border-radius:2px;background:${step >= 1 ? 'var(--grn)' : 'var(--bd)'}"></span>
            <span style="width:22px;height:3px;border-radius:2px;background:${step >= 2 ? 'var(--grn)' : 'var(--bd)'}"></span>
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:18px;">
          ${step === 1 ? `
            <!-- Nom du site -->
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Nom du site</div>
              <input id="new-site-name" class="input" value="${form.name}" placeholder="boulangerie-martin" />
              <div style="font-size:11px;color:var(--tx3);margin-top:6px;">
                Sert de nom de dossier, de préfixe de conteneur et de nom d'hôte local.
              </div>
            </div>

            <!-- Dossier de travail -->
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Dossier de travail</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                ${state.workspaces.map(ws => `
                  <div onclick="window.modalSetWs('${ws.path.replace(/\\/g, '\\\\')}')"
                    style="
                      cursor:pointer; background:var(--surf);
                      border:1px solid ${form.workspace === ws.path ? 'var(--grn)' : 'var(--bd)'};
                      border-radius:8px; padding:12px 14px;
                    "
                  >
                    <div style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;color:var(--tx)">
                      <span style="width:7px;height:7px;border-radius:2px;background:${ws.color}"></span>
                      ${ws.name}
                    </div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3);margin-top:5px;">${ws.path}</div>
                  </div>
                `).join('')}
              </div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3);margin-top:8px;">
                → ${fullPath}
              </div>
            </div>

            <!-- Stack WP & PHP -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Version WordPress</div>
                <select id="new-site-wp" class="input input-mono">
                  <option value="7.1" selected>7.1 (dernière)</option>
                  <option value="7.0.4">7.0.4</option>
                  <option value="6.7.2">6.7.2</option>
                  <option value="6.6.3">6.6.3</option>
                </select>
              </div>
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Version PHP</div>
                <select id="new-site-php" class="input input-mono">
                  <option value="8.4" selected>8.4 (recommandé)</option>
                  <option value="8.3">8.3</option>
                  <option value="8.2">8.2</option>
                  <option value="8.1">8.1</option>
                </select>
              </div>
            </div>

            <!-- Port HTTP -->
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Port HTTP</div>
              <div style="display:flex;align-items:center;gap:10px;">
                <input id="new-site-port" type="number" class="input input-mono" style="width:140px;" value="${form.httpPort}" />
                <div style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--grnT);">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 13l4 4 10-10"/>
                  </svg>
                  Port vérifié
                </div>
              </div>
            </div>
          ` : `
            <!-- Étape 2 : Récapitulatif -->
            <div style="display:flex;flex-direction:column;gap:12px;">
              <div class="card" style="display:flex;flex-direction:column;gap:10px;">
                <div style="font-size:13px;font-weight:600;color:var(--tx)">Résumé de la configuration :</div>
                <div style="display:grid;grid-template-columns:140px 1fr;gap:6px;font-size:13px;">
                  <span style="color:var(--tx3)">Nom :</span><span style="font-weight:600">${form.name}</span>
                  <span style="color:var(--tx3)">Emplacement :</span><span class="font-mono" style="color:var(--cy)">${fullPath}</span>
                  <span style="color:var(--tx3)">WordPress :</span><span>v${form.wpVersion} · PHP ${form.phpVersion}</span>
                  <span style="color:var(--tx3)">Port local :</span><span class="font-mono">http://localhost:${form.httpPort}</span>
                  <span style="color:var(--tx3)">Base de données :</span><span>MariaDB 10.11 (user: wordpress)</span>
                </div>
              </div>

              <!-- Option WoodPress Bridge -->
              <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surf2);border-radius:8px;">
                <span style="font-size:18px">🪵</span>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600">Pré-installer WoodPress Bridge</div>
                  <div style="font-size:11px;color:var(--tx3)">Active immédiatement l'import/export .AZF et les diagnostics de santé.</div>
                </div>
                <div class="toggle ${form.installBridge ? 'toggle-on' : 'toggle-off'}" onclick="window.modalToggleBridge()">
                  <span class="toggle-knob"></span>
                </div>
              </div>
            </div>
          `}
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <div style="font-size:12px;color:var(--tx3);flex:1;">
            ${step === 1 ? "Aucun fichier n'est écrit avant l'étape 2." : "Création du compose et démarrage automatique."}
          </div>
          <button class="btn btn-ghost" onclick="window.modalClose()">Annuler</button>
          ${step === 1 ? `
            <button class="btn btn-primary" onclick="window.modalNext()">
              Continuer
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M5 12h13M12 5l6 7-6 7"/></svg>
            </button>
          ` : `
            <button class="btn btn-ghost" onclick="window.modalPrev()">Retour</button>
            <button id="modal-submit-btn" class="btn btn-primary" onclick="window.modalSubmit()">
              ✨ Créer le site
            </button>
          `}
        </div>
      </div>
    `

    // Attacher les écouteurs de champs
    const nameInput = document.getElementById('new-site-name')
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        form.name = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-')
      })
    }
    const wpSelect = document.getElementById('new-site-wp')
    if (wpSelect) {
      wpSelect.addEventListener('change', (e) => { form.wpVersion = e.target.value })
    }
    const phpSelect = document.getElementById('new-site-php')
    if (phpSelect) {
      phpSelect.addEventListener('change', (e) => { form.phpVersion = e.target.value })
    }
    const portInput = document.getElementById('new-site-port')
    if (portInput) {
      portInput.addEventListener('input', (e) => { form.httpPort = parseInt(e.target.value, 10) || 8080 })
    }
  }

  // Handlers globaux du modal
  window.modalSetWs = (wsPath) => { form.workspace = wsPath; render() }
  window.modalToggleBridge = () => { form.installBridge = !form.installBridge; render() }
  window.modalClose = () => modalOverlay.remove()
  window.modalNext = () => {
    if (!form.name.trim()) return
    step = 2
    render()
  }
  window.modalPrev = () => { step = 1; render() }
  window.modalSubmit = async () => {
    const btn = document.getElementById('modal-submit-btn')
    if (btn) {
      btn.disabled = true
      btn.innerHTML = 'Création en cours…'
    }
    try {
      const newSite = await invoke('create_site', {
        params: {
          name: form.name,
          workspacePath: form.workspace,
          wpVersion: form.wpVersion,
          phpVersion: form.phpVersion,
          httpPort: form.httpPort,
          dbName: form.dbName,
          dbUser: form.dbUser,
          dbPass: form.dbPass,
          installBridge: form.installBridge,
        }
      })
      state.sites.unshift(newSite)
      modalOverlay.remove()
      navigate('atelier')
    } catch (e) {
      alert('Erreur lors de la création : ' + e)
      if (btn) {
        btn.disabled = false
        btn.innerHTML = '✨ Créer le site'
      }
    }
  }

  render()
  document.body.appendChild(modalOverlay)
}
