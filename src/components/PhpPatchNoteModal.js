import { state, navigate } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export async function showPhpPatchNoteModal(site) {
  const existing = document.getElementById('wp-php-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-php-modal'
  modalOverlay.className = 'modal-overlay'

  const currentPhp = site.php_version || 'PHP 8.4'
  let patchNote = null
  let isUpdating = false
  let selectedNewPhp = currentPhp.replace('PHP ', '')

  try {
    patchNote = await invoke('get_php_patch_notes', { version: currentPhp })
  } catch (e) {
    console.warn(e)
  }

  const availableVersions = ['8.2', '8.3', '8.4', '8.5']

  function render() {
    modalOverlay.innerHTML = `
      <div class="modal" style="width: 640px; max-width: 95vw;">
        <!-- Header -->
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:24px">🐘</span>
            <div>
              <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">
                ${patchNote?.version || currentPhp} — Patch Notes & Nouveautés
              </div>
              <div style="font-size:12px;color:var(--tx3);margin-top:2px;">
                Date de sortie : ${patchNote?.release_date || 'Officielle'} · Site : ${site.name}
              </div>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:18px;max-height:65vh;overflow:auto;">
          
          <!-- Sélecteur d'évolution de version PHP -->
          <div style="background:var(--surf2);border:1px solid var(--bd);border-radius:10px;padding:14px 16px;">
            <div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:8px;">
              ⚡ Faire évoluer la version PHP de ce site :
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${availableVersions.map(v => `
                <button class="btn ${selectedNewPhp.startsWith(v) ? 'btn-primary' : 'btn-elev'} btn-sm"
                  onclick="window.phpSelectVersion('${v}')"
                  style="font-family:'JetBrains Mono',monospace;">
                  PHP ${v} ${v === '8.4' ? '(Recommandé)' : v === '8.5' ? '(RC / Next)' : ''}
                </button>
              `).join('')}
            </div>
            <div style="font-size:11px;color:var(--tx3);margin-top:8px;">
              La mise à niveau met à jour l'image Docker Apache/PHP et redémarre le conteneur automatiquement.
            </div>
          </div>

          <!-- Nouveautés & Fonctionnalités clés -->
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--grnT);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Points forts & Nouveautés
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${(patchNote?.highlights || []).map(h => `
                <div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--tx);line-height:1.5;">
                  <span style="color:var(--grn);margin-top:2px;">✔</span>
                  <span>${h}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Dépréciations -->
          ${patchNote?.deprecations && patchNote.deprecations.length > 0 ? `
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--amT);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.3 4.4 3.4 16.6A1.7 1.7 0 0 0 4.9 19.2h14.2a1.7 1.7 0 0 0 1.5-2.6L13.7 4.4a1.7 1.7 0 0 0-3.4 0z"/></svg>
                Dépréciations & Ruptures potentielles
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${patchNote.deprecations.map(d => `
                  <div style="display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--tx2);line-height:1.5;">
                    <span style="color:var(--am);margin-top:2px;">⚠️</span>
                    <span>${d}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <a href="${patchNote?.changelog_url || 'https://www.php.net'}" target="_blank"
             style="font-size:12px;color:var(--cy);text-decoration:none;"
             onclick="event.preventDefault();invoke('open_url', { url: '${patchNote?.changelog_url}' })">
            Consulter le changelog officiel sur php.net ↗
          </a>
          <div style="margin-left:auto;display:flex;gap:8px;">
            <button class="btn btn-ghost" onclick="window.modalClose()">Fermer</button>
            <button class="btn btn-primary" ${isUpdating ? 'disabled' : ''} onclick="window.phpApplyUpgrade()">
              ${isUpdating ? 'Mise à niveau…' : `Basculer vers PHP ${selectedNewPhp}`}
            </button>
          </div>
        </div>
      </div>
    `
  }

  window.phpSelectVersion = async (v) => {
    selectedNewPhp = v
    try {
      patchNote = await invoke('get_php_patch_notes', { version: `PHP ${v}` })
    } catch {}
    render()
  }

  window.phpApplyUpgrade = async () => {
    isUpdating = true
    render()
    try {
      await invoke('change_php_version', {
        composeDir: site.compose_dir || site.path,
        newPhpVersion: selectedNewPhp,
      })
      site.php_version = `PHP ${selectedNewPhp}`
      alert(`Version PHP mise à jour avec succès vers PHP ${selectedNewPhp} !`)
      modalOverlay.remove()
      if (window.wpScan) window.wpScan()
      navigate(state.view)
    } catch (e) {
      isUpdating = false
      render()
      alert(`Erreur lors du changement de version PHP : ${e}`)
    }
  }

  render()
  document.body.appendChild(modalOverlay)
}
