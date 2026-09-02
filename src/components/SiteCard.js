import { state, navigate } from '../app.js'
import { invoke } from '@tauri-apps/api/core'
import { showPhpPatchNoteModal } from './PhpPatchNoteModal.js'
import { showResolvePortModal } from './ResolvePortModal.js'
import { showContainerizeModal } from './ContainerizeModal.js'
import { showUpdateStackModal } from './UpdateStackModal.js'
import { getConfig } from '../configStore.js'

export function renderSiteCard(site, isSelected) {
  const isLegacy = site.is_legacy
  const isOnline = site.status === 'online'
  const isStarting = site.status === 'starting'
  const isStopping = site.status === 'stopping'
  const isError = site.status === 'error'
  const hasConflict = site.has_port_conflict
  const hasWpUpdate = site.wp_version && state.latestWpVersion && site.wp_version !== state.latestWpVersion

  const statusBadge = isLegacy
    ? `<div class="badge badge-warn" style="font-size:11px;"><span class="badge-dot"></span>${site.legacy_stack || 'Laragon/WAMP'}</div>`
    : isOnline
    ? `<div class="badge badge-online"><span class="badge-dot"></span>En ligne</div>`
    : isStarting
    ? `<div class="badge badge-warn" style="display:flex;align-items:center;gap:5px;"><span class="animate-spin" style="display:inline-block;font-size:10px;">🔄</span>Démarrage…</div>`
    : isStopping
    ? `<div class="badge badge-warn" style="display:flex;align-items:center;gap:5px;"><span class="animate-spin" style="display:inline-block;font-size:10px;">🔄</span>Arrêt…</div>`
    : isError
    ? `<div class="badge badge-err"><span class="badge-dot"></span>Erreur</div>`
    : `<div class="badge badge-stopped"><span class="badge-dot"></span>Arrêté</div>`

  const ws = state.workspaces.find(w => w.path === site.workspace) || { name: 'Dossier', color: 'var(--cy)' }

  return `
    <div class="site-card ${isSelected ? 'selected' : ''}"
      id="card-${site.name}"
      onclick="window.wpSelectSite('${site.path.replace(/\\/g, '\\\\')}')"
      style="
        position: relative;
        background: var(--surf);
        border: 1px solid ${hasConflict ? 'var(--rdBd)' : isLegacy ? 'var(--amBd)' : isSelected ? 'var(--cy)' : 'var(--bd)'};
        ${isSelected ? 'box-shadow: 0 0 0 3px var(--cyBg);' : ''}
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        cursor: pointer;
        transition: transform .15s, border-color .15s, box-shadow .15s;
      "
      onmouseenter="this.style.borderColor='var(--bds)'; this.style.transform='translateY(-2px)'"
      onmouseleave="this.style.borderColor='${hasConflict ? 'var(--rdBd)' : isLegacy ? 'var(--amBd)' : isSelected ? 'var(--cy)' : 'var(--bd)'}'; this.style.transform='none'"
    >
      <!-- En-tête de la carte -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
          <div style="
            width: 36px; height: 36px; border-radius: 8px;
            background: var(--surf2); border: 1px solid var(--bd);
            display: flex; align-items: center; justify-content: center;
            font-family: 'Poppins', sans-serif; font-size: 14px; font-weight: 700;
            color: ${isLegacy ? 'var(--am)' : 'var(--cy)'}; flex-shrink: 0;
          ">
            ${site.name.slice(0, 2).toUpperCase()}
          </div>
          <div style="min-width: 0;">
            <div class="truncate" style="font-family:'Poppins',sans-serif; font-size: 14px; font-weight: 600; color: var(--tx);">
              ${site.name}
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
              <span style="width:6px; height:6px; border-radius:50%; background:${ws.color};"></span>
              <span class="truncate" style="font-size: 11px; color: var(--tx3); font-weight: 500;">
                ${ws.name}
              </span>
            </div>
          </div>
        </div>

        <!-- Menu 3 points -->
        <button class="btn btn-ghost btn-sm"
          style="padding: 4px 6px; border-radius: 6px;"
          onclick="window.wpToggleCardMenu('${site.path.replace(/\\/g, '\\\\')}', event)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
        </button>
      </div>

      <!-- Alerte de conflit de port HTTP si détecté -->
      ${hasConflict ? `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--rdBg);border:1px solid var(--rdBd);border-radius:8px;padding:6px 10px;"
          onclick="event.stopPropagation(); window.wpOpenResolvePort('${site.path.replace(/\\/g, '\\\\')}')">
          <div style="font-size:11px;font-weight:600;color:var(--rdT);">⚠️ Conflit de port (:${site.http_port || 80})</div>
          <button class="btn btn-sm" style="padding:2px 6px;font-size:10px;background:var(--elev);color:var(--tx);border:1px solid var(--bds);">
            Résoudre
          </button>
        </div>
      ` : ''}

      <!-- Métadonnées & Port -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 0; border-top: 1px solid var(--surf2); border-bottom: 1px solid var(--surf2);">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${statusBadge}
          ${site.http_port ? `
            <span class="font-mono" style="font-size: 12px; color: var(--tx2); font-weight: 600;">
              :${site.http_port}
            </span>
          ` : ''}
        </div>

        <!-- Métadonnées & Port -->
        <div class="font-mono" style="font-size: 11px; color: var(--tx3); display: flex; align-items: center; gap: 6px;">
          <span>WP ${site.wp_version || '6.7.2'}</span>
          ${!isLegacy ? `
            <span>·</span>
            <span style="color:var(--cy);cursor:pointer;text-decoration:underline;"
              title="Cliquez pour voir les patch notes PHP"
              onclick="event.stopPropagation(); window.wpOpenPhpModal('${site.path.replace(/\\/g, '\\\\')}')">
              ${site.php_version || 'PHP 8.4'} ↗
            </span>
          ` : ''}
        </div>
      </div>

      <!-- Bannière d'alerte jaune/ambre : Mise à jour disponible -->
      ${hasWpUpdate ? `
        <div style="display:flex;align-items:center;gap:8px;background:var(--amBg);border:1px solid var(--amBd);border-radius:8px;padding:8px 10px;cursor:pointer;"
          onclick="event.stopPropagation(); window.wpOpenStackUpdate('${site.path.replace(/\\/g, '\\\\')}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--am)" stroke-width="1.9" stroke-linecap="round" style="flex-shrink:0;">
            <path d="M12 9v4M12 16.5h.01" /><path d="M10.3 4.4 3.4 16.6A1.7 1.7 0 0 0 4.9 19.2h14.2a1.7 1.7 0 0 0 1.5-2.6L13.7 4.4a1.7 1.7 0 0 0-3.4 0z" />
          </svg>
          <span style="font-size:12px;font-weight:600;color:var(--amT);flex:1;">WordPress ${state.latestWpVersion || '7.1'} disponible</span>
          <span style="font-size:12px;font-weight:600;color:var(--cy);">Voir</span>
        </div>
      ` : ''}

      <!-- Boutons d'action -->
      <div style="display: flex; align-items: center; gap: 6px; margin-top: auto;" onclick="event.stopPropagation()">
        ${isLegacy ? `
          <button class="btn btn-primary btn-sm" style="flex:1;" onclick="window.wpOpenContainerizeModal('${site.path.replace(/\\/g, '\\\\')}')">
            ⚡ Conteneuriser Docker
          </button>
        ` : isStarting ? `
          <button class="btn btn-primary btn-sm" style="flex:1;" disabled>
            <span class="animate-spin" style="display:inline-block;">🔄</span> Démarrage…
          </button>
        ` : isStopping ? `
          <button class="btn btn-elev btn-sm" style="flex:1;" disabled>
            <span class="animate-spin" style="display:inline-block;">🔄</span> Arrêt…
          </button>
        ` : isOnline ? `
          <button class="btn btn-elev btn-sm" style="flex:1;" onclick="window.wpStopSite('${site.path.replace(/\\/g, '\\\\')}')">
            ⏹️ Arrêter
          </button>
          <button class="btn btn-elev btn-sm" style="flex:1;" onclick="window.wpOpenSiteUrl('${site.http_port}')">
            🌐 Ouvrir
          </button>
        ` : `
          <button class="btn btn-sm" style="flex:1;background:#84cc16;color:#0b0f17;font-weight:700;border:none;padding:7px 12px;border-radius:8px;cursor:pointer;" onclick="window.wpStartSite('${site.path.replace(/\\/g, '\\\\')}')">
            ▶️ Démarrer
          </button>
          <button class="btn btn-elev btn-sm" style="flex:1;opacity:0.45;cursor:not-allowed;" title="Démarrez le site pour l'ouvrir">
            🌐 Ouvrir
          </button>
        `}
        <button class="btn btn-ghost btn-sm" style="padding: 6px 8px;" title="Menu du site"
          onclick="window.wpToggleCardMenu('${site.path.replace(/\\/g, '\\\\')}', event)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
        </button>
      </div>
    </div>
  `
}

