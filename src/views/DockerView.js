import { state } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export function renderDocker(el) {
  const { dockerStatus } = state

  el.innerHTML = `
    <div style="flex:1;overflow:auto;padding:24px 28px;display:flex;flex-direction:column;gap:18px;">
      <!-- En-tête -->
      <div style="display:flex;align-items:flex-end;gap:14px;">
        <div>
          <div style="font-family:'Poppins',sans-serif;font-size:22px;font-weight:600;color:var(--tx)">Docker</div>
          <div style="font-size:13px;color:var(--tx3);margin-top:4px;">
            ${dockerStatus.running
              ? `Moteur actif · ${dockerStatus.containers_count} conteneur${dockerStatus.containers_count !== 1 ? 's' : ''} · v${dockerStatus.version || '...'}`
              : 'Docker Desktop est arrêté. Démarrez-le pour orchestrer vos sites.'}
          </div>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px;border-radius:999px;padding:6px 12px;
          background:${dockerStatus.running ? 'var(--grnBg)' : 'var(--nBg)'};
          border:1px solid ${dockerStatus.running ? 'var(--grnBd)' : 'var(--nBd)'};">
          <span style="width:8px;height:8px;border-radius:50%;background:${dockerStatus.running ? 'var(--grn)' : 'var(--tx3)'}"></span>
          <span style="font-size:12px;font-weight:600;color:${dockerStatus.running ? 'var(--grnT)' : 'var(--tx2)'}">
            ${dockerStatus.running ? 'Actif' : 'Arrêté'}
          </span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="window.wpToggleDocker()">
          ${dockerStatus.running ? 'Arrêter Docker' : '🚀 Démarrer Docker'}
        </button>
      </div>

      <!-- Cartes de métriques -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
        ${[
          { k: 'Conteneurs actifs', v: dockerStatus.running ? String(dockerStatus.containers_count) : '0' },
          { k: 'Version', v: dockerStatus.version || '—' },
          { k: 'Sites surveillés', v: String(state.sites.length) },
          { k: 'Mises à jour', v: String(state.sites.filter(s => s.has_update).length) },
        ].map(s => `
          <div class="card">
            <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--tx3)">${s.k}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:19px;margin-top:8px;color:var(--tx)">${s.v}</div>
          </div>
        `).join('')}
      </div>

      <!-- Journal Docker -->
      <div style="flex:1;min-height:280px;background:var(--surf);border:1px solid var(--bd);border-radius:10px;display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:12px 16px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px;">
          <div style="font-size:14px;font-weight:600;color:var(--tx)">Journal</div>
          <div style="display:flex;align-items:center;gap:6px;margin-left:auto;">
            <div style="height:28px;display:flex;align-items:center;padding:0 10px;border-radius:6px;background:var(--elev);font-size:12px;font-weight:600;cursor:pointer;color:var(--tx)">Tout</div>
            <div style="height:28px;display:flex;align-items:center;padding:0 10px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;color:var(--tx2)">Alertes</div>
            <div class="divider-v" style="height:18px;margin:0 4px;"></div>
            <div style="height:28px;display:flex;align-items:center;gap:6px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:500;color:var(--tx2);cursor:pointer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a2 2 0 0 0-2 2v9"/>
              </svg>
              Copier
            </div>
          </div>
        </div>
        <div style="flex:1;overflow:auto;padding:12px 16px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.85;background:var(--bg);color:var(--tx2)">
          ${dockerStatus.running
            ? `<div style="display:flex;gap:12px"><span style="color:var(--tx3)">14:33:01</span><span style="color:var(--grnT)">docker</span><span>Docker Desktop actif — moteur v${dockerStatus.version}</span></div>`
            : `<div style="color:var(--tx3);padding:20px 0;text-align:center">Docker Desktop n'est pas démarré.</div>`}
        </div>
      </div>
    </div>
  `
}
