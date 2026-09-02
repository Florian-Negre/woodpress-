import { state, navigate } from '../app.js'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

export function showImportModal(initialFilePath = null) {
  const existing = document.getElementById('wp-import-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-import-modal'
  modalOverlay.className = 'modal-overlay'
  document.body.appendChild(modalOverlay)

  let selectedFormat = 'azf' // 'azf' | 'zip' | 'wpress'
  let selectedFilePath = initialFilePath || null
  let inspection = null
  let siteName = ''
  let targetWs = state.workspaces[0]?.path || ''
  let httpPort = 8082
  let dbPort = 3306
  let isHttpTaken = false
  let isDbTaken = false
  let suggestedHttp = 8085
  let suggestedDb = 3310
  let isDeploying = false
  let deployStatus = ''
  let errorMessage = ''

  function detectFormatFromPath(path) {
    if (!path) return 'azf'
    const lower = path.toLowerCase()
    if (lower.endsWith('.wpress')) return 'wpress'
    if (lower.endsWith('.zip')) return 'zip'
    return 'azf'
  }

  async function handleFileSelect(filePath) {
    if (!filePath) return
    selectedFilePath = filePath
    selectedFormat = detectFormatFromPath(filePath)
    errorMessage = ''
    render()

    try {
      const res = await invoke('inspect_archive', { archivePath: filePath })
      inspection = res
      selectedFormat = res.format || selectedFormat
      siteName = res.siteName || siteName
      httpPort = res.originalHttpPort || 8082
      dbPort = res.originalDbPort || 3306
      isHttpTaken = res.isHttpPortTaken || false
      isDbTaken = res.isDbPortTaken || false
      suggestedHttp = res.suggestedHttpPort || 8085
      suggestedDb = res.suggestedDbPort || 3310

      // Si le port par défaut est pris, pré-appliquer le port suggéré ou laisser l'alerte
      render()
    } catch (err) {
      console.warn('Erreur inspection archive :', err)
      errorMessage = typeof err === 'string' ? err : 'Impossible de lire cette archive'
      render()
    }
  }

  // Si un fichier a été transmis dès l'ouverture (ex: drag & drop sur la 5e carte)
  if (initialFilePath) {
    handleFileSelect(initialFilePath)
  }

  function render() {
    const isReady = !!selectedFilePath && siteName.trim().length > 0 && !isDeploying
    const previewPath = targetWs ? `${targetWs}\\${siteName || 'nom-du-dossier'}` : siteName

    modalOverlay.innerHTML = `
      <div class="modal" style="width: 640px; max-width: 95vw; background: #0c121d; border: 1px solid #1e293b; border-radius: 14px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); overflow: hidden;">
        
        <!-- En-tête -->
        <div style="padding: 24px 28px 18px; border-bottom: 1px solid #182234;">
          <div style="display:flex; align-items:flex-start; justify-content:space-between;">
            <div>
              <div style="font-family:'Poppins',sans-serif; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">
                Importer un projet WordPress
              </div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
                Formats acceptés : .azf, .zip, .wpress
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="window.importModalClose()" style="color:#64748b; font-size:18px; line-height:1; padding:4px 8px;">✕</button>
          </div>
        </div>

        <!-- Corps de la modale -->
        <div style="padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; max-height: 75vh; overflow-y: auto;">
          
          <!-- 1. Format de l'archive (3 Cartes Radio) -->
          <div>
            <div style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Format de l'archive</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              
              <!-- Paquet .azf -->
              <div onclick="window.importSetFormat('azf')"
                style="
                  display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; cursor: pointer;
                  background: ${selectedFormat === 'azf' ? '#0f1f18' : '#0e1626'};
                  border: 1px solid ${selectedFormat === 'azf' ? '#84cc16' : '#1e293b'};
                  transition: all .15s ease;
                "
              >
                <div style="
                  width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${selectedFormat === 'azf' ? '#84cc16' : '#475569'};
                  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                ">
                  ${selectedFormat === 'azf' ? '<div style="width: 8px; height: 8px; border-radius: 50%; background: #84cc16;"></div>' : ''}
                </div>
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 700; color: #ffffff;">Paquet WordPress .azf</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 1px;">Site, base et configuration. Format recommandé.</div>
                </div>
              </div>

              <!-- Archive .zip -->
              <div onclick="window.importSetFormat('zip')"
                style="
                  display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; cursor: pointer;
                  background: ${selectedFormat === 'zip' ? '#0f1f18' : '#0e1626'};
                  border: 1px solid ${selectedFormat === 'zip' ? '#84cc16' : '#1e293b'};
                  transition: all .15s ease;
                "
              >
                <div style="
                  width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${selectedFormat === 'zip' ? '#84cc16' : '#475569'};
                  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                ">
                  ${selectedFormat === 'zip' ? '<div style="width: 8px; height: 8px; border-radius: 50%; background: #84cc16;"></div>' : ''}
                </div>
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 700; color: #ffffff;">Archive WordPress standard .zip</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 1px;">Fichiers du site. Versions et ports à renseigner.</div>
                </div>
              </div>

              <!-- All-in-One WP Migration .wpress -->
              <div onclick="window.importSetFormat('wpress')"
                style="
                  display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; cursor: pointer;
                  background: ${selectedFormat === 'wpress' ? '#0f1f18' : '#0e1626'};
                  border: 1px solid ${selectedFormat === 'wpress' ? '#84cc16' : '#1e293b'};
                  transition: all .15s ease;
                "
              >
                <div style="
                  width: 18px; height: 18px; border-radius: 50%; border: 2px solid ${selectedFormat === 'wpress' ? '#84cc16' : '#475569'};
                  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                ">
                  ${selectedFormat === 'wpress' ? '<div style="width: 8px; height: 8px; border-radius: 50%; background: #84cc16;"></div>' : ''}
                </div>
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 700; color: #ffffff;">All-in-One WP Migration .wpress</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 1px;">Archive d'exportation All-in-One WP Migration. Décodage natif immédiat.</div>
                </div>
              </div>

            </div>
          </div>

          <!-- 2. Fichier source & Zone Drag and Drop -->
          <div>
            <div style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Fichier source</div>
            <div id="import-file-dropzone"
              style="
                display: flex; align-items: center; justify-content: space-between; gap: 12px;
                background: #0e1626; border: 1px solid #1e293b; border-radius: 10px; padding: 6px 6px 6px 16px;
                transition: all .2s;
              "
              ondragover="event.preventDefault(); this.style.borderColor='#84cc16'; this.style.background='#132332';"
              ondragleave="this.style.borderColor='#1e293b'; this.style.background='#0e1626';"
              ondrop="window.importHandleDrop(event)"
            >
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; color: ${selectedFilePath ? '#38bdf8' : '#475569'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;" title="${selectedFilePath || ''}">
                ${selectedFilePath || 'Aucun fichier sélectionné (glissez votre fichier ici)'}
              </div>
              <button class="btn btn-sm" onclick="window.importPickFile()"
                style="background: #1e293b; color: #f8fafc; font-weight: 600; border: 1px solid #334155; padding: 7px 18px; border-radius: 8px; flex-shrink: 0; cursor: pointer;">
                Parcourir
              </button>
            </div>
            ${errorMessage ? `
              <div style="color: #ef4444; font-size: 11px; margin-top: 6px; font-weight: 500;">
                ⚠️ ${errorMessage}
              </div>
            ` : ''}
          </div>

          <!-- 3. Nom du projet -->
          <div>
            <div style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Nom du projet</div>
            <input id="import-site-name" class="input font-mono"
              value="${siteName}"
              placeholder="nom du dossier cible"
              style="background: #0e1626; border: 1px solid #1e293b; border-radius: 10px; padding: 10px 14px; width: 100%; color: #f8fafc; font-size: 13px;"
              oninput="window.importUpdateSiteName(this.value)"
            />
          </div>

          <!-- 4. Espace de destination -->
          <div>
            <div style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Espace de destination</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              ${state.workspaces.map(ws => `
                <div onclick="window.importSetWs('${ws.path.replace(/\\/g, '\\\\')}')"
                  style="
                    display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; cursor: pointer;
                    background: #0e1626; border: 1px solid ${targetWs === ws.path ? '#84cc16' : '#1e293b'};
                    transition: border-color .15s;
                  "
                >
                  <span style="width: 8px; height: 8px; border-radius: 2px; background: ${ws.color || '#38bdf8'}; flex-shrink: 0;"></span>
                  <div style="min-width: 0; flex: 1;">
                    <div class="truncate" style="font-size: 13px; font-weight: 700; color: #ffffff;">${ws.name}</div>
                    <div class="truncate font-mono" style="font-size: 11px; color: #64748b; margin-top: 1px;">${ws.path}</div>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="font-mono truncate" style="font-size: 11px; color: #475569; margin-top: 6px;">
              ${previewPath}
            </div>
          </div>

          <!-- 5. Ports du site importé -->
          <div style="background: #0e1626; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 14px;">
            <div style="font-size: 13px; font-weight: 700; color: #ffffff;">Ports du site importé</div>
            
            <!-- HTTP Port -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <div style="width: 70px; font-size: 12px; font-weight: 700; color: #94a3b8;">HTTP</div>
              <input type="number" id="import-port-http" value="${httpPort}"
                class="font-mono"
                style="
                  width: 90px; padding: 6px 10px; background: #0c121d; color: #ffffff; font-weight: 700; font-size: 13px;
                  border: 1px solid ${isHttpTaken ? '#f59e0b' : '#334155'}; border-radius: 6px; text-align: center;
                "
                oninput="window.importUpdateHttpPort(this.value)"
              />
              <div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                ${isHttpTaken ? `
                  <span style="font-size: 11px; font-weight: 600; color: #f59e0b;">Port d'origine déjà pris ici.</span>
                  <button class="btn btn-sm" onclick="window.importUseSuggestedHttp()"
                    style="background: #1e293b; color: #f8fafc; font-size: 11px; font-weight: 600; border: 1px solid #334155; padding: 4px 10px; border-radius: 6px; cursor: pointer;">
                    Utiliser ${suggestedHttp}
                  </button>
                ` : `
                  <span style="font-size: 11px; color: #22c55e; font-weight: 600;">✓ Port disponible</span>
                `}
              </div>
            </div>

            <!-- MariaDB Port -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <div style="width: 70px; font-size: 12px; font-weight: 700; color: #94a3b8;">MariaDB</div>
              <input type="number" id="import-port-db" value="${dbPort}"
                class="font-mono"
                style="
                  width: 90px; padding: 6px 10px; background: #0c121d; color: #ffffff; font-weight: 700; font-size: 13px;
                  border: 1px solid ${isDbTaken ? '#f59e0b' : '#334155'}; border-radius: 6px; text-align: center;
                "
                oninput="window.importUpdateDbPort(this.value)"
              />
              <div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                ${isDbTaken ? `
                  <span style="font-size: 11px; font-weight: 600; color: #f59e0b;">Port d'origine déjà pris ici.</span>
                  <button class="btn btn-sm" onclick="window.importUseSuggestedDb()"
                    style="background: #1e293b; color: #f8fafc; font-size: 11px; font-weight: 600; border: 1px solid #334155; padding: 4px 10px; border-radius: 6px; cursor: pointer;">
                    Utiliser ${suggestedDb}
                  </button>
                ` : `
                  <span style="font-size: 11px; color: #22c55e; font-weight: 600;">✓ Port disponible</span>
                `}
              </div>
            </div>

          </div>

          ${isDeploying ? `
            <div style="background: #0f1f18; border: 1px solid #14532d; border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
              <span class="animate-spin" style="display:inline-block; font-size: 18px;">🔄</span>
              <div style="font-size: 13px; font-weight: 600; color: #84cc16;">
                ${deployStatus || 'Déploiement en cours…'}
              </div>
            </div>
          ` : ''}

        </div>

        <!-- Pied de page -->
        <div style="padding: 16px 28px; background: #090e17; border-top: 1px solid #182234; display: flex; align-items: center; justify-content: space-between;">
          <div style="font-size: 12px; color: #64748b;">
            ${!selectedFilePath ? 'Choisissez d\'abord une archive.' : isDeploying ? 'Importation en cours…' : 'Archive prête à être importée.'}
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn btn-sm" onclick="window.importModalClose()"
              style="background: transparent; color: #94a3b8; font-weight: 600; padding: 8px 18px; border: none; cursor: pointer;">
              Annuler
            </button>
            <button class="btn btn-sm"
              style="
                background: ${isReady ? '#84cc16' : '#1e293b'};
                color: ${isReady ? '#0b0f17' : '#475569'};
                font-weight: 700; padding: 8px 22px; border-radius: 8px; border: none;
                cursor: ${isReady ? 'pointer' : 'not-allowed'};
                transition: all .15s ease;
              "
              ${!isReady ? 'disabled' : ''}
              onclick="window.importLaunch()"
            >
              ${isDeploying ? 'Importation…' : 'Lancer l\'importation'}
            </button>
          </div>
        </div>

      </div>
    `
  }

  // Fonctions globales pour les handlers HTML
  window.importModalClose = () => {
    modalOverlay.remove()
  }

  window.importSetFormat = (fmt) => {
    selectedFormat = fmt
    render()
  }

  window.importSetWs = (wsPath) => {
    targetWs = wsPath
    render()
  }

  window.importUpdateSiteName = (val) => {
    siteName = val
    render()
  }

  window.importUpdateHttpPort = (val) => {
    httpPort = parseInt(val, 10) || 8082
    isHttpTaken = false
    render()
  }

  window.importUpdateDbPort = (val) => {
    dbPort = parseInt(val, 10) || 3306
    isDbTaken = false
    render()
  }

  window.importUseSuggestedHttp = () => {
    httpPort = suggestedHttp
    isHttpTaken = false
    render()
  }

  window.importUseSuggestedDb = () => {
    dbPort = suggestedDb
    isDbTaken = false
    render()
  }

  window.importPickFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Archives WordPress (.azf, .wpress, .zip)', extensions: ['azf', 'wpress', 'zip'] },
          { name: 'Paquet WoodPress (*.azf)', extensions: ['azf'] },
          { name: 'All-in-One WP Migration (*.wpress)', extensions: ['wpress'] },
          { name: 'Archive ZIP (*.zip)', extensions: ['zip'] },
        ]
      })
      if (selected) {
        handleFileSelect(selected)
      }
    } catch (e) {
      console.warn('Erreur ouverture sélecteur de fichier :', e)
    }
  }

  window.importHandleDrop = (e) => {
    e.preventDefault()
    const dt = e.dataTransfer
    if (dt && dt.files && dt.files.length > 0) {
      const file = dt.files[0]
      if (file && file.path) {
        handleFileSelect(file.path)
      }
    }
  }

  window.importLaunch = async () => {
    if (!selectedFilePath || !siteName.trim() || isDeploying) return

    isDeploying = true
    deployStatus = '1/4 Décompression et lecture de l\'archive…'
    render()

    try {
      deployStatus = '2/4 Création de l\'environnement Docker…'
      render()

      await invoke('import_azf', {
        params: {
          archivePath: selectedFilePath,
          workspacePath: targetWs,
          siteName: siteName.trim(),
          httpPort: httpPort,
          dbPort: dbPort,
        }
      })

      deployStatus = '3/4 Démarrage des conteneurs et import SQL…'
      render()

      // Actualiser les workspaces pour afficher le nouveau site immédiatement
      if (window.wpScanWorkspaces) {
        await window.wpScanWorkspaces()
      }

      deployStatus = '4/4 Importation terminée avec succès !'
      render()

      setTimeout(() => {
        window.importModalClose()
      }, 1000)

    } catch (err) {
      console.error('Échec importation archive :', err)
      isDeploying = false
      errorMessage = typeof err === 'string' ? err : 'Erreur lors du déploiement Docker'
      render()
    }
  }

  render()
}

// Exposer globalement
window.wpOpenImportModal = showImportModal
