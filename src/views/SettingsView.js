import { state, navigate } from '../app.js'
import { invoke } from '@tauri-apps/api/core'
import { showAddWorkspaceModal } from '../components/AddWorkspaceModal.js'

export function renderSettings(el) {
  const { theme, workspaces, ides } = state
  const selectedIde = localStorage.getItem('wp-ide') || 'code'

  const prefs = {
    autoDocker: localStorage.getItem('wp-pref-autodocker') !== 'false',
    autoCheckUpdates: localStorage.getItem('wp-pref-checkupdates') !== 'false',
    securityAlerts: localStorage.getItem('wp-pref-security') !== 'false',
  }

  el.innerHTML = `
    <div style="flex:1;overflow:auto;padding:24px 28px;display:flex;flex-direction:column;gap:16px;">
      <div>
        <div style="font-family:'Poppins',sans-serif;font-size:22px;font-weight:600;color:var(--tx)">Réglages</div>
        <div style="font-size:13px;color:var(--tx3);margin-top:4px;">Thème, dossiers de travail, éditeur de code par défaut.</div>
      </div>

      <!-- Apparence -->
      <div class="card">
        <div style="font-size:14px;font-weight:600;margin-bottom:4px;color:var(--tx)">Apparence & Thème</div>
        <div style="font-size:12px;color:var(--tx3);margin-bottom:16px;">Sélectionnez le style de l'interface.</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:560px;">
          ${[
            { id: 'dark',   label: 'Atelier Sombre', bgPrev: '#0B0F16', surfPrev: '#131A24', accentPrev: '#8BC34A' },
            { id: 'light',  label: 'Contreplaqué Clair', bgPrev: '#F7F4EF', surfPrev: '#FFFDFA', accentPrev: '#6FA02F' },
          ].map(t => `
            <div onclick="window.wpSetTheme('${t.id}')"
              style="cursor:pointer;border-radius:10px;overflow:hidden;border:2px solid ${theme === t.id ? 'var(--cy)' : 'var(--bd)'};transition:border-color .15s;"
            >
              <div style="height:64px;background:${t.bgPrev};display:flex;align-items:center;justify-content:center;gap:6px;">
                <span style="width:36px;height:22px;border-radius:4px;background:${t.surfPrev};border:1px solid var(--bd)"></span>
                <span style="width:14px;height:22px;border-radius:4px;background:${t.accentPrev}"></span>
              </div>
              <div style="padding:10px 12px;font-size:13px;font-weight:${theme === t.id ? '600' : '500'};color:${theme === t.id ? 'var(--cy)' : 'var(--tx2)'}">
                ${t.label}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Dossiers de travail -->
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--tx)">Dossiers de travail (${workspaces.length})</div>
            <div style="font-size:12px;color:var(--tx3);margin-top:3px;">Emplacements surveillés pour vos projets WordPress.</div>
          </div>
          <div style="margin-left:auto;display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="window.wpOpenAddWorkspaceModal()">
              + Ajouter un dossier
            </button>
            <button class="btn btn-elev btn-sm" onclick="window.wpRescanAll()">
              🔄 Rescanner
            </button>
          </div>
        </div>
        ${workspaces.map((ws, index) => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--surf2);">
            <span style="width:8px;height:8px;border-radius:2px;flex-shrink:0;background:${ws.color}"></span>
            <div style="width:170px;flex-shrink:0;font-size:13px;font-weight:600;color:var(--tx)">${ws.name}</div>
            <div class="truncate" style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--tx2);flex:1;">${ws.path}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3);">
              ${state.sites.filter(s => s.workspace === ws.path).length} site(s)
            </div>
            ${workspaces.length > 1 ? `
              <button class="btn btn-ghost btn-sm" style="color:var(--rdT);" onclick="window.wpRemoveWorkspace(${index})">
                Supprimer
              </button>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <!-- Éditeur de code -->
      <div class="card">
        <div style="font-size:14px;font-weight:600;margin-bottom:4px;color:var(--tx)">Éditeur de code par défaut</div>
        <div style="font-size:12px;color:var(--tx3);margin-bottom:16px;">Sélectionnez l'éditeur à ouvrir avec le bouton IDE.</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-width:700px;">
          ${(ides.length > 0 ? ides : [
            { name: 'VS Code',   command: 'code',     detected: true },
            { name: 'Cursor',    command: 'cursor',   detected: false },
            { name: 'PhpStorm',  command: 'phpstorm', detected: false },
            { name: 'Windsurf',  command: 'windsurf', detected: false },
          ]).map(ide => `
            <div onclick="window.wpSelectIde('${ide.command}')"
              style="
                cursor:pointer;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px;
                border:2px solid ${selectedIde === ide.command ? 'var(--cy)' : 'var(--bd)'};
                background: ${selectedIde === ide.command ? 'var(--surf2)' : 'var(--surf)'};
                transition:border-color .15s;
              "
            >
              <div style="display:flex;align-items:center;gap:7px;">
                <span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${ide.detected ? 'var(--grn)' : 'var(--tx3)'}"></span>
                <span style="font-size:12px;font-weight:600;color:${ide.detected ? 'var(--tx)' : 'var(--tx2)'};">${ide.name}</span>
              </div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3);">${ide.command}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Préférences -->
      <div class="card">
        <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--tx)">Préférences globales</div>
        ${[
          { key: 'wp-pref-autodocker', label: 'Démarrer Docker automatiquement', hint: 'Lance Docker Desktop au démarrage si celui-ci est éteint.', on: prefs.autoDocker },
          { key: 'wp-pref-checkupdates', label: 'Vérifier les versions WordPress au démarrage', hint: 'Consulte l\'API WordPress.org pour détecter les nouvelles versions.', on: prefs.autoCheckUpdates },
          { key: 'wp-pref-security', label: 'Surveillance de sécurité CVE Watch', hint: 'Alertes en temps réel sur les vulnérabilités de plugins.', on: prefs.securityAlerts },
        ].map((p, i) => `
          <div onclick="window.wpTogglePref('${p.key}')"
            style="cursor:pointer;display:flex;align-items:center;gap:14px;padding:13px 0;border-top:${i > 0 ? '1px solid var(--surf2)' : 'none'};">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;color:var(--tx)">${p.label}</div>
              <div style="font-size:12px;color:var(--tx3);margin-top:2px;">${p.hint}</div>
            </div>
            <div class="toggle ${p.on ? 'toggle-on' : 'toggle-off'}">
              <span class="toggle-knob"></span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Version & MàJ -->
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--tx3);text-align:center;padding-bottom:8px;">
        WoodPress v2.0.0 — Atelier Codinflo · Plateforme native
      </div>
    </div>
  `

  window.wpSetTheme = (t) => {
    state.theme = t
    localStorage.setItem('wp-theme', t)
    if (t === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
    renderSettings(el)
  }

  window.wpSelectIde = (cmd) => {
    localStorage.setItem('wp-ide', cmd)
    renderSettings(el)
  }

  window.wpTogglePref = (key) => {
    const current = localStorage.getItem(key) !== 'false'
    localStorage.setItem(key, current ? 'false' : 'true')
    renderSettings(el)
  }

  window.wpOpenAddWorkspaceModal = () => showAddWorkspaceModal()

  window.wpRemoveWorkspace = (idx) => {
    state.workspaces.splice(idx, 1)
    localStorage.setItem('wp-workspaces', JSON.stringify(state.workspaces))
    if (window.wpScan) window.wpScan()
    renderSettings(el)
  }

  window.wpRescanAll = async () => {
    try {
      const paths = state.workspaces.map(w => w.path)
      state.sites = await invoke('scan_workspaces', { paths })
      renderSettings(el)
    } catch {}
  }
}
