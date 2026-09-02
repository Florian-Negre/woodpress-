import { state } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export function showWpVersionModal() {
  const existing = document.getElementById('wp-ver-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-ver-modal'
  modalOverlay.className = 'modal-overlay'

  // État local des sites en cours de mise à jour dans la modale
  const updatingSites = new Set()

  function render() {
    // Obtenir la liste des sites (ou sites d'exemple si aucun site chargé)
    let displaySites = []
    if (state.sites && state.sites.length > 0) {
      displaySites = state.sites.map(s => ({
        name: s.name,
        path: s.path,
        composeDir: s.compose_dir || s.path,
        wpVersion: s.wp_version || '6.7.2',
        isReal: true,
      }))
    } else {
      // Données de prévisualisation conformes à la maquette
      displaySites = [
        { name: 'codinflo', path: 'mock-1', wpVersion: '7.0.4', isReal: false },
        { name: 'vk-interiordesign', path: 'mock-2', wpVersion: '7.0.4', isReal: false },
        { name: 'AXPC84', path: 'mock-3', wpVersion: '7.1', isReal: false },
        { name: 'demo', path: 'mock-4', wpVersion: '6.7.2', isReal: false },
      ]
    }

    modalOverlay.innerHTML = `
      <div class="modal" style="
        width: 640px;
        max-width: 95vw;
        max-height: 92vh;
        background: #0b0f17;
        border: 1px solid #1e293b;
        border-radius: 12px;
        padding: 24px;
        color: #f1f5f9;
        font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      ">
        <!-- En-tête : Titre & Badge -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
          <div>
            <div style="font-family: 'Poppins', sans-serif; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">
              WordPress 7.1
            </div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
              Publiée le 26 août 2026 · 2 correctifs de sécurité, 42 corrections de bugs
            </div>
          </div>
          <div style="
            display: inline-flex; align-items: center; gap: 6px;
            background: rgba(34, 197, 94, 0.12);
            border: 1px solid rgba(34, 197, 94, 0.25);
            border-radius: 9999px;
            padding: 4px 12px;
            font-size: 12px;
            font-weight: 500;
            color: #4ade80;
            flex-shrink: 0;
          ">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #4ade80;"></span>
            dernière version stable
          </div>
        </div>

        <!-- Alerte rouge : Failles de sécurité -->
        <div style="
          margin-top: 18px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        ">
          <div style="
            width: 28px; height: 28px; border-radius: 6px;
            display: flex; align-items: center; justify-content: center;
            color: #ef4444; flex-shrink: 0;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5;">
            Cette version corrige <strong style="color: #ef4444; font-weight: 600;">2 failles de sécurité</strong>, dont une injection SQL dans l'éditeur de blocs. Mise à jour recommandée sans attendre.
          </div>
        </div>

        <!-- Résumé de la note de version -->
        <div style="margin-top: 20px;">
          <div style="font-size: 13.5px; font-weight: 600; color: #ffffff; margin-bottom: 12px;">
            Résumé de la note de version
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            <!-- Ligne 1 : SÉCURITÉ -->
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <span style="
                background: rgba(239, 68, 68, 0.18);
                color: #f87171;
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 0.05em;
                padding: 3px 8px;
                border-radius: 5px;
                min-width: 78px;
                text-align: center;
                flex-shrink: 0;
                margin-top: 1px;
              ">SÉCURITÉ</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 13px; font-weight: 600; color: #ffffff;">
                  Injection SQL dans l'éditeur de blocs
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px; line-height: 1.5;">
                  Un contributeur pouvait exécuter une requête arbitraire via un attribut de bloc. Signalée par l'équipe sécurité WordPress.
                </div>
              </div>
            </div>

            <!-- Ligne 2 : SÉCURITÉ -->
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <span style="
                background: rgba(239, 68, 68, 0.18);
                color: #f87171;
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 0.05em;
                padding: 3px 8px;
                border-radius: 5px;
                min-width: 78px;
                text-align: center;
                flex-shrink: 0;
                margin-top: 1px;
              ">SÉCURITÉ</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 13px; font-weight: 600; color: #ffffff;">
                  XSS stocké dans les commentaires
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px; line-height: 1.5;">
                  Le filtrage des liens ne couvrait pas les protocoles data: sur les commentaires imbriqués.
                </div>
              </div>
            </div>

            <!-- Ligne 3 : CORRECTIF -->
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <span style="
                background: rgba(56, 189, 248, 0.15);
                color: #38bdf8;
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 0.05em;
                padding: 3px 8px;
                border-radius: 5px;
                min-width: 78px;
                text-align: center;
                flex-shrink: 0;
                margin-top: 1px;
              ">CORRECTIF</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 13px; font-weight: 600; color: #ffffff;">
                  42 corrections de bugs
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px; line-height: 1.5;">
                  Éditeur de site, requêtes de blocs, gestion des révisions et téléchargement de médias volumineux.
                </div>
              </div>
            </div>

            <!-- Ligne 4 : NOUVEAUTÉ -->
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <span style="
                background: rgba(34, 197, 94, 0.15);
                color: #4ade80;
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 0.05em;
                padding: 3px 8px;
                border-radius: 5px;
                min-width: 78px;
                text-align: center;
                flex-shrink: 0;
                margin-top: 1px;
              ">NOUVEAUTÉ</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 13px; font-weight: 600; color: #ffffff;">
                  Interface d'administration retravaillée
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px; line-height: 1.5;">
                  Nouvelle navigation des styles globaux et écran de gestion des polices.
                </div>
              </div>
            </div>

            <!-- Ligne 5 : TECHNIQUE -->
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <span style="
                background: rgba(234, 179, 8, 0.15);
                color: #facc15;
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 0.05em;
                padding: 3px 8px;
                border-radius: 5px;
                min-width: 78px;
                text-align: center;
                flex-shrink: 0;
                margin-top: 1px;
              ">TECHNIQUE</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 13px; font-weight: 600; color: #ffffff;">
                  PHP 8.1 minimum
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 2px; line-height: 1.5;">
                  Les sites en PHP 8.0 doivent d'abord changer d'image avant la mise à jour.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section Sites concernés -->
        <div style="
          margin-top: 22px;
          background: #0d131f;
          border: 1px solid #1e293b;
          border-radius: 10px;
          padding: 16px 18px;
        ">
          <div style="font-size: 13.5px; font-weight: 600; color: #ffffff; margin-bottom: 14px;">
            Sites concernés
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${displaySites.map(s => {
              const isUpToDate = s.wpVersion === '7.1'
              const isBusy = updatingSites.has(s.path)

              return `
                <div style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 14px;
                ">
                  <!-- Nom avec puce colorée -->
                  <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                    <span style="
                      width: 7px; height: 7px; border-radius: 50%;
                      background: ${isUpToDate ? '#4ade80' : '#f59e0b'};
                      flex-shrink: 0;
                    "></span>
                    <span style="
                      font-size: 13.5px;
                      font-weight: 600;
                      color: #ffffff;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    ">${s.name}</span>
                  </div>

                  <!-- Version actuelle / cible -->
                  <div style="
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 13px;
                    flex: 1;
                    text-align: center;
                    color: ${isUpToDate ? '#64748b' : '#f59e0b'};
                  ">
                    ${isUpToDate ? 'à jour (7.1)' : `${s.wpVersion} → 7.1`}
                  </div>

                  <!-- Bouton Mettre à jour -->
                  <div style="width: 120px; text-align: right;">
                    ${!isUpToDate ? `
                      <button
                        type="button"
                        class="btn btn-sm"
                        style="
                          background: #1e293b;
                          border: 1px solid #334155;
                          color: #ffffff;
                          padding: 5px 14px;
                          border-radius: 6px;
                          font-size: 12px;
                          font-weight: 500;
                          cursor: pointer;
                          transition: background 0.15s, border-color 0.15s;
                        "
                        ${isBusy ? 'disabled' : ''}
                        onmouseenter="this.style.background='#334155'"
                        onmouseleave="this.style.background='#1e293b'"
                        onclick="window.wpTriggerUpdateModalSite('${s.path.replace(/\\/g, '\\\\')}', ${s.isReal})"
                      >
                        ${isBusy ? '<span class="animate-spin" style="display:inline-block;">🔄</span>' : 'Mettre à jour'}
                      </button>
                    ` : ''}
                  </div>
                </div>
              `
            }).join('')}
          </div>
        </div>

        <!-- Pied de page -->
        <div style="
          margin-top: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 4px;
        ">
          <div style="font-size: 12px; color: #64748b;">
            Vérifié auprès de wordpress.org il y a 4 minutes.
          </div>
          <button
            type="button"
            style="
              background: none;
              border: none;
              color: #94a3b8;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              padding: 4px 8px;
              border-radius: 4px;
            "
            onmouseenter="this.style.color='#ffffff'"
            onmouseleave="this.style.color='#94a3b8'"
            onclick="window.wpCloseVersionModal()"
          >
            Fermer
          </button>
        </div>
      </div>
    `
  }

  // Handler pour déclencher la mise à jour d'un site depuis la modale
  window.wpTriggerUpdateModalSite = async (sitePath, isReal) => {
    if (!isReal) {
      // Pour les sites d'exemple de prévisualisation
      updatingSites.add(sitePath)
      render()
      setTimeout(() => {
        updatingSites.delete(sitePath)
        render()
      }, 1200)
      return
    }

    const realSite = state.sites.find(s => s.path === sitePath)
    if (!realSite) return

    updatingSites.add(sitePath)
    render()

    try {
      const updatedSite = await invoke('update_site_stack', {
        composeDir: realSite.compose_dir || realSite.path,
        targetWp: '7.1',
        targetPhp: '8.4',
      })

      if (updatedSite) {
        realSite.wp_version = updatedSite.wp_version || '7.1'
        realSite.php_version = updatedSite.php_version || 'PHP 8.4'
      } else {
        realSite.wp_version = '7.1'
      }

      if (window.wpScanWorkspaces) {
        await window.wpScanWorkspaces()
      }
    } catch (err) {
      alert(`Erreur lors de la mise à jour de ${realSite.name} : ${err}`)
    } finally {
      updatingSites.delete(sitePath)
      render()
    }
  }

  window.wpCloseVersionModal = () => {
    modalOverlay.remove()
  }

  render()
  document.body.appendChild(modalOverlay)
}

// Exposer sur window pour être joignable depuis tous les boutons
window.showWpVersionModal = showWpVersionModal
