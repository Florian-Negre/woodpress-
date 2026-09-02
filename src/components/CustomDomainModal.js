import { state } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export function showCustomDomainModal(site) {
  const existing = document.getElementById('wp-domain-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-domain-modal'
  modalOverlay.className = 'modal-overlay'

  let domain = site.custom_domain || `${site.name.toLowerCase()}.local`
  let useHttps = false
  let isSaving = false

  function render() {
    modalOverlay.innerHTML = `
      <div class="modal" style="width: 520px; max-width: 95vw;">
        <!-- Header -->
        <div class="modal-header">
          <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">
            🌐 Domaine local personnalisé
          </div>
          <div style="font-size:12px;color:var(--tx3);margin-top:2px;">
            Configurez un domaine en .local pour "${site.name}"
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:16px;">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Nom de domaine local :</div>
            <input id="domain-name-input" class="input input-mono" placeholder="ex: axpc84.local" value="${domain}" />
          </div>

          <div style="display:flex;align-items:center;gap:10px;background:var(--surf2);border:1px solid var(--bd);border-radius:8px;padding:12px 14px;">
            <input id="domain-https-check" type="checkbox" ${useHttps ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--cy);cursor:pointer;" />
            <label for="domain-https-check" style="font-size:13px;color:var(--tx);cursor:pointer;">
              Activer le protocole HTTPS sécurisé (<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--cy)">https://${domain}</span>)
            </label>
          </div>

          <div style="font-size:12px;color:var(--tx3);line-height:1.6;">
            💡 WoodPress configure automatiquement :
            <ul style="margin:6px 0 0 18px;padding:0;">
              <li>L'alias dans votre fichier Windows <span style="font-family:'JetBrains Mono',monospace">hosts</span> (<span style="color:var(--tx2)">127.0.0.1 ${domain}</span>)</li>
              <li>Les options <span style="font-family:'JetBrains Mono',monospace">siteurl</span> et <span style="font-family:'JetBrains Mono',monospace">home</span> dans votre base de données MySQL.</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="window.modalClose()">Annuler</button>
          <button class="btn btn-primary" ${isSaving ? 'disabled' : ''} onclick="window.applyDomain()">
            ${isSaving ? 'Configuration en cours…' : 'Enregistrer le domaine'}
          </button>
        </div>
      </div>
    `

    const dInput = document.getElementById('domain-name-input')
    if (dInput) dInput.addEventListener('input', e => domain = e.target.value)
    const hCheck = document.getElementById('domain-https-check')
    if (hCheck) hCheck.addEventListener('change', e => useHttps = e.target.checked)
  }

  window.applyDomain = async () => {
    if (!domain.trim()) {
      alert('Veuillez spécifier un nom de domaine.')
      return
    }

    isSaving = true
    render()

    try {
      await invoke('set_site_domain', {
        sitePath: site.path,
        composeDir: site.compose_dir || site.path,
        domain: domain.trim(),
        port: site.http_port || 80,
        useHttps,
      })

      site.custom_domain = domain.trim()
      alert(`Domaine local "${domain.trim()}" configuré avec succès !`)
      modalOverlay.remove()
      if (window.wpScan) window.wpScan()
    } catch (e) {
      isSaving = false
      render()
      alert(`Erreur : ${e}`)
    }
  }

  render()
  document.body.appendChild(modalOverlay)
}
