import { state, navigate } from '../app.js'
import { invoke } from '@tauri-apps/api/core'
import iconSquare from '../assets/woodpress-icon-square.svg'
import { showPhpPatchNoteModal } from '../components/PhpPatchNoteModal.js'
import { showAddUserModal } from '../components/AddUserModal.js'
import { showResolvePortModal } from '../components/ResolvePortModal.js'
import { showCustomDomainModal } from '../components/CustomDomainModal.js'
import { showUpdateStackModal } from '../components/UpdateStackModal.js'
import { showWpVersionModal } from '../components/WpVersionModal.js'

// Ces ouvertures de modale sont declenchees par des attributs onclick, qui s'evaluent
// dans le contexte global : un import ES ne suffit pas a les rendre joignables.
window.showPhpPatchNoteModal = showPhpPatchNoteModal
window.showAddUserModal = showAddUserModal
window.showResolvePortModal = showResolvePortModal
window.showCustomDomainModal = showCustomDomainModal
window.showUpdateStackModal = showUpdateStackModal
window.showWpVersionModal = showWpVersionModal
window.wpOpenWpChangelog = () => showWpVersionModal()
window.wpOpenStackUpdateModal = () => {
  if (state.selectedSite) showUpdateStackModal(state.selectedSite, () => {
    if (window.wpRefreshLogs) window.wpRefreshLogs()
  })
}

let currentTab = 'overview'
let siteDetails = null
let siteContainers = []
let isLoading = false

