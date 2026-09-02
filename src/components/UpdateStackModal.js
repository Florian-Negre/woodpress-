import { state } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export function showUpdateStackModal(site, onUpdated) {
  const existing = document.getElementById('wp-update-stack-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-update-stack-modal'
  modalOverlay.className = 'modal-overlay'

  let selectedWp = site.wp_version || '7.0.4'
  let selectedPhp = site.php_version ? site.php_version.replace('PHP ', '').trim() : '8.4'
  let isUpdating = false
  let stepMessage = ''

  const WP_VERSIONS = [
    { value: '7.0.4', label: 'WordPress 7.0.4 (Dernière officielle stable)' },
    { value: '6.7.2', label: 'WordPress 6.7.2 (Rollins)' },
    { value: '6.6.2', label: 'WordPress 6.6.2 (Dorsey)' },
    { value: 'latest', label: 'latest (Toujours la dernière release Docker)' },
  ]

  const PHP_VERSIONS = [
    { value: '8.4', label: 'PHP 8.4 (Recommandé & Moderne)' },
    { value: '8.3', label: 'PHP 8.3 (Stable éprouvé)' },
    { value: '8.2', label: 'PHP 8.2 (Compatibilité legacy)' },
    { value: '8.5', label: 'PHP 8.5 (Preview / Expérimental)' },
  ]

  function render() {
    modalOverlay.innerHTML = `
      <div class="modal" style="width: 540px; max-width: 95vw;">
        <!-- Header -->
        <div class="modal-header" style="border-bottom:1px solid var(--bd);padding:18px 24px;">
          <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">
            ⚡ Mettre à jour la Stack — ${site.name}
          </div>
          <div style="font-size:12px;color:var(--tx3);margin-top:3px;">
            Actuel : WordPress ${site.wp_version || 'Non détecté'} · ${site.php_version || 'PHP 8.4'}
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:18px;">
          <!-- Version WordPress -->
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;display:block;">
              Version cible de WordPress
            </label>
            <select id="update-wp-select" class="input" style="width:100%;cursor:pointer;">
              ${WP_VERSIONS.map(v => `
                <option value="${v.value}" ${selectedWp === v.value ? 'selected' : ''}>${v.label}</option>
              `).join('')}
            </select>
          </div>

          <!-- Version PHP -->
          <div>
            <label style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;display:block;">
              Version cible de PHP
            </label>
            <select id="update-php-select" class="input" style="width:100%;cursor:pointer;">
              ${PHP_VERSIONS.map(v => `
                <option value="${v.value}" ${selectedPhp === v.value ? 'selected' : ''}>${v.label}</option>
              `).join('')}
            </select>
          </div>

          <!-- Avertissement professionnel -->
          <div style="background:var(--surf2);border:1px solid var(--bd);border-radius:8px;padding:12px 14px;font-size:12px;color:var(--tx2);line-height:1.6;">
            🛡️ <strong>Précautions d'agence :</strong> Le tag de l'image Apache/PHP dans votre <span class="font-mono">docker-compose.yml</span> sera mis à jour et les conteneurs seront recréés avec <span class="font-mono">--force-recreate</span> sans altérer vos fichiers <span class="font-mono">wp-content</span> ni votre base de données MySQL.
          </div>

          ${isUpdating ? `
            <div style="background:var(--surf);border:1px solid var(--bd);border-radius:8px;padding:12px;display:flex;align-items:center;gap:10px;">
              <span class="animate-spin" style="font-size:16px;">🔄</span>
              <span style="font-size:12px;color:var(--tx);font-weight:500;">${stepMessage || 'Mise à jour en cours…'}</span>
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div class="modal-footer" style="border-top:1px solid var(--bd);padding:14px 24px;display:flex;gap:10px;">
          <button class="btn btn-ghost" ${isUpdating ? 'disabled' : ''} onclick="window.modalClose()">Annuler</button>
          <button class="btn btn-primary" style="margin-left:auto;" ${isUpdating ? 'disabled' : ''} onclick="window.wpApplyStackUpdate()">
            ${isUpdating ? 'Application en cours…' : '⚡ Appliquer et Redémarrer'}
          </button>
        </div>
      </div>
    `

    const wpSelect = document.getElementById('update-wp-select')
    if (wpSelect) wpSelect.addEventListener('change', (e) => { selectedWp = e.target.value })
    const phpSelect = document.getElementById('update-php-select')
    if (phpSelect) phpSelect.addEventListener('change', (e) => { selectedPhp = e.target.value })
  }

  window.wpApplyStackUpdate = async () => {
    isUpdating = true
    stepMessage = '1/3 · Modification de docker-compose.yml…'
    render()

    try {
      stepMessage = '2/3 · Téléchargement des images & recréation des conteneurs…'
      render()

      const updatedSite = await invoke('update_site_stack', {
        composeDir: site.compose_dir || site.path,
        targetWp: selectedWp,
        targetPhp: selectedPhp,
      })

      stepMessage = '3/3 · Synchronisation terminée !'
      render()

      if (updatedSite) {
        site.wp_version = updatedSite.wp_version
        site.php_version = updatedSite.php_version
        site.status = updatedSite.status
      }

      modalOverlay.remove()
      alert(`✅ Stack mise à jour avec succès !\n\n• WordPress : ${selectedWp}\n• PHP : ${selectedPhp}\n• Les conteneurs ont été recréés et redémarrés.`)

      if (onUpdated) onUpdated()
    } catch (e) {
      alert(`Erreur lors de la mise à jour : ${e}`)
      isUpdating = false
      render()
    }
  }

  render()
  document.body.appendChild(modalOverlay)
}