window.wpOpenSiteUrl = (port) => {
  if (port) invoke('open_url', { url: `http://localhost:${port}` })
}

window.wpOpenStackUpdate = (path) => {
  const site = state.sites.find(s => s.path === path)
  if (site) showUpdateStackModal(site, () => {
    if (window.wpScanWorkspaces) window.wpScanWorkspaces()
  })
}

window.wpOpenContainerizeModal = (path) => {
  const site = state.sites.find(s => s.path === path)
  if (site) showContainerizeModal(site)
}

window.wpOpenEtabliForSite = (path) => {
  const site = state.sites.find(s => s.path === path)
  if (site) {
    state.selectedSite = site
  }
  navigate('etabli')
}

window.wpOpenPhpModal = (path) => {
  const site = state.sites.find(s => s.path === path)
  if (site) showPhpPatchNoteModal(site)
}

window.wpOpenResolvePort = (path) => {
  const site = state.sites.find(s => s.path === path)
  if (site) showResolvePortModal(site)
}

window.wpToggleCardMenu = (path, event) => {
  event.stopPropagation()
  const existing = document.getElementById('wp-card-menu')
  if (existing) { existing.remove(); return }

  const site = state.sites.find(s => s.path === path)
  if (!site) return

  const menu = document.createElement('div')
  menu.id = 'wp-card-menu'
  menu.style.cssText = `
    position:fixed; z-index:9999;
    width:220px; background:var(--elev);
    border:1px solid var(--bds); border-radius:10px;
    box-shadow:var(--shadow); overflow:hidden; padding:4px;
  `
  menu.style.left = `${Math.min(event.clientX - 160, window.innerWidth - 230)}px`
  menu.style.top  = `${event.clientY + 8}px`

  const port = site.http_port || 8080
  const pmaPort = port + 1000

  const actions = site.is_legacy ? [
    { icon: '⚡', label: 'Conteneuriser Docker', handler: () => showContainerizeModal(site) },
    { icon: '📁', label: 'Ouvrir le dossier',     handler: () => invoke('open_url', { url: path }) },
    { icon: '💻', label: 'Ouvrir dans IDE',     handler: () => invoke('open_in_ide', { ideCommand: getConfig().ide || 'code', path }) },
  ] : [
    { icon: '🔑', label: 'WP-Admin',       handler: () => invoke('open_url', { url: `http://localhost:${port}/wp-admin` }) },
    { icon: '🗄️', label: 'PhpMyAdmin',     handler: () => invoke('open_url', { url: `http://localhost:${pmaPort}` }) },
    { icon: '✉️', label: 'Mailpit',        handler: () => invoke('open_url', { url: 'http://localhost:8025' }) },
    { icon: '🔍', label: 'Ouvrir l\'Établi', handler: () => window.wpOpenEtabliForSite(path) },
    { icon: '🐘', label: 'Version PHP & Patch Note', handler: () => showPhpPatchNoteModal(site) },
    { icon: '💻', label: 'Ouvrir dans IDE', handler: () => invoke('open_in_ide', { ideCommand: getConfig().ide || 'code', path }) },
    { icon: '📁', label: 'Ouvrir le dossier', handler: () => invoke('open_url', { url: path }) },
    { divider: true },
    { icon: '💾', label: 'Exporter .AZF',   handler: () => window.wpExportSite && window.wpExportSite(path) },
    { icon: '📋', label: 'Cloner le site',  handler: () => window.wpCloneSitePrompt(site) },
    { divider: true },
    { icon: '🗑️', label: 'Supprimer',      handler: () => window.wpDeleteSitePrompt(site), danger: true },
  ]

  actions.forEach(a => {
    if (a.divider) {
      const div = document.createElement('div')
      div.style.cssText = 'height:1px;background:var(--bd);margin:4px 0;'
      menu.appendChild(div)
      return
    }
    const item = document.createElement('div')
    item.style.cssText = `
      display:flex;align-items:center;gap:10px;padding:9px 10px;
      border-radius:7px;cursor:pointer;font-size:13px;font-weight:500;
      color:${a.danger ? 'var(--rdT)' : 'var(--tx)'};
    `
    item.innerHTML = `<span>${a.icon}</span>${a.label}`
    item.addEventListener('mouseenter', () => item.style.background = 'var(--surf2)')
    item.addEventListener('mouseleave', () => item.style.background = 'transparent')
    item.addEventListener('click', (e) => {
      e.stopPropagation()
      if (a.handler) a.handler()
      menu.remove()
    })
    menu.appendChild(item)
  })

  document.body.appendChild(menu)
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 50)
}

