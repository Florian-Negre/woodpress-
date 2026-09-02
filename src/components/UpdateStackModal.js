import { state } from '../app.js'
import { invoke } from '@tauri-apps/api/core'

export function showUpdateStackModal(site, onUpdated) {
  const existing = document.getElementById('wp-update-stack-modal')
  if (existing) existing.remove()

  const modalOverlay = document.createElement('div')
  modalOverlay.id = 'wp-update-stack-modal'
  modalOverlay.className = 'modal-overlay'

  const currentWp = site.wp_version || '7.0.4'
  let targetWp = state.latestWpVersion || '7.1'
  if (targetWp === currentWp) {
    targetWp = '7.1'
  }

  let isRunning = false
  let currentStep = 0
  let isSuccess = false

  // Versions disponibles pour choisir des versions intermédiaires
  const AVAILABLE_TARGETS = [
    { value: '7.1', label: '7.1 (dernière release)', tag: 'Récente' },
    { value: '7.0.4', label: '7.0.4 (version stabilisée v.x.4)', tag: 'Recommandée' },
    { value: '6.7.2', label: '6.7.2 (Rollins LTS)', tag: 'Éprouvée' },
    { value: '6.6.3', label: '6.6.3 (Dorsey LTS)', tag: 'Legacy' },
  ]

  function getAdvice(current, target) {
    const curMajor = parseFloat(current) || 7.0
    const tarMajor = parseFloat(target) || 7.1

    if (tarMajor - curMajor >= 0.4) {
      return {
        type: 'danger',
        badge: '⚠️ Grand écart de version',
        text: 'Trop d\'écart de versions. Soyez prudent, vérifiez vos extensions ou sélectionnez une version intermédiaire ci-dessus avant de franchir ce palier.',
        color: 'var(--rdT)',
        bg: 'var(--rdBg)',
        bd: 'var(--rdBd)',
      }
    }

    if (target.endsWith('.0') || target.endsWith('.1')) {
      return {
        type: 'warning',
        badge: '💡 Conseil stabilité agence (politique v.x.4)',
        text: 'Pour les sites critiques en production, la communauté privilégie souvent les révisions stabilisées (ex: v.x.4). Vous pouvez attendre la révision 7.1.4, ou mettre à jour maintenant après la sauvegarde .AZF.',
        color: 'var(--amT)',
        bg: 'var(--amBg)',
        bd: 'var(--amBd)',
      }
    }

    return {
      type: 'success',
      badge: '🛡️ Version stabilisée',
      text: 'Mise à jour de maintenance recommandée. Les correctifs de sécurité et de stabilité peuvent être appliqués en toute sérénité.',
      color: 'var(--grnT)',
      bg: 'var(--grnBg)',
      bd: 'var(--grnBd)',
    }
  }

  const stepsList = [
    { n: '1', title: 'Sauvegarde complète en .AZF', detail: '≈ 380 Mo, dans le dossier de sauvegardes' },
    { n: '2', title: 'Arrêt des conteneurs', detail: 'wordpress, mariadb, phpmyadmin, mailpit' },
    { n: '3', title: 'Remplacement du cœur WordPress', detail: 'wp-admin et wp-includes — wp-content n\'est pas touché' },
    { n: '4', title: 'Redémarrage et migration de la base', detail: 'wp core update-db' },
    { n: '5', title: 'Vérification', detail: 'réponse HTTP 200 et version affichée' },
  ]

  function render() {
    const advice = getAdvice(currentWp, targetWp)

    modalOverlay.innerHTML = `
      <div class="modal" style="
        width: 640px;
        max-width: 95vw;
        max-height: 94vh;
        background: #0b0f17;
        border: 1px solid #1e293b;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.8);
        display: flex;
        flex-direction: column;
        color: #f1f5f9;
        font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      ">
        <!-- En-tête -->
        <div style="padding: 18px 24px; border-bottom: 1px solid #1e293b; display: flex; align-items: flex-start; justify-content: space-between;">
          <div>
            <div style="font-family: 'Poppins', sans-serif; font-size: 18px; font-weight: 700; color: #ffffff;">
              Mettre à jour <span style="font-family: 'JetBrains Mono', monospace; font-size: 16px; color: var(--cy);">${site.name}</span>
            </div>
            <div style="font-size: 12.5px; color: #94a3b8; margin-top: 3px;">
              WordPress ${currentWp} → ${targetWp}
            </div>
          </div>
        </div>

        <!-- Corps scrollable -->
        <div style="padding: 22px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
          <!-- 2 Cartes : ACTUELLE -> CIBLE -->
          <div style="display: flex; align-items: center; gap: 16px;">
            <!-- Carte Actuelle -->
            <div style="flex: 1; background: #0e1420; border: 1px solid #1e293b; border-radius: 10px; padding: 14px 18px;">
              <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b;">
                ACTUELLE
              </div>
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; margin-top: 6px; color: #ffffff;">
                ${currentWp}
              </div>
            </div>

            <div style="font-size: 20px; color: #64748b;">→</div>

            <!-- Carte Cible -->
            <div style="flex: 1; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.35); border-radius: 10px; padding: 14px 18px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #4ade80;">
                  CIBLE
                </div>
                <!-- Sélecteur de versions intermédiaires -->
                <select id="target-wp-picker" style="background: transparent; border: none; color: #4ade80; font-size: 11px; cursor: pointer; outline: none;">
                  ${AVAILABLE_TARGETS.map(t => `
                    <option value="${t.value}" ${t.value === targetWp ? 'selected' : ''} style="background: #0b0f17; color: #f1f5f9;">
                      ${t.label}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; margin-top: 6px; color: #4ade80;">
                ${targetWp}
              </div>
            </div>
          </div>

          <!-- Conseil de stabilité (v.x.4 / intermédiaire / prudence) -->
          <div style="
            background: ${advice.bg};
            border: 1px solid ${advice.bd};
            border-radius: 8px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          ">
            <div style="font-size: 12px; font-weight: 700; color: ${advice.color};">
              ${advice.badge}
            </div>
            <div style="font-size: 12px; color: #cbd5e1; line-height: 1.5;">
              ${advice.text}
            </div>
          </div>

          <!-- Ce qui va se passer (5 étapes) -->
          <div>
            <div style="font-size: 13.5px; font-weight: 600; color: #ffffff; margin-bottom: 12px;">
              Ce qui va se passer
            </div>
            <div style="display: flex; flex-direction: column; gap: 0;">
              ${stepsList.map(s => {
                const idx = parseInt(s.n, 10)
                const isStepActive = isRunning && currentStep === idx
                const isStepDone = isRunning && currentStep > idx

                return `
                  <div style="
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 10px 0;
                    border-bottom: 1px solid #172033;
                  ">
                    <span style="
                      width: 22px;
                      height: 22px;
                      border-radius: 50%;
                      border: 1px solid ${isStepDone ? '#4ade80' : isStepActive ? 'var(--cy)' : '#334155'};
                      color: ${isStepDone ? '#4ade80' : isStepActive ? 'var(--cy)' : '#64748b'};
                      background: ${isStepDone ? 'rgba(34,197,94,0.1)' : 'transparent'};
                      font-family: 'JetBrains Mono', monospace;
                      font-size: 11px;
                      font-weight: 600;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      flex-shrink: 0;
                      margin-top: 1px;
                    ">
                      ${isStepDone ? '✓' : isStepActive ? '<span class="animate-spin">🔄</span>' : s.n}
                    </span>
                    <div style="flex: 1;">
                      <div style="font-size: 13px; font-weight: 600; color: ${isStepActive ? 'var(--cy)' : '#ffffff'};">
                        ${s.title}
                      </div>
                      <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
                        ${s.detail}
                      </div>
                    </div>
                  </div>
                `
              }).join('')}
            </div>
          </div>

          <!-- Encart d'assurance repli / rollback -->
          <div style="
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(56, 189, 248, 0.08);
            border: 1px solid rgba(56, 189, 248, 0.25);
            border-radius: 8px;
            padding: 12px 14px;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.9" stroke-linecap="round" style="flex-shrink: 0;">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" />
            </svg>
            <div style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; flex: 1;">
              En cas d'échec, la sauvegarde de l'étape 1 est restaurée automatiquement. Le site revient en ${currentWp}.
            </div>
          </div>
        </div>

        <!-- Pied de page -->
        <div style="
          padding: 14px 24px;
          border-top: 1px solid #1e293b;
          background: #080c14;
          display: flex;
          align-items: center;
          gap: 12px;
        ">
          <div style="font-size: 12px; color: #64748b; flex: 1;">
            Durée estimée : 2 à 4 minutes
          </div>
          <button
            type="button"
            class="btn btn-ghost"
            ${isRunning ? 'disabled' : ''}
            onclick="window.wpCloseUpdateStackModal()"
            style="color: #94a3b8; font-size: 13px; font-weight: 600;"
          >
            Fermer
          </button>
          <button
            type="button"
            id="launch-update-btn"
            style="
              background: #84cc16;
              color: #0b0f17;
              border: none;
              border-radius: 8px;
              padding: 9px 18px;
              font-size: 13.5px;
              font-weight: 700;
              cursor: pointer;
              transition: background 0.15s;
            "
            ${isRunning ? 'disabled' : ''}
            onmouseenter="this.style.background='#65a30d'"
            onmouseleave="this.style.background='#84cc16'"
            onclick="window.wpExecuteStackUpdate()"
          >
            ${isRunning ? 'Mise à jour en cours…' : 'Lancer la mise à jour'}
          </button>
        </div>
      </div>
    `

    const picker = document.getElementById('target-wp-picker')
    if (picker) {
      picker.addEventListener('change', (e) => {
        targetWp = e.target.value
        render()
      })
    }
  }

  window.wpExecuteStackUpdate = async () => {
    isRunning = true
    currentStep = 1
    render()

    try {
      // Étape 1 : Sauvegarde
      currentStep = 1
      render()
      await new Promise(r => setTimeout(r, 600))

      // Étape 2 : Arrêt des conteneurs
      currentStep = 2
      render()
      await new Promise(r => setTimeout(r, 500))

      // Étape 3 & 4 : Application Rust
      currentStep = 3
      render()

      const updatedSite = await invoke('update_site_stack', {
        composeDir: site.compose_dir || site.path,
        targetWp: targetWp,
        targetPhp: '8.4',
      })

      // Étape 4 : Migration DB
      currentStep = 4
      render()
      await new Promise(r => setTimeout(r, 500))

      // Étape 5 : Vérification
      currentStep = 5
      render()
      await new Promise(r => setTimeout(r, 600))

      if (updatedSite) {
        site.wp_version = updatedSite.wp_version || targetWp
        site.php_version = updatedSite.php_version || 'PHP 8.4'
      } else {
        site.wp_version = targetWp
      }

      modalOverlay.remove()
      alert(`✅ Mise à jour réussie !\n\nLe site ${site.name} a été mis à niveau vers WordPress ${targetWp}.`)

      if (onUpdated) onUpdated()
      if (window.wpScanWorkspaces) window.wpScanWorkspaces()
    } catch (err) {
      alert(`Erreur lors de la mise à jour : ${err}`)
      isRunning = false
      currentStep = 0
      render()
    }
  }

  window.wpCloseUpdateStackModal = () => {
    modalOverlay.remove()
  }

  render()
  document.body.appendChild(modalOverlay)
}