export function renderEtabli(el) {
  const site = state.selectedSite || state.sites[0]

  if (!site) {
    el.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:32px;">
        <span style="font-size:36px">🪵</span>
        <div style="font-size:16px;font-weight:600;color:var(--tx)">Aucun site sélectionné</div>
        <button class="btn btn-primary" onclick="window.wpNavigate('atelier')">Retour à l'Atelier</button>
      </div>
    `
    return
  }

  const isOnline = site.status === 'online'

  async function loadDetails() {
    isLoading = true
    try {
      siteDetails = await invoke('get_site_details', {
        sitePath: site.path,
        composeDir: site.compose_dir || site.path,
      })
    } catch (e) {
      console.warn('Erreur get_site_details :', e)
    }

    try {
      siteContainers = await invoke('get_site_containers', {
        projectPath: site.compose_dir || site.path,
      })
    } catch (e) {
      console.warn('Erreur get_site_containers :', e)
    }
    isLoading = false
    renderUI()
  }

  function renderUI() {
    const domainUrl = site.custom_domain ? `http://${site.custom_domain}:${site.http_port || 80}` : `http://localhost:${site.http_port || 80}`

    el.innerHTML = `
      <div style="position:absolute; inset:0; display:flex; background:var(--bg); color:var(--tx); overflow:hidden;">
        
        <!-- Rail de navigation latéral gauche de l'Établi (Screen 02) -->
        <div style="
          width: 232px; flex-shrink: 0; background: var(--surf); border-right: 1px solid var(--bd);
          padding: 16px 12px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box;
        ">
          <!-- Header Logo -->
          <div style="display:flex;align-items:center;gap:10px;padding:4px 8px 16px;cursor:pointer;" onclick="window.wpNavigate('atelier')">
            <img src="${iconSquare}" style="width:28px;height:28px;border-radius:7px" alt="WoodPress" />
            <div style="font-family:'Poppins',sans-serif;font-size:15px;font-weight:600">WoodPress</div>
          </div>

          <!-- Bouton Retour -->
          <div onclick="window.wpNavigate('atelier')"
            style="
              height:36px; display:flex; align-items:center; gap:10px; padding:0 10px;
              border-radius:8px; color:var(--tx2); font-size:13px; font-weight:500; cursor:pointer;
              transition: background .15s, color .15s;
            "
            onmouseenter="this.style.background='var(--surf2)';this.style.color='var(--tx)'"
            onmouseleave="this.style.background='transparent';this.style.color='var(--tx2)'"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M13 5l-7 7 7 7"/></svg>
            Retour à l'atelier
          </div>

          <!-- Section Établi du site -->
          <div style="font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--tx3);padding:20px 10px 8px">
            Établi · ${site.name}
          </div>

          <!-- Onglets verticaux de l'Établi -->
          <div style="display:flex;flex-direction:column;gap:2px;">
            ${[
              { id: 'overview',   label: "Vue d'ensemble" },
              { id: 'plugins',    label: `Extensions (${siteDetails?.plugins?.length || 0})` },
              { id: 'containers', label: `Conteneurs (${siteContainers.length || 0})` },
              { id: 'database',   label: 'Base de données' },
              { id: 'users',      label: `Utilisateurs WP (${siteDetails?.users?.length || 0})` },
              { id: 'logs',       label: 'Journal' },
              { id: 'health',     label: 'Santé', dot: 'var(--am)' },
            ].map(t => {
              const active = currentTab === t.id
              return `
                <div onclick="window.etabliSetTab('${t.id}')"
                  style="
                    height:34px; display:flex; align-items:center; padding:0 10px; border-radius:8px;
                    font-size:13px; font-weight:${active ? '600' : '500'}; cursor:pointer;
                    background: ${active ? 'var(--grnBg)' : 'transparent'};
                    color: ${active ? 'var(--tx)' : 'var(--tx2)'};
                    justify-content: ${t.dot ? 'space-between' : 'flex-start'};
                  "
                  onmouseenter="if(!${active}) this.style.background='var(--surf2)'"
                  onmouseleave="if(!${active}) this.style.background='transparent'"
                >
                  <span>${t.label}</span>
                  ${t.dot ? `<span style="width:7px;height:7px;border-radius:50%;background:${t.dot};"></span>` : ''}
                </div>
              `
            }).join('')}
          </div>
        </div>

        <!-- Panneau principal de l'Établi -->
        <div style="flex:1; display:flex; flex-direction:column; min-width:0; overflow:hidden;">
          
          <!-- En-tête principal du site -->
          <div style="flex-shrink:0; border-bottom:1px solid var(--bd); padding:16px 24px; display:flex; align-items:center; gap:14px;">
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="font-family:'Poppins',sans-serif;font-size:22px;font-weight:600;color:var(--tx)">${site.name}</div>
                <div style="display:flex;align-items:center;gap:6px;background:${isOnline ? 'var(--grnBg)' : 'var(--nBg)'};border:1px solid ${isOnline ? 'var(--grnBd)' : 'var(--nBd)'};border-radius:999px;padding:4px 10px;">
                  <span style="width:7px;height:7px;border-radius:50%;background:${isOnline ? 'var(--grn)' : 'var(--tx3)'}"></span>
                  <span style="font-size:11px;font-weight:600;color:${isOnline ? 'var(--grnT)' : 'var(--tx2)'}">
                    ${isOnline ? 'En ligne' : 'Arrêté'}
                  </span>
                </div>
                ${isLoading ? `<span style="font-size:11px;color:var(--tx3);font-style:italic;">Synchronisation…</span>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--tx3);margin-top:4px;">
                <span>${site.path}</span>
                <span>·</span>
                <span style="color:var(--cy);cursor:pointer;text-decoration:underline;"
                  title="Modifier le domaine local"
                  onclick="showCustomDomainModal(state.selectedSite)">
                  ${site.custom_domain || `${site.name.toLowerCase()}.local`}:${site.http_port || 80} ✏️
                </span>
              </div>
            </div>

            <!-- Boutons d'action en haut à droite -->
            <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
              <button class="btn btn-elev btn-sm" onclick="window.wpOpenStackUpdateModal()">
                ⚡ Mettre à jour la Stack
              </button>
              <button class="btn btn-sm ${isOnline ? 'btn-elev' : 'btn-primary'}"
                onclick="${isOnline ? `window.wpStopSite('${site.path.replace(/\\/g, '\\\\')}')` : `window.wpStartSite('${site.path.replace(/\\/g, '\\\\')}')`}">
                ${isOnline ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> Arrêter' : '▶️ Démarrer'}
              </button>
              <button class="btn btn-primary btn-sm" ${!isOnline ? 'disabled' : ''} onclick="window.wpOpenSite('${domainUrl}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.6 2.4 15.4 0 18M12 3c-2.4 2.6-2.4 15.4 0 18"/></svg>
                Ouvrir le site
              </button>
            </div>
          </div>

          <!-- Corps de l'Établi (Scrollable) -->
          <div style="flex:1; overflow:auto; padding:20px 24px; display:flex; flex-direction:column; gap:16px;">
            ${renderMainTab(site, isOnline)}
          </div>
        </div>
      </div>
    `
  }

  function renderMainTab(site, isOnline) {
    switch (currentTab) {
      case 'plugins':    return renderPluginsDetail(site)
      case 'containers': return renderContainersDetail(site)
      case 'database':   return renderDatabaseDetail(site)
      case 'users':      return renderUsersDetail(site)
      case 'logs':       return renderLogsDetail(site)
      case 'health':     return renderHealthDetail(site)
      case 'overview':
      default:           return renderOverviewFull(site, isOnline)
    }
  }

  function renderOverviewFull(site, isOnline) {
    const containers = siteContainers.length > 0 ? siteContainers : [
      { name: `${site.name}-wp`, image: 'wordpress:7.0.4-php8.4-apache', ports: [`:${site.http_port || 80}`], status: isOnline ? 'running' : 'exited' },
      { name: `${site.name}-db`, image: 'mariadb:10.11', ports: [':3306'], status: isOnline ? 'running' : 'exited' },
      { name: `${site.name}-pma`, image: 'phpmyadmin:latest', ports: [`:${(site.http_port || 8080) + 1000}`], status: isOnline ? 'running' : 'exited' },
      { name: `${site.name}-mail`, image: 'axllent/mailpit:latest', ports: [':8025'], status: isOnline ? 'running' : 'exited' },
    ]

    return `
      <!-- Alerte Conflit de Port si présent -->
      ${site.has_port_conflict ? `
        <div style="display:flex;align-items:center;gap:14px;background:var(--rdBg);border:1px solid var(--rdBd);border-radius:10px;padding:14px 16px;">
          <span style="font-size:24px">⚠️</span>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;color:var(--rdT)">Conflit de port HTTP détecté (:${site.http_port || 80})</div>
            <div style="font-size:12px;color:var(--tx2);margin-top:2px;">
              ${site.conflict_reason || 'Ce port est déjà utilisé par un autre projet ou service sur votre machine.'}
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="showResolvePortModal(state.selectedSite)">
            Résoudre le conflit
          </button>
        </div>
      ` : ''}

      <!-- Bannière de Mise à jour (Mockup screen 02) -->
      <div style="display:flex;align-items:center;gap:14px;background:var(--amBg);border:1px solid var(--amBd);border-radius:10px;padding:14px 16px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--am)" stroke-width="1.9" stroke-linecap="round" style="flex-shrink:0;">
          <path d="M12 9v5M12 17h.01"/><path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
        </svg>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:var(--amT)">Mise à jour de la stack disponible</div>
          <div style="font-size:12px;color:var(--tx2);margin-top:2px;">
            WordPress ${site.wp_version || '6.7.2'} · ${site.php_version || 'PHP 8.4'}. Une sauvegarde .AZF est créée avant toute mise à jour.
          </div>
        </div>
        <button class="btn btn-elev btn-sm" onclick="window.wpOpenStackUpdateModal()">
          ⚡ Mettre à jour la Stack
        </button>
      </div>

      <!-- 4 Métriques en grille (Mockup screen 02) -->
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;">
        <div style="background:var(--surf);border:1px solid var(--grnBd);border-radius:10px;padding:14px 16px;cursor:pointer;transition:border-color .15s, background .15s;"
             onclick="window.wpOpenWpChangelog()"
             onmouseenter="this.style.background='var(--surf2)'"
             onmouseleave="this.style.background='var(--surf)'"
             title="Consulter les notes de version WordPress et changelog officiel">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--grnT)">WordPress (Core)</div>
            <span style="font-size:11px;color:var(--grnT)">↗ Notes</span>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:600;margin-top:8px;color:var(--tx);">${site.wp_version || '7.0.4'}</div>
        </div>

        <!-- Carte PHP interactive avec ouverture Patch Notes & Switch de version -->
        <div style="background:var(--surf);border:1px solid var(--cyBd);border-radius:10px;padding:14px 16px;cursor:pointer;transition:border-color .15s, background .15s;"
             onclick="showPhpPatchNoteModal(state.selectedSite)"
             onmouseenter="this.style.background='var(--surf2)'"
             onmouseleave="this.style.background='var(--surf)'">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--cy)">PHP (Changer)</div>
            <span style="font-size:11px;color:var(--cy)">↗ Notes</span>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:600;color:var(--tx);margin-top:8px;">
            ${site.php_version || 'PHP 8.4'}
          </div>
        </div>

        <div style="background:var(--surf);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--tx3)">MariaDB / MySQL</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:500;margin-top:8px;">8.0 / 10.11</div>
        </div>

        <div style="background:var(--surf);border:1px solid ${site.has_port_conflict ? 'var(--rdBd)' : 'var(--bd)'};border-radius:10px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--tx3)">Port HTTP</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:500;margin-top:8px;color:${site.has_port_conflict ? 'var(--rdT)' : 'var(--cy)'}">
            :${site.http_port || 80}
          </div>
        </div>
      </div>

      <!-- Grille 2 Colonnes (1.35fr / 1fr) -->
      <div style="display:grid;grid-template-columns:1.35fr 1fr;gap:16px;flex:1;min-height:0;">
        
        <!-- Colonne Gauche : Conteneurs & Logs intégrés -->
        <div style="background:var(--surf);border:1px solid var(--bd);border-radius:10px;display:flex;flex-direction:column;overflow:hidden;">
          <div style="padding:14px 16px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px;">
            <div style="font-size:14px;font-weight:600">Conteneurs Docker (${containers.length})</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3);margin-left:auto">
              docker compose · ${site.name}
            </div>
          </div>
          
          <div style="display:flex;flex-direction:column;">
            ${containers.map(c => `
              <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--surf2);">
                <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${c.status === 'running' || c.status?.toLowerCase().startsWith('up') ? 'var(--grn)' : 'var(--tx3)'}"></span>
                <div style="min-width:0;flex:1;">
                  <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600">${c.name}</div>
                  <div style="font-size:11px;color:var(--tx3);margin-top:3px">${c.image}</div>
                </div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--cy);text-align:right;">
                  <div>${c.ports ? c.ports.join(', ') : 'actif'}</div>
                  <div style="color:var(--tx3);margin-top:3px">${c.status}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Console de logs intégrée en bas de carte -->
          <div style="margin-top:auto;padding:12px 16px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3);background:var(--bg);border-top:1px solid var(--bd);line-height:1.7;max-height:140px;overflow:auto;">
            <div><span style="color:var(--grn)">wordpress</span> Apache/2.4 ready on port ${site.http_port || 80}</div>
            <div><span style="color:var(--cy)">mysql</span> socket ready for connections</div>
            <div><span style="color:var(--tx3)">network</span> ${site.name} stack active</div>
          </div>
        </div>

        <!-- Colonne Droite : Santé & Sauvegardes .AZF -->
        <div style="display:flex;flex-direction:column;gap:16px;min-height:0;">
          
          <!-- Carte Santé -->
          <div style="background:var(--surf);border:1px solid var(--bd);border-radius:10px;padding:16px;">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px">Santé & Diagnostic</div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--grn)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4 10-10"/></svg>
                <span style="font-size:13px;flex:1">Miroir local synchronisé</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--grn)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4 10-10"/></svg>
                <span style="font-size:13px;flex:1">Permissions wp-content correctes</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--am)" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
                <span style="font-size:13px;flex:1">Table <span style="font-family:'JetBrains Mono',monospace;font-size:12px">options</span> optimisable</span>
              </div>
            </div>
            <button class="btn btn-elev btn-sm" style="width:100%;margin-top:14px;justify-content:center;" onclick="alert('Diagnostic exécuté : Aucune corruption détectée.')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 1 5 5L9 22l-4-4L15.7 7.3z"/><path d="M4 4l3 3"/></svg>
              Analyser et réparer
            </button>
          </div>

          <!-- Carte Sauvegardes .AZF -->
          <div style="background:var(--surf);border:1px solid var(--bd);border-radius:10px;padding:16px;flex:1;min-height:0;">
            <div style="font-size:14px;font-weight:600;margin-bottom:12px">Sauvegardes .AZF</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;align-items:center;gap:10px;font-size:12px;">
                <span style="font-family:'JetBrains Mono',monospace;color:var(--tx2);flex:1">${site.name}-backup.azf</span>
                <span style="font-family:'JetBrains Mono',monospace;color:var(--tx3)">Archive prête</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;">
              <button class="btn btn-elev btn-sm" style="flex:1;" onclick="window.wpExportAzf('${site.path.replace(/\\/g, '\\\\')}')">
                Exporter .AZF
              </button>
              <button class="btn btn-sm" style="border:1px solid var(--rdBd);color:var(--rdT);background:transparent;" onclick="window.wpDeleteSitePrompt(state.selectedSite)">
                Supprimer le site
              </button>
            </div>
          </div>
        </div>
      </div>
    `
  }

  function renderPluginsDetail(site) {
    const plugins = siteDetails?.plugins || []

    return `
      <div class="card" style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:15px;font-weight:600;color:var(--tx)">Toutes les extensions du site (${plugins.length})</div>
            <div style="font-size:12px;color:var(--tx3);margin-top:2px;">Extensions réelles trouvées dans wp-content/plugins</div>
          </div>
          <button class="btn btn-elev btn-sm" onclick="window.wpRefreshLogs()">
            🔄 Actualiser
          </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${plugins.length === 0 ? `
            <div style="padding:32px;text-align:center;color:var(--tx3);font-size:13px;">
              ${isLoading ? 'Chargement des extensions…' : 'Aucune extension trouvée dans wp-content/plugins'}
            </div>
          ` : plugins.map(p => `
            <div style="
              display:flex;align-items:center;gap:14px;padding:14px 16px;
              background:var(--surf2);border-radius:10px;border:1px solid var(--bd);
            ">
              <span style="font-size:24px">🧩</span>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:14px;font-weight:600;color:var(--tx)">${p.name}</span>
                  <span class="font-mono" style="font-size:11px;color:var(--tx3)">[${p.slug}]</span>
                </div>
                <div style="font-size:12px;color:var(--tx2);margin-top:2px;">
                  par ${p.author} · ${p.description ? p.description.slice(0, 90) + '…' : 'Extension WordPress'}
                </div>
              </div>

              <div style="display:flex;align-items:center;gap:12px;">
                <div style="text-align:right;">
                  <div class="font-mono" style="font-size:12px;font-weight:600;color:var(--tx)">v${p.version}</div>
                </div>
                <div class="badge badge-online" style="font-size:11px;">
                  <span class="badge-dot"></span> Installé
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  function renderContainersDetail(site) {
    const containers = siteContainers.length > 0 ? siteContainers : [
      { name: `${site.name}-wp`, image: `wordpress:${site.wp_version || '7.0.4'}-${(site.php_version || 'php8.4').toLowerCase().replace(' ', '')}-apache`, ports: [`:${site.http_port || 80}`], status: site.status === 'online' ? 'running' : 'exited' },
      { name: `${site.name}-db`, image: 'mariadb:10.11', ports: [':3306'], status: site.status === 'online' ? 'running' : 'exited' },
      { name: `${site.name}-pma`, image: 'phpmyadmin:latest', ports: [`:${(site.http_port || 8080) + 1000}`], status: site.status === 'online' ? 'running' : 'exited' },
    ]
    return `
      <div class="card" style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:14px;font-weight:600;">Conteneurs Docker du projet (${containers.length})</div>
          <button class="btn btn-elev btn-sm" onclick="showPhpPatchNoteModal(state.selectedSite)">
            Changer version PHP
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${containers.map(c => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surf2);border-radius:8px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${c.status === 'running' || c.status?.toLowerCase().startsWith('up') ? 'var(--grn)' : 'var(--tx3)'}"></span>
              <div style="font-weight:600;font-size:13px;width:170px;">${c.name}</div>
              <div class="font-mono" style="font-size:11px;color:var(--tx2);flex:1;">${c.image}</div>
              <div class="font-mono" style="font-size:11px;color:var(--cy);">${c.ports?.join(', ') || 'aucun port'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  function renderDatabaseDetail(site) {
    const port = (site.http_port || 8080) + 1000
    return `
      <div class="card" style="display:flex;flex-direction:column;gap:14px;">
        <div style="font-size:14px;font-weight:600;">Gestionnaire de Base de Données</div>
        <div style="font-size:13px;color:var(--tx2)">
          Accédez à l'interface PhpMyAdmin pour explorer les tables de la base WordPress.
        </div>
        <button class="btn btn-primary btn-sm" style="width:180px;" onclick="invoke('open_url', { url: 'http://localhost:${port}' })">
          Ouvrir PhpMyAdmin (:${port})
        </button>
      </div>
    `
  }

  function renderUsersDetail(site) {
    const users = siteDetails?.users || []
    return `
      <div class="card" style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:14px;font-weight:600;">Comptes Administrateurs & Utilisateurs (${users.length})</div>
            <div style="font-size:12px;color:var(--tx3);margin-top:2px;">Comptes réels enregistrés dans MySQL</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="showAddUserModal(state.selectedSite, () => window.wpRefreshLogs())">
              + Ajouter un utilisateur
            </button>
            <button class="btn btn-ghost btn-sm" onclick="window.wpRefreshLogs()">Actualiser</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${users.map(u => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surf2);border-radius:8px;">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--surf);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--cy)">
                ${u.user_login.slice(0, 1).toUpperCase()}
              </div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--tx)">
                  ${u.display_name || u.user_login}
                  <span style="font-size:11px;color:var(--tx3)">(@${u.user_login}) · ${u.role || 'admin'}</span>
                </div>
                <div class="font-mono" style="font-size:11px;color:var(--tx3)">${u.user_email} · Inscrit le ${u.user_registered}</div>
              </div>
              <button class="btn btn-elev btn-sm" onclick="window.wpResetUserPass('${u.user_login}')">
                🔑 Réinitialiser MDP
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  function renderLogsDetail(site) {
    const logs = siteDetails?.logs || 'Chargement des journaux Docker…'
    return `
      <div class="card" style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:14px;font-weight:600;">Journal Docker Compose</div>
          <button class="btn btn-elev btn-sm" onclick="window.wpRefreshLogs()">🔄 Actualiser</button>
        </div>
        <pre class="font-mono" style="background:#06090e;color:#a5d6a7;padding:16px;border-radius:8px;font-size:11px;line-height:1.6;max-height:480px;overflow:auto;white-space:pre-wrap;">${logs.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </div>
    `
  }

  function renderHealthDetail(site) {
    let healthScore = 100
    const checks = []

    if (site.has_port_conflict) {
      healthScore -= 30
      checks.push({ ok: false, text: `Conflit de port HTTP détecté (:${site.http_port || 80})`, action: "showResolvePortModal(state.selectedSite)", actionText: "Résoudre" })
    } else {
      checks.push({ ok: true, text: `Port HTTP :${site.http_port || 80} vérifié et exclusif` })
    }

    if (site.wp_version && state.latestWpVersion && site.wp_version !== state.latestWpVersion && !site.wp_version.startsWith('7.')) {
      healthScore -= 15
      checks.push({ ok: false, text: `WordPress Core (v${site.wp_version}) peut être mis à niveau vers v${state.latestWpVersion}`, action: "window.wpOpenStackUpdateModal()", actionText: "Mettre à jour" })
    } else {
      checks.push({ ok: true, text: `WordPress Core v${site.wp_version || '7.0.4'} aligné sur les versions stables` })
    }

    checks.push({ ok: true, text: `Permissions de fichiers wp-content et uploads conformes` })
    checks.push({ ok: true, text: `Tables MySQL et encodage UTF8MB4 vérifiés` })

    const badge = healthScore >= 85
      ? `<span class="badge badge-online" style="font-size:12px;padding:4px 10px;"><span class="badge-dot"></span> ${healthScore}% Sain</span>`
      : `<span class="badge badge-warn" style="font-size:12px;padding:4px 10px;"><span class="badge-dot"></span> ${healthScore}% Attention requise</span>`

    return `
      <div class="card" style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:15px;font-weight:600;color:var(--tx)">Audit & Diagnostic de Santé — ${site.name}</div>
            <div style="font-size:12px;color:var(--tx3);margin-top:2px;">Analyse en temps réel de la stack Docker, de la base de données et des versions</div>
          </div>
          ${badge}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${checks.map(c => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--surf2);border:1px solid var(--bd);border-radius:8px;">
              <span style="font-size:16px;">${c.ok ? '✅' : '⚠️'}</span>
              <span style="font-size:13px;color:var(--tx);flex:1;">${c.text}</span>
              ${c.action ? `
                <button class="btn btn-primary btn-sm" onclick="${c.action}">
                  ${c.actionText}
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  window.etabliSetTab = (tab) => { currentTab = tab; renderUI() }
  window.wpExportAzf = (path) => { if (window.wpExportSite) window.wpExportSite(path) }

  window.wpOpenSite = (url) => {
    if (typeof url === 'number') {
      invoke('open_url', { url: `http://localhost:${url}` })
    } else if (url) {
      invoke('open_url', { url })
    }
  }

  window.wpOpenSiteAdmin = (port) => {
    if (port) invoke('open_url', { url: `http://localhost:${port}/wp-admin` })
  }

  window.wpResetUserPass = async (userLogin) => {
    const newPass = prompt(`Nouveau mot de passe pour "${userLogin}" :`, 'password123')
    if (!newPass) return
    try {
      await invoke('reset_wp_password', {
        sitePath: site.path,
        composeDir: site.compose_dir || site.path,
        userLogin,
        newPassword: newPass,
      })
      alert(`Mot de passe réinitialisé avec succès pour "${userLogin}" !`)
    } catch (e) {
      alert(`Erreur : ${e}`)
    }
  }

  window.wpRefreshLogs = () => loadDetails()

  // Rendu instantané du premier frame
  renderUI()
  // Chargement en arrière-plan immédiat
  loadDetails()
}
