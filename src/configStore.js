import { invoke } from '@tauri-apps/api/core'

/**
 * Configuration de l'application, conservée dans un fichier du dossier utilisateur
 * (%APPDATA%\WoodPress\config.json sous Windows).
 *
 * Le stockage du navigateur embarqué ne convenait pas à un produit installé : il est
 * effacé avec les données du composant web et ne suit pas l'utilisateur d'un poste
 * à l'autre. Le fichier est chargé une fois au démarrage, puis lu en mémoire ;
 * seules les écritures repassent par le disque.
 */

const DEFAULTS = {
  version: 1,
  workspaces: [],
  theme: 'dark',
  ide: 'code',
  layout: 'grid',
  preferences: {
    autoDocker: true,
    autoCheckUpdates: true,
    securityAlerts: true,
  },
}

let cache = { ...DEFAULTS }
let configPath = ''
let saveTimer = null

/** Anciennes clés du navigateur embarqué, reprises une seule fois. */
function readLegacyStorage() {
  const legacy = {}
  let found = false

  try {
    const ws = localStorage.getItem('wp-workspaces')
    if (ws) {
      const parsed = JSON.parse(ws)
      if (Array.isArray(parsed) && parsed.length > 0) {
        legacy.workspaces = parsed
        found = true
      }
    }

    const theme = localStorage.getItem('wp-theme')
    if (theme) { legacy.theme = theme; found = true }

    const ide = localStorage.getItem('wp-ide')
    if (ide) { legacy.ide = ide; found = true }

    const prefs = {}
    const map = {
      'wp-pref-autodocker': 'autoDocker',
      'wp-pref-checkupdates': 'autoCheckUpdates',
      'wp-pref-security': 'securityAlerts',
    }
    for (const [key, name] of Object.entries(map)) {
      const v = localStorage.getItem(key)
      if (v !== null) { prefs[name] = v !== 'false'; found = true }
    }
    if (Object.keys(prefs).length) legacy.preferences = prefs
  } catch (e) {
    console.warn('Lecture de l\'ancienne configuration impossible :', e)
  }

  return found ? legacy : null
}

function clearLegacyStorage() {
  for (const key of ['wp-workspaces', 'wp-theme', 'wp-ide',
                     'wp-pref-autodocker', 'wp-pref-checkupdates', 'wp-pref-security']) {
    try { localStorage.removeItem(key) } catch {}
  }
}

/**
 * Charge la configuration au démarrage. À appeler une seule fois, avant le premier rendu.
 */
export async function initConfig() {
  try {
    const loaded = await invoke('load_app_config')
    configPath = loaded.path || ''
    cache = { ...DEFAULTS, ...loaded.config }
    cache.preferences = { ...DEFAULTS.preferences, ...(loaded.config.preferences || {}) }

    // Reprise des réglages laissés par le stockage du navigateur. La fusion est
    // volontairement non destructive : un dossier de travail déclaré d'un côté ou de
    // l'autre doit se retrouver dans le fichier, jamais être perdu en chemin.
    const legacy = readLegacyStorage()
    if (legacy) {
      const known = new Set((cache.workspaces || []).map(w => (w.path || '').toLowerCase()))
      const added = (legacy.workspaces || []).filter(w => w.path && !known.has(w.path.toLowerCase()))

      // Les réglages simples ne sont repris que si le fichier n'en portait pas déjà
      if (!loaded.existed) {
        if (legacy.theme) cache.theme = legacy.theme
        if (legacy.ide) cache.ide = legacy.ide
        if (legacy.preferences) {
          cache.preferences = { ...cache.preferences, ...legacy.preferences }
        }
      }

      if (added.length || !loaded.existed) {
        cache.workspaces = [...(cache.workspaces || []), ...added]
        const written = await persist()
        // Le stockage n'est vidé qu'une fois l'écriture confirmée
        if (written) {
          clearLegacyStorage()
          console.info('Réglages repris et enregistrés dans', configPath)
        }
      }
    }
  } catch (e) {
    // Une configuration illisible ne doit pas empêcher l'application de s'ouvrir
    console.warn('Configuration non chargée, valeurs par défaut appliquées :', e)
    cache = { ...DEFAULTS, preferences: { ...DEFAULTS.preferences } }
  }

  return cache
}

/** Lecture synchrone de la configuration en mémoire. */
export function getConfig() {
  return cache
}

export function getConfigPath() {
  return configPath
}

async function persist() {
  try {
    const path = await invoke('save_app_config', { config: cache })
    if (path) configPath = path
    return true
  } catch (e) {
    console.error('Enregistrement de la configuration impossible :', e)
    return false
  }
}

/**
 * Applique des modifications et les écrit sur disque.
 * Les écritures rapprochées sont regroupées pour ne pas solliciter le disque à chaque frappe.
 */
export function updateConfig(patch, { immediate = false } = {}) {
  cache = { ...cache, ...patch }
  if (patch.preferences) {
    cache.preferences = { ...cache.preferences, ...patch.preferences }
  }

  if (immediate) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    return persist()
  }

  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { saveTimer = null; persist() }, 300)
  return Promise.resolve(true)
}
