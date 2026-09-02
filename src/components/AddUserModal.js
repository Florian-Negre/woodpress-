import { state } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export function showAddUserModal(site, onUserAdded) {
  const existing = document.getElementById('wp-user-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-user-modal'
  modalOverlay.className = 'modal-overlay'

  let login = ''
  let email = ''
  let password = ''
  let role = 'administrator'
  let isSubmitting = false

  function render() {
    modalOverlay.innerHTML = `
      <div class="modal" style="width: 520px; max-width: 95vw;">
        <!-- Header -->
        <div class="modal-header">
          <div style="font-family:'Poppins',sans-serif;font-size:17px;font-weight:600;color:var(--tx);">
            Ajouter un utilisateur WordPress
          </div>
          <div style="font-size:12px;color:var(--tx3);margin-top:2px;">
            Création directe dans la base de données de "${site.name}"
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:24px;display:flex;flex-direction:column;gap:14px;">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Identifiant / Login *</div>
            <input id="user-login-input" class="input" placeholder="ex: redacteur_chef" value="${login}" />
          </div>

          <div>
            <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Adresse Email *</div>
            <input id="user-email-input" type="email" class="input" placeholder="ex: redacteur@mon-site.local" value="${email}" />
          </div>

          <div>
            <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Mot de passe *</div>
            <input id="user-pass-input" type="password" class="input" placeholder="Mot de passe sécurisé" value="${password}" />
          </div>

          <div>
            <div style="font-size:12px;font-weight:600;color:var(--tx2);margin-bottom:6px;">Rôle WordPress</div>
            <select id="user-role-select" class="input" style="background:var(--surf);color:var(--tx);">
              <option value="administrator" ${role === 'administrator' ? 'selected' : ''}>Administrateur (Tous les droits)</option>
              <option value="editor" ${role === 'editor' ? 'selected' : ''}>Éditeur (Gestion du contenu)</option>
              <option value="author" ${role === 'author' ? 'selected' : ''}>Auteur (Publication d'articles)</option>
              <option value="subscriber" ${role === 'subscriber' ? 'selected' : ''}>Abonné (Lecture seule)</option>
            </select>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="window.modalClose()">Annuler</button>
          <button id="user-submit-btn" class="btn btn-primary" ${isSubmitting ? 'disabled' : ''} onclick="window.submitAddUser()">
            ${isSubmitting ? 'Création en cours…' : 'Créer l\'utilisateur'}
          </button>
        </div>
      </div>
    `

    const loginEl = document.getElementById('user-login-input')
    if (loginEl) loginEl.addEventListener('input', e => login = e.target.value)
    const emailEl = document.getElementById('user-email-input')
    if (emailEl) emailEl.addEventListener('input', e => email = e.target.value)
    const passEl = document.getElementById('user-pass-input')
    if (passEl) passEl.addEventListener('input', e => password = e.target.value)
    const roleEl = document.getElementById('user-role-select')
    if (roleEl) roleEl.addEventListener('change', e => role = e.target.value)
  }

  window.submitAddUser = async () => {
    if (!login.trim() || !email.trim() || !password.trim()) {
      alert('Veuillez remplir tous les champs obligatoires.')
      return
    }

    isSubmitting = true
    render()

    try {
      await invoke('add_wp_user', {
        composeDir: site.compose_dir || site.path,
        userLogin: login.trim(),
        userEmail: email.trim(),
        password: password.trim(),
        role,
      })

      alert(`Utilisateur "${login}" créé avec succès !`)
      modalOverlay.remove()
      if (onUserAdded) onUserAdded()
    } catch (e) {
      isSubmitting = false
      render()
      alert(`Erreur lors de la création de l'utilisateur : ${e}`)
    }
  }

  render()
  document.body.appendChild(modalOverlay)
}
