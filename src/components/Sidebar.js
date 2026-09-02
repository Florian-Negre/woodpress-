import { state, navigate } from '../app.js'
import { invoke } from '@tauri-apps/api/core'
import iconSquare from '../assets/woodpress-icon-square.svg'
import { showAddWorkspaceModal } from './AddWorkspaceModal.js'
import { showWpVersionModal } from './WpVersionModal.js'

const NAV_ITEMS = [
  { id: 'atelier',  icon: iconGrid(),  label: 'Atelier' },
  { id: 'docker',   icon: iconDocker(), label: 'Docker' },
  { id: 'settings', icon: iconSliders(), label: 'Réglages' },
]

export function renderSidebar(el) {
  const { view, dockerStatus, sites, workspaces, activeWorkspace } = state

  const siteCount = sites.length
  const wpVersion = 'v' + (state.latestWpVersion || '6.7.2')

  // Grouper les sites par workspace pour les compteurs
  const wsCounts = workspaces.reduce((acc, ws) => {
    acc[ws.path] = sites.filter(s => s.workspace === ws.path).length
    return acc
  }, {})

  el.innerHTML = `
    <div style="
      width: 236px; flex-shrink: 0;
      background: var(--surf);
      border-right: 1px solid var(--bd);
      display: flex; flex-direction: column;
      padding: 16px 12px;
      overflow: hidden; height: 100%;
    ">
      <!-- Logo Officiel -->
      <div style="display:flex; align-items:center; gap:10px; padding: 4px 8px 20px; cursor:pointer;"
           onclick="window.wpNavigate('atelier')">
        <img src="${iconSquare}" style="width:28px;height:28px;border-radius:7px;flex-shrink:0;" alt="WoodPress" />
        <div>
          <div style="font-family:'Poppins',sans-serif;font-size:15px;font-weight:600;line-height:1.1;color:var(--tx)">WoodPress</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--tx3);margin-top:2px">v2.0 · atelier codinflo</div>
        </div>
      </div>

      <!-- Navigation principale -->
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${NAV_ITEMS.map(item => {
          const isActive = view === item.id
          const isDocker = item.id === 'docker'
          return `
            <div onclick="window.wpNavigate('${item.id}')"
              style="
                height:36px; display:flex; align-items:center; gap:10px;
                padding:0 10px; border-radius:8px; font-size:13px; cursor:pointer;
                background: ${isActive ? 'var(--grnBg)' : 'transparent'};
                font-weight: ${isActive ? '600' : '500'};
                color: ${isActive ? 'var(--tx)' : 'var(--tx2)'};
              "
            >
              <span style="color:${isActive ? 'var(--grn)' : 'currentColor'}">${item.icon}</span>
              ${item.label}
              ${isDocker ? `<span style="margin-left:auto;width:7px;height:7px;border-radius:50%;background:${dockerStatus.running ? 'var(--grn)' : 'var(--tx3)'}"></span>` : ''}
              ${item.id === 'atelier' ? `<span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3)">${siteCount}</span>` : ''}
            </div>
          `
        }).join('')}

        <!-- Version WP (badge live cliquable) -->
        <div onclick="window.wpOpenWpVersionModal()"
             style="height:36px;display:flex;align-items:center;gap:10px;padding:0 10px;border-radius:8px;font-size:13px;font-weight:500;color:var(--tx2);cursor:pointer;transition:background .15s;"
             onmouseenter="this.style.background='var(--surf2)'"
             onmouseleave="this.style.background='transparent'">
          ${iconGlobe()}
          Version WP
          <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:var(--grnT)">${wpVersion} 🟢</span>
        </div>
      </div>

      <!-- Dossiers de travail -->
      <div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--tx3);padding:24px 10px 8px">
        Dossiers de travail
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${workspaces.map(ws => {
          const isActive = activeWorkspace === ws.path
          return `
            <div onclick="window.wpSetWorkspace('${ws.path}')"
              style="
                cursor:pointer; padding:8px 10px; border-radius:8px;
                background: ${isActive ? 'var(--surf2)' : 'transparent'};
              "
            >
              <div style="font-size:13px;font-weight:${isActive ? '600' : '500'};color:${isActive ? 'var(--tx)' : 'var(--tx2)'};display:flex;align-items:center;gap:8px;">
                <span style="width:7px;height:7px;border-radius:2px;background:${ws.color};flex-shrink:0"></span>
                ${ws.name}
                <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3)">${wsCounts[ws.path] || 0}</span>
              </div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--tx3);margin-top:3px;padding-left:15px">${ws.path}</div>
            </div>
          `
        }).join('')}
        <div onclick="window.wpOpenAddWorkspace()" style="height:32px;display:flex;align-items:center;gap:8px;padding:0 10px;border-radius:8px;color:var(--tx3);font-size:12px;font-weight:500;cursor:pointer;"
             onmouseenter="this.style.color='var(--tx)'"
             onmouseleave="this.style.color='var(--tx3)'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Ajouter un dossier
        </div>
      </div>

      <!-- Pied de page : statut Docker -->
      <div style="margin-top:auto;border-top:1px solid var(--bd);padding:14px 10px 0;display:flex;align-items:center;gap:10px;">
        <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${dockerStatus.running ? 'var(--grn)' : 'var(--tx3)'}"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--tx)">
            ${dockerStatus.running ? 'Docker actif' : 'Docker éteint'}
          </div>
          <div style="font-size:11px;color:var(--tx3);margin-top:1px">
            ${dockerStatus.running
              ? `${dockerStatus.containers_count} conteneur${dockerStatus.containers_count !== 1 ? 's' : ''}`
              : 'Aucun conteneur'}
          </div>
        </div>
      </div>
      <div onclick="window.wpToggleDocker()"
        style="
          height:32px; display:flex; align-items:center; justify-content:center; gap:8px;
          background:var(--elev); border:1px solid var(--bds); border-radius:8px;
          font-size:12px; font-weight:600; margin-top:10px; cursor:pointer;
          color: ${dockerStatus.running ? 'var(--rdT)' : 'var(--cyT)'};
        "
      >
        ${dockerStatus.running
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> Arrêter Docker`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg> Démarrer Docker`
        }
      </div>
    </div>
  `

  // Exposer les handlers globaux
  window.wpNavigate = (view) => navigate(view)
  window.wpOpenWpVersionModal = () => showWpVersionModal()
  window.wpOpenAddWorkspace = () => showAddWorkspaceModal()
  window.wpSetWorkspace = (path) => {
    state.activeWorkspace = state.activeWorkspace === path ? null : path
    renderSidebar(el)
    // Déclenche un re-rendu de la vue Atelier
    navigate('atelier')
  }
  window.wpToggleDocker = async () => {
    try {
      if (!state.dockerStatus.running) {
        await invoke('start_docker')
      }
    } catch (e) {
      console.warn('Toggle Docker :', e)
    }
  }
}

// ── Icônes SVG ────────────────────────────────────────────────────────────
function iconWoodPress() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 18 L8 8 L12 14 L16 8 L20 18" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="10" y="5" width="4" height="4" rx="1" fill="white" opacity="0.9"/>
  </svg>`
}
function iconGrid() {
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>`
}
function iconDocker() {
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4"/>
  </svg>`
}
function iconSliders() {
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/>
  </svg>`
}
function iconGlobe() {
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 8v8M8.5 10.5 12 8l3.5 2.5"/>
  </svg>`
}
