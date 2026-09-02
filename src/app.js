import { invoke } from '@tauri-apps/api/core'
import { getConfig, updateConfig } from './configStore.js'
import { renderSidebar } from './components/Sidebar.js'
import { renderAtelier } from './views/AtelierView.js'
import { renderDocker } from './views/DockerView.js'
import { renderSettings } from './views/SettingsView.js'
import { renderEtabli } from './views/EtabliView.js'

// Les espaces de travail proviennent du fichier de configuration de l'utilisateur.
function loadInitialWorkspaces() {
  return getConfig().workspaces || []
}

// ── État global de l'application ──────────────────────────────────────────
export const state = {
  view: 'atelier',          // 'atelier' | 'etabli' | 'docker' | 'settings'
  layout: getConfig().layout || 'grid',   // 'grid' | 'list'
  sites: [],
  selectedSite: null,
  dockerStatus: { running: false, version: null, containers_count: 0 },
  workspaces: loadInitialWorkspaces(),
  activeWorkspace: null,
  ides: [],
  query: '',
  theme: getConfig().theme || 'dark',
  latestWpVersion: '6.7.2',
}

let _root = null

// ── Rendu principal ────────────────────────────────────────────────────────
export function renderApp(root) {
  _root = root
  root.innerHTML = `
    <div id="wp-shell" style="
      position: absolute; inset: 0;
      display: flex;
      background: var(--bg);
      color: var(--tx);
      font-family: 'IBM Plex Sans', sans-serif;
      -webkit-font-smoothing: antialiased;
      overflow: hidden;
    ">
      <div id="wp-sidebar"></div>
      <div id="wp-main" style="flex:1; display:flex; flex-direction:column; min-width:0; position:relative; overflow:hidden;"></div>
    </div>
  `
  renderSidebar(document.getElementById('wp-sidebar'))
  renderView()
  bootstrap()
}

// ── Navigation ─────────────────────────────────────────────────────────────
export function navigate(view, data = {}) {
  state.view = view
  if (data.site) state.selectedSite = data.site
  renderSidebar(document.getElementById('wp-sidebar'))
  renderView()
}

// Exposer la navigation globalement pour tous les composants
window.navigate = navigate
window.wpNavigate = navigate

// Les attributs onclick du HTML s'evaluent dans le contexte global, alors que tout le code
// est en modules ES : sans ces expositions, chaque clic leve un ReferenceError silencieux.
window.state = state
window.invoke = invoke

// Fermeture universelle des modales
window.modalClose = () => {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove())
}

// Clic en dehors d'une modale pour fermer
document.addEventListener('click', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.remove()
  }
})

function renderView() {
  const main = document.getElementById('wp-main')
  if (!main) return
  switch (state.view) {
    case 'atelier':  renderAtelier(main); break
    case 'etabli':   renderEtabli(main); break
    case 'docker':   renderDocker(main); break
    case 'settings': renderSettings(main); break
    default:         renderAtelier(main)
  }
}

// ── Bootstrap : charge les données réelles au démarrage ─────────────────────
async function bootstrap() {
  // Détection Docker
  try {
    state.dockerStatus = await invoke('get_docker_status')
  } catch (e) {
    console.warn('Docker non disponible :', e)
  }

  // Scan réel des workspaces de l'utilisateur
  try {
    const paths = state.workspaces.map(w => w.path)
    state.sites = await invoke('scan_workspaces', { paths })
  } catch (e) {
    console.warn('Scan workspaces échoué :', e)
    state.sites = []
  }

  // Détection des IDEs
  try {
    state.ides = await invoke('detect_ides')
  } catch (e) {
    state.ides = []
  }

  // Vérification de la version officielle de WordPress en ligne
  try {
    state.latestWpVersion = await invoke('fetch_latest_wp_version')
  } catch (e) {
    console.warn('Vérification WP version échouée :', e)
  }

  // Rendu de l'interface avec données réelles
  renderView()
  renderSidebar(document.getElementById('wp-sidebar'))

  // Rafraîchissement automatique de Docker et des états de sites toutes les 4 secondes
  setInterval(async () => {
    try {
      state.dockerStatus = await invoke('get_docker_status')
      const paths = state.workspaces.map(w => w.path)
      const freshSites = await invoke('scan_workspaces', { paths })
      if (JSON.stringify(freshSites) !== JSON.stringify(state.sites)) {
        state.sites = freshSites
        if (state.selectedSite) {
          state.selectedSite = state.sites.find(s => s.path === state.selectedSite.path) || state.selectedSite
        }
        renderView()
      }
      renderSidebar(document.getElementById('wp-sidebar'))
    } catch {}
  }, 4000)
}
