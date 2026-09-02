import { state, navigate } from '../app.js'
import { renderSiteCard } from '../components/SiteCard.js'
import { showNewSiteModal } from '../components/NewSiteModal.js'
import { showImportModal } from '../components/ImportModal.js'
import { showPhpPatchNoteModal } from '../components/PhpPatchNoteModal.js'
import { showResolvePortModal } from '../components/ResolvePortModal.js'
import { showAddWorkspaceModal } from '../components/AddWorkspaceModal.js'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { getConfig } from '../configStore.js'

export function renderAtelier(el) {
  // Le dossier actif est porte par state.activeWorkspace, ecrit par la barre laterale.
  // Cette vue lisait state.currentWorkspace, qui n'existe nulle part : la comparaison
  // se faisait contre undefined et ecartait donc tous les sites.
  // null (ou vide) signifie « tous les dossiers ».
  const samePath = (a, b) =>
    (a || '').replace(/[\\/]+$/, '').toLowerCase() === (b || '').replace(/[\\/]+$/, '').toLowerCase()

  const activeWs = state.activeWorkspace
  const isAll = !activeWs || activeWs === 'all'
  const currentWs = state.workspaces.find(w => samePath(w.path, activeWs))

  const filtered = state.sites.filter(site => {
    // Comparaison insensible a la casse : sous Windows, « G:\Workspace » saisi par
    // l'utilisateur et le chemin renvoye par le scan peuvent differer de casse.
    const matchWs = isAll || samePath(site.workspace, activeWs)
    const matchQ  = !state.query || site.name.toLowerCase().includes(state.query.toLowerCase())
    return matchWs && matchQ
  })

  // Sélectionne par défaut le premier site si aucun n'est sélectionné
  if (!state.selectedSite && filtered.length > 0) {
    state.selectedSite = filtered[0]
  }

  const currentSelected = state.selectedSite || (filtered.length > 0 ? filtered[0] : null)
  const isSelectedOnline = currentSelected?.status === 'online'

  el.innerHTML = `
    <!-- Bannière de Scan en cours -->
    ${state.isScanning ? `
      <div style="background:var(--surf2);border-bottom:1px solid var(--bd);padding:9px 24px;font-size:12px;color:var(--cy);display:flex;align-items:center;gap:10px;">
        <span class="animate-spin" style="font-size:15px;display:inline-block;">🔄</span>
        <span>Scan des dossiers de travail et détection des conteneurs Docker en cours…</span>
      </div>
    ` : ''}

    <!-- En-tête de l'Atelier -->
    <div style="
      flex-shrink:0; border-bottom:1px solid var(--bd); padding:16px 24px;
      display:flex; align-items:center; justify-content:space-between; gap:16px;
    ">
      <div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-family:'Poppins',sans-serif;font-size:20px;font-weight:600;color:var(--tx);">
            ${isAll ? 'Tous les sites' : (currentWs?.name || 'Atelier')}
          </div>
          <span class="badge badge-stopped" style="font-size:12px;font-weight:600;">
            ${filtered.length} site${filtered.length > 1 ? 's' : ''}
          </span>
        </div>
        <div style="font-size:12px;color:var(--tx3);margin-top:2px;">
          ${isAll ? 'Vue consolidée de tous vos espaces de travail' : (currentWs?.path || '')}
        </div>
      </div>

      <!-- Actions globales -->
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="btn btn-elev btn-sm" ${state.isScanning ? 'disabled' : ''} onclick="window.wpScan()">
          ${state.isScanning ? '<span class="animate-spin" style="display:inline-block;">🔄</span> Scan…' : '🔄 Scanner'}
        </button>
        <button class="btn btn-elev btn-sm" onclick="window.wpOpenImport()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          Importer .AZF
        </button>
        <button class="btn btn-primary btn-sm" onclick="window.wpOpenNew()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Nouveau site
        </button>
      </div>
    </div>

    <!-- Barre d'outils (Filtres, Recherche, Switcher Grille/Liste) -->
    <div style="
      flex-shrink:0; padding:12px 24px; display:flex; align-items:center;
      justify-content:space-between; gap:12px; border-bottom:1px solid var(--bd);
    ">
      <div style="display:flex;align-items:center;gap:10px;flex:1;max-width:380px;">
        <div style="position:relative;width:100%;">
          <input
            id="wp-search"
            type="text"
            placeholder="Rechercher un site, port, domaine…"
            value="${state.query || ''}"
            class="input"
            style="padding-left:34px;height:34px;font-size:13px;"
          />
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
            style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--tx3);pointer-events:none;">
            <circle cx="11" cy="11" r="7"/><path d="M16 16l4 4"/>
          </svg>
        </div>
      </div>

      <!-- Switcher Grille / Liste -->
      <div style="display:flex;align-items:center;gap:4px;background:var(--surf);border:1px solid var(--bd);border-radius:8px;padding:2px;">
        <button class="btn btn-ghost btn-sm"
          style="padding:4px 8px;border-radius:6px;background:${state.layout === 'grid' ? 'var(--surf2)' : 'transparent'};color:${state.layout === 'grid' ? 'var(--tx)' : 'var(--tx3)'}"
          onclick="window.wpSetLayout('grid')">
          ⊞ Grille
        </button>
        <button class="btn btn-ghost btn-sm"
          style="padding:4px 8px;border-radius:6px;background:${state.layout === 'list' ? 'var(--surf2)' : 'transparent'};color:${state.layout === 'list' ? 'var(--tx)' : 'var(--tx3)'}"
          onclick="window.wpSetLayout('list')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- Contenu des sites -->
    <div style="flex:1;overflow:auto;padding:24px;">
      ${state.workspaces.length === 0 ? `
        <!-- Premier lancement : aucun dossier de travail declare -->
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;gap:14px;color:var(--tx3);text-align:center;">
          <span style="font-size:40px">📁</span>
          <div style="font-size:16px;font-weight:600;color:var(--tx)">Bienvenue dans WoodPress</div>
          <div style="font-size:13px;max-width:420px;line-height:1.6;">
            Indiquez le dossier dans lequel vous rangez vos projets WordPress.
            WoodPress y détectera automatiquement les sites existants, sous Docker comme en local.
          </div>
          <button class="btn btn-primary" onclick="window.wpOpenAddWorkspace()">Choisir mon dossier de travail</button>
        </div>
      ` : filtered.length === 0 ? `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:240px;gap:12px;color:var(--tx3);">
          <span style="font-size:36px">🪵</span>
          <div style="font-size:15px;font-weight:600;color:var(--tx)">Aucun site trouvé</div>
          <div style="font-size:13px">Lancez un scan de vos dossiers ou créez un nouveau projet WordPress.</div>
          <button class="btn btn-primary btn-sm" onclick="window.wpOpenNew()">+ Créer un site</button>
        </div>
      ` : state.layout === 'grid' ? `
        <!-- Grille de cartes -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:16px;">
          ${filtered.map(site => renderSiteCard(site, currentSelected && currentSelected.path === site.path)).join('')}
        </div>
      ` : `
        <!-- Vue Liste détaillée -->
        <div style="background:var(--surf);border:1px solid var(--bd);border-radius:10px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
            <thead>
              <tr style="background:var(--surf2);border-bottom:1px solid var(--bd);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--tx3);">
                <th style="padding:10px 16px;">Site / Projet</th>
                <th style="padding:10px 14px;">Statut</th>
                <th style="padding:10px 14px;">Port & Domaine</th>
                <th style="padding:10px 14px;">WordPress</th>
                <th style="padding:10px 14px;">PHP</th>
                <th style="padding:10px 16px;text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(site => {
                const isSel = currentSelected && currentSelected.path === site.path
                const isOnline = site.status === 'online'
                const isLegacy = site.is_legacy
                return `
                  <tr style="
                    border-bottom:1px solid var(--bd);cursor:pointer;
                    background:${isSel ? 'var(--surf2)' : 'transparent'};
                  "
                  onclick="window.wpSelectSite('${site.path.replace(/\\/g, '\\\\')}')"
                  onmouseenter="this.style.background='var(--surf2)'"
                  onmouseleave="this.style.background='${isSel ? 'var(--surf2)' : 'transparent'}'"
                  >
                    <td style="padding:12px 16px;">
                      <div style="font-weight:600;color:var(--tx)">${site.name}</div>
                      <div style="font-size:11px;color:var(--tx3);margin-top:2px;">${site.path}</div>
                    </td>
                    <td style="padding:12px 14px;">
                      <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:${isLegacy ? 'var(--am)' : isOnline ? 'var(--grnT)' : 'var(--tx3)'}">
                        <span style="width:7px;height:7px;border-radius:50%;background:${isLegacy ? 'var(--am)' : isOnline ? 'var(--grn)' : 'var(--tx3)'}"></span>
                        ${isLegacy ? (site.legacy_stack || 'Laragon/WAMP') : isOnline ? 'En ligne' : 'Arrêté'}
                      </span>
                    </td>
                    <td style="padding:12px 14px;font-family:'JetBrains Mono',monospace;font-size:12px;">
                      ${site.has_port_conflict ? `
                        <span style="color:var(--rdT);font-weight:600;" onclick="event.stopPropagation(); window.wpOpenResolvePort('${site.path.replace(/\\/g, '\\\\')}')">
                          ⚠️ :${site.http_port || 80} (Conflit)
                        </span>
                      ` : site.http_port ? `
                        <span style="color:var(--cy)">:${site.http_port}</span>
                      ` : `
                        <span style="color:var(--tx3)">Non assigné</span>
                      `}
                    </td>
                    <td style="padding:12px 14px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--tx2);">
                      v${site.wp_version || '6.7.2'}
                    </td>
                    <td style="padding:12px 14px;font-family:'JetBrains Mono',monospace;font-size:12px;">
                      ${!isLegacy ? `
                        <span style="color:var(--cy);text-decoration:underline;cursor:pointer;"
                          onclick="event.stopPropagation(); window.wpOpenPhpModal('${site.path.replace(/\\/g, '\\\\')}')">
                          ${site.php_version || 'PHP 8.4'} ↗
                        </span>
                      ` : `
                        <span style="color:var(--tx3)">${site.php_version || 'PHP 8.4'}</span>
                      `}
                    </td>
                    <td style="padding:12px 16px;text-align:right;" onclick="event.stopPropagation()">
                      <div style="display:inline-flex;gap:6px;">
                        ${isLegacy ? `
                          <button class="btn btn-primary btn-sm" onclick="window.wpOpenContainerizeModal('${site.path.replace(/\\/g, '\\\\')}')">
                            ⚡ Conteneuriser
                          </button>
                        ` : `
                          <button class="btn btn-elev btn-sm"
                            onclick="${isOnline ? `window.wpStopSite('${site.path.replace(/\\/g, '\\\\')}')` : `window.wpStartSite('${site.path.replace(/\\/g, '\\\\')}')`}">
                            ${isOnline ? 'Arrêter' : 'Démarrer'}
                          </button>
                          <button class="btn btn-primary btn-sm" ${!isOnline ? 'disabled' : ''}
                            onclick="window.wpOpenSiteAdmin(${site.http_port})">
                            Admin
                          </button>
                          <button class="btn btn-ghost btn-sm" style="padding:4px 8px;" title="Ouvrir dans l'Établi"
                            onclick="window.wpOpenEtabliForSite('${site.path.replace(/\\/g, '\\\\')}')">
                            🔍
                          </button>
                        `}
                      </div>
                    </td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>

    <!-- Barre d'actions contextuelle en bas (TOUJOURS VISIBLE selon la maquette) -->
    ${currentSelected ? `
      <div style="
        flex-shrink:0; border-top:1px solid var(--bd); background:var(--surf);
        padding:12px 20px; display:flex; align-items:center; gap:10px;
      ">
        <div style="display:flex;align-items:center;gap:10px;padding-right:14px;border-right:1px solid var(--bd);margin-right:4px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${isSelectedOnline ? 'var(--grn)' : currentSelected.is_legacy ? 'var(--am)' : 'var(--tx3)'}"></span>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--tx)">${currentSelected.name}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3)">
              ${currentSelected.http_port ? `:${currentSelected.http_port}` : (currentSelected.legacy_stack || 'Non conteneurisé')} · sélectionné
            </div>
          </div>
        </div>

        ${!currentSelected.is_legacy ? `
          <button class="btn btn-elev btn-sm"
            style="${!isSelectedOnline ? 'opacity:.45;pointer-events:none' : ''}"
            onclick="window.wpOpenSiteAdmin(${currentSelected.http_port})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cy)" stroke-width="1.8" stroke-linecap="round"><path d="M15 7h2a5 5 0 0 1 0 10h-2M9 17H7A5 5 0 0 1 7 7h2M8 12h8"/></svg>
            WP-Admin
          </button>

          <button class="btn btn-elev btn-sm"
            style="${!isSelectedOnline ? 'opacity:.45;pointer-events:none' : ''}"
            onclick="window.wpOpenPhpMyAdmin(${currentSelected.http_port})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>
            Base
          </button>

          <button class="btn btn-elev btn-sm"
            style="${!isSelectedOnline ? 'opacity:.45;pointer-events:none' : ''}"
            onclick="window.wpOpenMailpit()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 8l9 6 9-6"/></svg>
            Mails
          </button>
        ` : `
          <button class="btn btn-primary btn-sm" onclick="window.wpOpenContainerizeModal('${currentSelected.path.replace(/\\/g, '\\\\')}')">
            ⚡ Conteneuriser Docker
          </button>
        `}

        <button class="btn btn-elev btn-sm" onclick="window.wpOpenInIde('${currentSelected.path.replace(/\\/g, '\\\\')}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l-5-6 5-6M15 6l5 6-5 6"/></svg>
          IDE
        </button>

        <button class="btn btn-elev btn-sm" onclick="window.wpOpenFolder('${currentSelected.path.replace(/\\/g, '\\\\')}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h6l2 2h10v11H3z"/></svg>
          Dossier
        </button>

        ${!currentSelected.is_legacy ? `
          <button class="btn btn-elev btn-sm" style="margin-left:auto;" onclick="window.wpOpenEtabliForSite('${currentSelected.path.replace(/\\/g, '\\\\')}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M16 16l4 4"/></svg>
            Établi
          </button>
        ` : ''}

        <button class="btn btn-elev btn-sm" style="padding:4px 8px;margin-left:${currentSelected.is_legacy ? 'auto' : '0'};" onclick="window.wpToggleCardMenu('${currentSelected.path.replace(/\\/g, '\\\\')}', event)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>
        </button>
      </div>
    ` : ''}
  `

  // Recherche : le rendu reconstruit tout le HTML, donc le champ lui-meme.
  // On restaure le focus et la position du curseur pour que la saisie reste continue.
  document.getElementById('wp-search')?.addEventListener('input', (e) => {
    state.query = e.target.value
    const caret = e.target.selectionStart
    renderAtelier(el)
    const again = document.getElementById('wp-search')
    if (again) {
      again.focus()
      try { again.setSelectionRange(caret, caret) } catch {}
    }
  })

  // Switcher Grille/Liste
  window.wpSetLayout = (l) => {
    state.layout = l
    renderAtelier(el)
  }

  // Handlers
  window.wpScan = () => {
    if (window.wpScanWorkspaces) {
      window.wpScanWorkspaces()
    }
  }

  window.wpOpenAddWorkspace = () => showAddWorkspaceModal()
  window.wpOpenNew = () => showNewSiteModal()
  window.wpOpenImport = () => showImportModal()

  window.wpStartSite = async (path) => {
    const site = state.sites.find(s => s.path === path)
    if (site) {
      site.status = 'starting'
      renderAtelier(el)
      try {
        await invoke('start_site', { path })
        site.status = 'online'
      } catch (e) {
        site.status = 'error'
        console.error('start_site:', e)
      }
      renderAtelier(el)
      // Polling automatique pour synchroniser l'état réel des conteneurs
      setTimeout(() => window.wpScan(), 800)
      setTimeout(() => window.wpScan(), 2500)
    }
  }

  window.wpStopSite = async (path) => {
    const site = state.sites.find(s => s.path === path)
    if (site) {
      site.status = 'stopped'
      renderAtelier(el)
      try {
        await invoke('stop_site', { path })
      } catch (e) {
        console.error('stop_site:', e)
      }
      renderAtelier(el)
      setTimeout(() => window.wpScan(), 800)
    }
  }

  window.wpOpenSiteAdmin = (port) => {
    if (port) invoke('open_url', { url: `http://localhost:${port}/wp-admin` })
  }

  window.wpOpenPhpMyAdmin = (port) => {
    const pmaPort = (port || 8080) + 1000
    invoke('open_url', { url: `http://localhost:${pmaPort}` })
  }

  window.wpOpenMailpit = () => {
    invoke('open_url', { url: 'http://localhost:8025' })
  }

  window.wpOpenInIde = (path) => {
    invoke('open_in_ide', { ideCommand: getConfig().ide || 'code', path })
  }

  window.wpOpenFolder = (path) => {
    invoke('open_url', { url: path })
  }

  window.wpSelectSite = (path) => {
    const site = state.sites.find(s => s.path === path)
    state.selectedSite = site
    renderAtelier(el)
  }

  window.wpExportSite = async (path) => {
    try {
      const site = state.sites.find(s => s.path === path)
      const defaultName = `woodpress_${site?.name || 'site'}_${new Date().toISOString().slice(0, 10)}.azf`
      const destination = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Archive WoodPress', extensions: ['azf'] }]
      })
      if (destination) {
        const exportedFile = await invoke('export_azf', { sitePath: path, outputPath: destination })
        alert(`Archive .AZF exportée avec succès !\n${exportedFile}`)
      }
    } catch (e) {
      alert(`Erreur lors de l'exportation .AZF : ${e}`)
    }
  }

  window.wpOpenEtabli = () => {
    if (state.selectedSite) navigate('etabli')
  }
}