// Clone prompt
window.wpCloneSitePrompt = async (site) => {
  const newName = prompt(`Nom du clone pour "${site.name}" :`, `${site.name}-copie`)
  if (!newName || !newName.trim()) return

  try {
    const freePort = await invoke('get_free_port', { start: 8090, end: 8150 })
    const cloned = await invoke('clone_site', {
      sourcePath: site.path,
      newName: newName.trim(),
      targetWorkspace: site.workspace,
      newPort: freePort,
    })
    state.sites.unshift(cloned)
    if (window.wpScan) window.wpScan()
  } catch (e) {
    alert(`Erreur lors du clonage : ${e}`)
  }
}

// Delete prompt
window.wpDeleteSitePrompt = async (site) => {
  const confirmed = confirm(`Êtes-vous sûr de vouloir supprimer définitivement le site "${site.name}" et ses conteneurs Docker ?`)
  if (!confirmed) return

  try {
    await invoke('delete_site', {
      sitePath: site.path,
      composeDir: site.compose_dir || site.path,
      deleteFiles: true,
    })
    state.sites = state.sites.filter(s => s.path !== site.path)
    if (state.selectedSite?.path === site.path) state.selectedSite = null
    if (window.wpScan) window.wpScan()
  } catch (e) {
    alert(`Erreur lors de la suppression : ${e}`)
  }
}
