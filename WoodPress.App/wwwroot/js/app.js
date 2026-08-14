// État global de l'application
let projects = [];
let selectedProjectId = null;
let currentFilter = 'all'; // 'all' | 'running' | 'stopped' | 'unlinked'
let latestWpVersion = '7.0.4';
let availableWpVersions = ['7.0.4', '7.0.3', '7.0.0', '6.7.2', '6.6.2', 'latest'];

// Éléments DOM
const dockerStatusBadge = document.getElementById('docker-status');
const wpLatestVersionEl = document.getElementById('wp-latest-version');
const btnCheckWpUpdate = document.getElementById('btn-check-wp-update');
const btnRescanDisks = document.getElementById('btn-rescan-disks');
const projectsGrid = document.getElementById('projects-grid');
const searchInput = document.getElementById('project-search');
const toastContainer = document.getElementById('toast-container');

// Compteurs onglets
const countAll = document.getElementById('count-all');
const countRunning = document.getElementById('count-running');
const countStopped = document.getElementById('count-stopped');
const countUnlinked = document.getElementById('count-unlinked');

// Modales
const modalNewProject = document.getElementById('modal-new-project');
const modalExport = document.getElementById('modal-export');
const modalDelete = document.getElementById('modal-delete');
const modalImport = document.getElementById('modal-import');
const modalLinkDocker = document.getElementById('modal-link-docker');
const modalUpdateWp = document.getElementById('modal-update-wp');
const modalWorkspaces = document.getElementById('modal-workspaces');
const modalOnboarding = document.getElementById('modal-onboarding');
const btnWorkspacesSettings = document.getElementById('btn-workspaces-settings');

let appConfig = { workspaces: [], isConfigured: false };

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 200);
  }, 4500);
}

// ==========================================
// API & DONNÉES
// ==========================================

// 1. Statut Docker
async function checkDocker() {
  try {
    const res = await fetch('/api/docker/status');
    const data = await res.json();
    if (data.isRunning) {
      dockerStatusBadge.className = 'docker-status-badge online';
      dockerStatusBadge.querySelector('.status-label').textContent = 'Docker actif';
    } else {
      dockerStatusBadge.className = 'docker-status-badge offline';
      dockerStatusBadge.querySelector('.status-label').textContent = 'Docker arrêté';
    }
  } catch (err) {
    dockerStatusBadge.className = 'docker-status-badge offline';
    dockerStatusBadge.querySelector('.status-label').textContent = 'Erreur Docker';
  }
}

// 2. Dernière version WordPress officielle
async function fetchLatestWordPress(force = false) {
  try {
    const res = await fetch(`/api/wp/latest-version?force=${force}`);
    const data = await res.json();
    latestWpVersion = data.version || '7.0.4';
    wpLatestVersionEl.textContent = latestWpVersion;

    if (data.availableVersions) {
      availableWpVersions = data.availableVersions;
    }

    if (force) {
      showToast(`Dernière version WordPress stable : ${latestWpVersion}`, 'success');
    }
  } catch (err) {
    console.error('Erreur version WordPress:', err);
    wpLatestVersionEl.textContent = '7.0.4';
  }
}

// 2b. Configuration des espaces de travail
async function loadAppConfig() {
  try {
    const res = await fetch('/api/config');
    appConfig = await res.json();

    renderWorkspacesList();
    populateWorkspaceSelect();

    if (!appConfig.isConfigured || !appConfig.workspaces || appConfig.workspaces.length === 0) {
      openModal(modalOnboarding);
    }
  } catch (err) {
    console.error('Erreur chargement config:', err);
  }
}

function populateWorkspaceSelect() {
  const select = document.getElementById('select-project-workspace');
  if (!select) return;

  if (!appConfig.workspaces || appConfig.workspaces.length === 0) {
    select.innerHTML = `<option value="">Aucun espace configuré (Dossier par défaut)</option>`;
    return;
  }

  select.innerHTML = appConfig.workspaces.map((ws) => {
    return `<option value="${ws.id}" ${ws.isDefault ? 'selected' : ''}>${escapeHtml(ws.name)} (${escapeHtml(ws.path)})</option>`;
  }).join('');
}

function renderWorkspacesList() {
  const container = document.getElementById('workspaces-list-container');
  if (!container) return;

  if (!appConfig.workspaces || appConfig.workspaces.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8; font-size:0.85rem;">Aucun espace configuré pour l'instant.</p>`;
    return;
  }

  container.innerHTML = appConfig.workspaces.map((ws) => {
    return `
      <div class="audit-item-card" style="display:flex; flex-direction:row; align-items:center; justify-content:space-between; margin-bottom:0.5rem;">
        <div>
          <strong style="color:#ffffff; font-size:0.9rem;">${escapeHtml(ws.name)}</strong>
          ${ws.isDefault ? '<span class="item-badge badge-uptodate" style="margin-left:0.4rem;">Par défaut</span>' : ''}
          <div style="color:#94a3b8; font-size:0.8rem; margin-top:0.15rem;">📁 ${escapeHtml(ws.path)}</div>
        </div>
        <button class="btn btn-ghost btn-sm btn-delete-ws" data-ws-id="${ws.id}" title="Supprimer cet espace">
          🗑️
        </button>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.btn-delete-ws').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.wsId;
      if (!confirm('Supprimer cet espace de travail de WoodPress ? (Vos fichiers sur disque ne seront pas effacés)')) return;

      try {
        await fetch(`/api/config/workspaces/${id}`, { method: 'DELETE' });
        showToast('Espace de travail retiré.', 'info');
        await loadAppConfig();
        loadDiscoveredProjects();
      } catch (err) {
        showToast('Erreur lors de la suppression de l\'espace', 'error');
      }
    };
  });
}

// 3. Scan et découverte des projets sur disque
async function loadDiscoveredProjects(showToastNotification = false) {
  try {
    const res = await fetch('/api/scanner/discover');
    projects = await res.json();
    renderProjects();
    if (showToastNotification) {
      showToast(`Scan terminé : ${projects.length} projets WordPress détectés.`, 'info');
    }
  } catch (err) {
    console.error('Erreur scan projets:', err);
    showToast('Erreur lors du scan des disques', 'error');
  }
}

// 4. Ports suggérés pour un nouveau projet
async function fetchSuggestedPorts() {
  try {
    const res = await fetch('/api/ports/suggest');
    const ports = await res.json();
    document.getElementById('input-http-port').value = ports.httpPort;
    document.getElementById('input-db-port').value = ports.dbPort;
    document.getElementById('input-pma-port').value = ports.pmaPort;
  } catch (err) {
    console.error('Erreur suggestion ports:', err);
  }
}

// ==========================================
// RENDU DE L'INTERFACE
// ==========================================
function renderProjects() {
  const query = searchInput.value.toLowerCase().trim();

  // Filtrage par texte et par onglet
  const filtered = projects.filter((p) => {
    const matchesQuery =
      p.projectName.toLowerCase().includes(query) ||
      (p.clientName && p.clientName.toLowerCase().includes(query)) ||
      (p.httpPort && p.httpPort.toString().includes(query)) ||
      (p.projectDir && p.projectDir.toLowerCase().includes(query));

    if (!matchesQuery) return false;

    if (currentFilter === 'running') return p.dockerStatus === 'running';
    if (currentFilter === 'stopped') return p.dockerStatus === 'stopped';
    if (currentFilter === 'unlinked') return p.dockerStatus === 'not_linked' || !p.hasDocker;

    return true;
  });

  // Mise à jour des compteurs
  countAll.textContent = projects.length;
  countRunning.textContent = projects.filter((p) => p.dockerStatus === 'running').length;
  countStopped.textContent = projects.filter((p) => p.dockerStatus === 'stopped').length;
  countUnlinked.textContent = projects.filter((p) => p.dockerStatus === 'not_linked' || !p.hasDocker).length;

  if (filtered.length === 0) {
    if (projects.length === 0) {
      projectsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🪵</div>
          <h3>Aucun projet WordPress détecté</h3>
          <p>Créez votre premier projet ou lancez un scan de vos disques G:\\ et E:\\.</p>
          <button class="btn btn-primary" onclick="openModal(modalNewProject)">
            ➕ Créer un projet
          </button>
        </div>
      `;
    } else {
      projectsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>Aucun résultat</h3>
          <p>Aucun projet ne correspond au filtre actif.</p>
        </div>
      `;
    }
    return;
  }

  projectsGrid.innerHTML = filtered.map((project) => {
    const isRunning = project.dockerStatus === 'running';
    const isUnlinked = project.dockerStatus === 'not_linked' || !project.hasDocker;
    const isLearning = project.type === 'learning';
    const wpVer = project.wpVersion || 'Inconnue';

    return `
      <div class="project-card ${isUnlinked ? 'unlinked' : ''}" data-project-id="${project.id}">
        <div class="card-top">
          <div class="project-info">
            <h3>${escapeHtml(project.clientName || project.projectName)}</h3>
            <div class="project-badges">
              <span class="project-type-badge ${isLearning ? 'learning' : ''}">
                ${isLearning ? '🎓 Learning' : '💼 Workspace'}
              </span>
              <span class="wp-ver-pill" title="Version de WordPress détectée">
                WP ${escapeHtml(wpVer)}
              </span>
            </div>
          </div>
          <div class="project-status ${isUnlinked ? 'unlinked' : (isRunning ? 'running' : 'stopped')}">
            <span class="status-dot"></span>
            <span>${isUnlinked ? 'Non lié Docker' : (isRunning ? 'En ligne' : 'Arrêté')}</span>
          </div>
        </div>

        <div class="card-meta">
          <div class="meta-item">
            <span class="meta-label">Port HTTP</span>
            <span class="meta-value">${project.httpPort ? `:${project.httpPort}` : '<em style="color:#64748b;">Non configuré</em>'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Port BDD</span>
            <span class="meta-value">${project.dbPort ? `:${project.dbPort}` : '<em style="color:#64748b;">Non configuré</em>'}</span>
          </div>
          <div class="meta-item" style="grid-column: 1 / -1;">
            <span class="meta-label">Chemin</span>
            <span class="meta-value" title="${escapeHtml(project.projectDir)}">${escapeHtml(project.projectDir)}</span>
          </div>
        </div>

        ${!isUnlinked && project.httpPort ? `
          <div class="card-links">
            <a href="http://localhost:${project.httpPort}" target="_blank" class="link-btn">
              🌐 Ouvrir le site
            </a>
            <a href="http://localhost:${project.httpPort}/wp-admin" target="_blank" class="link-btn">
              🔑 WP-Admin
            </a>
            ${project.enablePma && project.pmaPort ? `
              <a href="http://localhost:${project.pmaPort}" target="_blank" class="link-btn">
                🗄️ PhpMyAdmin
              </a>
            ` : ''}
            ${project.enableMailpit && project.mailPort ? `
              <a href="http://localhost:${project.mailPort}" target="_blank" class="link-btn">
                ✉️ Mailpit
              </a>
            ` : ''}
          </div>
        ` : ''}

        <div class="card-actions">
          <!-- Rangée principale -->
          <div class="action-row">
            ${isUnlinked ? `
              <button class="btn btn-link-docker btn-sm btn-link-to-docker" 
                data-dir="${escapeHtml(project.projectDir)}" 
                data-name="${escapeHtml(project.projectName)}" 
                data-client="${escapeHtml(project.clientName)}">
                🔗 Lier à Docker
              </button>
            ` : (isRunning ? `
              <button class="btn btn-secondary btn-sm btn-stop" data-id="${project.id}" data-dir="${escapeHtml(project.projectDir)}" title="Arrêter les conteneurs">
                ⏹️ Stop
              </button>
              <button class="btn btn-secondary btn-sm btn-restart" data-id="${project.id}" data-dir="${escapeHtml(project.projectDir)}" title="Redémarrer">
                🔄 Restart
              </button>
            ` : `
              <button class="btn btn-primary btn-sm btn-start" data-id="${project.id}" data-dir="${escapeHtml(project.projectDir)}" title="Démarrer les conteneurs">
                ▶️ Démarrer
              </button>
            `)}

            ${!isUnlinked ? `
              <button class="btn btn-repair btn-sm btn-repair-db" 
                data-id="${project.id}" 
                data-dir="${escapeHtml(project.projectDir)}" 
                data-name="${escapeHtml(project.projectName)}"
                data-port="${project.httpPort || 8081}"
                title="Créer ou réparer la base de données MySQL et la configuration">
                🛠️ Réparer BDD
              </button>
            ` : ''}
          </div>

          <!-- Rangée secondaire -->
          <div class="action-row secondary-row">
            <div class="action-group">
              ${!isUnlinked ? `
                <button class="btn btn-secondary btn-sm btn-update-wp" 
                  data-id="${project.id}" 
                  data-dir="${escapeHtml(project.projectDir)}" 
                  data-name="${escapeHtml(project.projectName)}"
                  data-ver="${escapeHtml(wpVer)}"
                  title="Mettre à jour la version de WordPress">
                  🔄 MAJ WP
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm btn-details" 
                data-id="${project.id}" 
                data-dir="${escapeHtml(project.projectDir)}" 
                data-name="${escapeHtml(project.projectName)}"
                title="Audit des plugins, thèmes et risques de mise à jour">
                🔍 Détails
              </button>
              <button class="btn btn-secondary btn-sm btn-folder" data-id="${project.id}" data-dir="${escapeHtml(project.projectDir)}" title="Voir les fichiers dans l'explorateur Windows">
                📁 Fichiers
              </button>
              ${!isUnlinked ? `
                <button class="btn btn-secondary btn-sm btn-export" data-id="${project.id}" data-dir="${escapeHtml(project.projectDir)}" title="Exporter">
                  💾 Exporter
                </button>
              ` : ''}
            </div>

            <button class="btn btn-ghost btn-sm btn-delete" data-id="${project.id}" data-dir="${escapeHtml(project.projectDir)}" title="Supprimer le projet">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  attachCardEvents();
}

// ==========================================
// ÉVÉNEMENTS SUR LES CARTES
// ==========================================
function attachCardEvents() {
  // Lier à Docker
  document.querySelectorAll('.btn-link-to-docker').forEach((btn) => {
    btn.onclick = async () => {
      const dir = btn.dataset.dir;
      const name = btn.dataset.name;
      const client = btn.dataset.client;

      document.getElementById('link-project-dir').value = dir;
      document.getElementById('link-client-name').value = client || name;
      document.getElementById('link-project-slug').value = slugify(name);

      // Calcul des ports libres suggérés
      const portsRes = await fetch('/api/ports/suggest');
      const ports = await portsRes.json();
      document.getElementById('link-http-port').value = ports.httpPort;
      document.getElementById('link-db-port').value = ports.dbPort;
      document.getElementById('link-pma-port').value = ports.pmaPort;

      openModal(modalLinkDocker);
    };
  });

  // Mettre à jour WordPress
  document.querySelectorAll('.btn-update-wp').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const dir = btn.dataset.dir;
      const name = btn.dataset.name;
      const currentVer = btn.dataset.ver;

      document.getElementById('update-wp-project-id').value = id;
      document.getElementById('update-wp-project-dir').value = dir;
      document.getElementById('update-wp-desc').innerHTML =
        `Projet : <strong>${name}</strong> (Version actuelle : <code>WP ${currentVer}</code>)`;

      // Remplissage du select avec la dernière version en premier
      const select = document.getElementById('select-target-wp-version');
      select.innerHTML = `
        <option value="${latestWpVersion}" selected>WordPress ${latestWpVersion} (Dernière version stable ✨)</option>
        <option value="7.0.3">WordPress 7.0.3</option>
        <option value="7.0.0">WordPress 7.0.0</option>
        <option value="6.7.2">WordPress 6.7.2</option>
        <option value="6.6.2">WordPress 6.6.2</option>
        <option value="latest">Dernière version Apache (latest)</option>
      `;

      openModal(modalUpdateWp);
    };
  });

  // Réparer la BDD
  document.querySelectorAll('.btn-repair-db').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const dir = btn.dataset.dir;
      const name = btn.dataset.name;
      const port = btn.dataset.port || 8081;

      if (!confirm(`Voulez-vous réparer / initialiser la base de données pour "${name}" ?\n\nCela va recréer la BDD dans Docker et configurer wp-config.php pour vous permettre d'accéder au site.`)) {
        return;
      }

      btn.disabled = true;
      btn.textContent = '⏳ Réparation...';

      try {
        const res = await fetch(`/api/projects/${id}/repair-db`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectDir: dir })
        });
        const data = await res.json();

        if (data.success) {
          showToast(`BDD réparée ! Ouverture de l'installation WordPress...`, 'success');
          // Ouvre l'installation WordPress dans un nouvel onglet
          window.open(`http://localhost:${port}/wp-admin/install.php`, '_blank');
          loadDiscoveredProjects();
        } else {
          showToast(data.error || 'Erreur lors de la réparation de la BDD', 'error');
        }
      } catch (err) {
        showToast('Erreur serveur lors de la réparation', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '🛠️ Réparer BDD';
      }
    };
  });

  // Démarrer
  document.querySelectorAll('.btn-start').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const dir = btn.dataset.dir;
      btn.disabled = true;
      btn.textContent = '⏳ ...';
      try {
        await fetch(`/api/projects/${id}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectDir: dir })
        });
        showToast('Projet démarré avec succès !', 'success');
        loadDiscoveredProjects();
      } catch (err) {
        showToast('Erreur de démarrage', 'error');
      }
    };
  });

  // Arrêter
  document.querySelectorAll('.btn-stop').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const dir = btn.dataset.dir;
      btn.disabled = true;
      btn.textContent = '⏳ ...';
      try {
        await fetch(`/api/projects/${id}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectDir: dir })
        });
        showToast('Projet arrêté.', 'info');
        loadDiscoveredProjects();
      } catch (err) {
        showToast('Erreur lors de l\'arrêt', 'error');
      }
    };
  });

  // Redémarrer
  document.querySelectorAll('.btn-restart').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const dir = btn.dataset.dir;
      btn.disabled = true;
      btn.textContent = '⏳ ...';
      try {
        await fetch(`/api/projects/${id}/restart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectDir: dir })
        });
        showToast('Projet redémarré avec succès !', 'success');
        loadDiscoveredProjects();
      } catch (err) {
        showToast('Erreur lors du redémarrage', 'error');
      }
    };
  });

  // Détails & Audit
  document.querySelectorAll('.btn-details').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const dir = btn.dataset.dir;
      const name = btn.dataset.name;
      loadAndDisplayAudit(id, dir, name);
    };
  });

  // Voir les fichiers
  document.querySelectorAll('.btn-folder').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const dir = btn.dataset.dir;
      try {
        await fetch(`/api/projects/${id}/open-folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectDir: dir })
        });
        showToast('Explorateur de fichiers ouvert !', 'info');
      } catch (err) {
        showToast('Impossible d\'ouvrir le dossier', 'error');
      }
    };
  });

  // Exporter
  document.querySelectorAll('.btn-export').forEach((btn) => {
    btn.onclick = () => {
      selectedProjectId = btn.dataset.id;
      const project = projects.find((p) => p.id === selectedProjectId);
      if (project) {
        document.getElementById('export-project-info').textContent =
          `Projet : ${project.clientName || project.projectName} (:${project.httpPort || '?'})`;
        openModal(modalExport);
      }
    };
  });

  // Supprimer
  document.querySelectorAll('.btn-delete').forEach((btn) => {
    btn.onclick = () => {
      selectedProjectId = btn.dataset.id;
      const project = projects.find((p) => p.id === selectedProjectId);
      if (project) {
        document.getElementById('delete-project-name').textContent =
          `"${project.clientName || project.projectName}"`;
        openModal(modalDelete);
      }
    };
  });
}

// ==========================================
// GESTION DES ONGLETS & FILTRES
// ==========================================
document.querySelectorAll('.filter-tab').forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderProjects();
  };
});

// Bouton vérification MAJ WordPress officielle
btnCheckWpUpdate.onclick = () => {
  btnCheckWpUpdate.style.transform = 'rotate(360deg)';
  fetchLatestWordPress(true);
  setTimeout(() => {
    btnCheckWpUpdate.style.transform = 'none';
  }, 400);
};

// Bouton Scanner les disques
btnRescanDisks.onclick = () => {
  btnRescanDisks.disabled = true;
  btnRescanDisks.textContent = '⏳ Scan en cours...';
  loadDiscoveredProjects(true).finally(() => {
    btnRescanDisks.disabled = false;
    btnRescanDisks.textContent = '🔍 Scanner les disques';
  });
};

// ==========================================
// MODALES & SOUMISSIONS
// ==========================================
function openModal(modal) {
  modal.classList.add('active');
}

function closeModal(modal) {
  modal.classList.remove('active');
}

document.querySelectorAll('[data-close-modal]').forEach((btn) => {
  btn.onclick = () => {
    btn.closest('.modal-overlay').classList.remove('active');
  };
});

// Bouton Nouveau Projet
document.getElementById('btn-new-project').onclick = () => {
  fetchSuggestedPorts();
  openModal(modalNewProject);
};

// Bouton Reprendre Projet Existant
document.getElementById('btn-import-existing').onclick = () => {
  openModal(modalImport);
};

// Slug auto
document.getElementById('input-client-name').addEventListener('input', (e) => {
  const slugInput = document.getElementById('input-project-slug');
  slugInput.value = slugify(e.target.value);
});

// Formulaire : Lier à Docker
document.getElementById('form-link-docker').onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-link');
  btn.disabled = true;
  btn.textContent = '⏳ Configuration & Démarrage...';

  const payload = {
    projectDir: document.getElementById('link-project-dir').value,
    clientName: document.getElementById('link-client-name').value.trim(),
    projectName: document.getElementById('link-project-slug').value.trim(),
    httpPort: document.getElementById('link-http-port').value,
    dbPort: document.getElementById('link-db-port').value,
    pmaPort: document.getElementById('link-pma-port').value,
    phpVersion: document.getElementById('link-php-version').value,
  };

  try {
    const res = await fetch('/api/scanner/link-docker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Projet "${payload.projectName}" lié et démarré sous Docker !`, 'success');
      closeModal(modalLinkDocker);
      loadDiscoveredProjects();
    } else {
      showToast(data.error || 'Erreur lors de la liaison', 'error');
    }
  } catch (err) {
    showToast('Erreur serveur lors de la liaison Docker', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔗 Configurer & Démarrer sous Docker';
  }
};

// Formulaire : Mise à jour WordPress
document.getElementById('form-update-wp').onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-update-wp');
  btn.disabled = true;
  btn.textContent = '⏳ Mise à jour en cours...';

  const id = document.getElementById('update-wp-project-id').value;
  const projectDir = document.getElementById('update-wp-project-dir').value;
  const targetVersion = document.getElementById('select-target-wp-version').value;

  try {
    const res = await fetch(`/api/projects/${id}/update-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDir, targetVersion })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`WordPress mis à jour vers la version ${targetVersion} !`, 'success');
      closeModal(modalUpdateWp);
      loadDiscoveredProjects();
    } else {
      showToast(data.error || 'Erreur lors de la mise à jour', 'error');
    }
  } catch (err) {
    showToast('Erreur serveur lors de la mise à jour', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 Appliquer la mise à jour';
  }
};

// Bouton Réglages Espaces
btnWorkspacesSettings.onclick = () => {
  renderWorkspacesList();
  openModal(modalWorkspaces);
};

// Formulaire : Ajouter un Espace
document.getElementById('form-add-workspace').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('ws-name').value.trim();
  const wsPath = document.getElementById('ws-path').value.trim();
  const type = document.getElementById('ws-type').value;

  try {
    const res = await fetch('/api/config/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path: wsPath, type, isDefault: false })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Espace "${name}" ajouté avec succès !`, 'success');
      document.getElementById('form-add-workspace').reset();
      await loadAppConfig();
      loadDiscoveredProjects();
    } else {
      showToast(data.error || 'Erreur lors de l\'ajout', 'error');
    }
  } catch (err) {
    showToast('Erreur serveur lors de l\'ajout de l\'espace', 'error');
  }
};

// Formulaire : Onboarding Premier Lancement
document.getElementById('form-onboarding').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('onboarding-ws-name').value.trim();
  const wsPath = document.getElementById('onboarding-ws-path').value.trim();

  try {
    const res = await fetch('/api/config/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path: wsPath, type: 'workspace', isDefault: true })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Espace configuré ! Bienvenue sur WoodPress 🪵`, 'success');
      closeModal(modalOnboarding);
      await loadAppConfig();
      loadDiscoveredProjects();
    } else {
      showToast(data.error || 'Erreur de configuration', 'error');
    }
  } catch (err) {
    showToast('Erreur serveur', 'error');
  }
};

// Formulaire : Création de projet
document.getElementById('form-create-project').onsubmit = async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('btn-submit-create');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Création & Démarrage...';

  const selectedWsId = document.getElementById('select-project-workspace').value;
  const selectedWs = appConfig.workspaces?.find((w) => w.id === selectedWsId);

  const formData = {
    workspaceId: selectedWsId,
    type: selectedWs?.type || 'workspace',
    clientName: document.getElementById('input-client-name').value.trim(),
    projectName: document.getElementById('input-project-slug').value.trim(),
    httpPort: document.getElementById('input-http-port').value,
    dbPort: document.getElementById('input-db-port').value,
    pmaPort: document.getElementById('input-pma-port').value,
    phpVersion: document.getElementById('select-php-version').value,
    dbType: document.getElementById('select-db-type').value,
    enablePma: document.getElementById('check-enable-pma').checked,
    enableMailpit: document.getElementById('check-enable-mailpit').checked,
    injectAtelierPlugins: document.getElementById('check-inject-plugins').checked,
  };

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Projet "${formData.projectName}" créé et démarré avec succès !`, 'success');
      closeModal(modalNewProject);
      document.getElementById('form-create-project').reset();
      loadDiscoveredProjects();
    } else {
      showToast(data.error || 'Erreur lors de la création', 'error');
    }
  } catch (err) {
    showToast('Erreur serveur lors de la création', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="btn-icon">🚀</span> Créer & Démarrer le projet';
  }
};

// Formulaire : Exportation
document.getElementById('btn-confirm-export').onclick = async () => {
  if (!selectedProjectId) return;
  const btn = document.getElementById('btn-confirm-export');
  btn.disabled = true;
  btn.textContent = '⏳ Exportation en cours...';

  const mode = document.querySelector('input[name="exportMode"]:checked').value;
  const project = projects.find((p) => p.id === selectedProjectId);

  try {
    const res = await fetch(`/api/projects/${selectedProjectId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, projectDir: project?.projectDir, projectName: project?.projectName })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Exportation réussie : ${data.fileName}`, 'success');
      closeModal(modalExport);
    } else {
      showToast(data.error || 'Erreur lors de l\'export', 'error');
    }
  } catch (err) {
    showToast('Erreur serveur lors de l\'exportation', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">💾</span> Lancer l\'export';
  }
};

// Formulaire : Suppression sécurisée
document.getElementById('btn-confirm-delete').onclick = async () => {
  if (!selectedProjectId) return;
  const btn = document.getElementById('btn-confirm-delete');
  btn.disabled = true;
  btn.textContent = '⏳ Suppression...';

  const project = projects.find((p) => p.id === selectedProjectId);

  try {
    const res = await fetch(`/api/projects/${selectedProjectId}?deleteFiles=true`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDir: project?.projectDir })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Projet, conteneurs et fichiers supprimés.', 'success');
      closeModal(modalDelete);
      loadDiscoveredProjects();
    } else {
      showToast(data.error || 'Erreur lors de la suppression', 'error');
    }
  } catch (err) {
    showToast('Erreur serveur lors de la suppression', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🗑️ Confirmer la suppression';
  }
};

// Formulaire : Reprise de dossier existant
document.getElementById('form-import-project').onsubmit = async (e) => {
  e.preventDefault();
  const dirPath = document.getElementById('import-dir-path').value.trim();
  const clientName = document.getElementById('import-client-name').value.trim();
  const slug = document.getElementById('import-project-slug').value.trim() || slugify(clientName);

  try {
    const res = await fetch('/api/scanner/link-docker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectDir: dirPath,
        clientName,
        projectName: slug
      })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Dossier "${slug}" intégré à WoodPress !`, 'success');
      closeModal(modalImport);
      document.getElementById('form-import-project').reset();
      loadDiscoveredProjects();
    } else {
      showToast(data.error || 'Erreur lors de l\'intégration', 'error');
    }
  } catch (err) {
    showToast('Erreur serveur lors de l\'intégration', 'error');
  }
};

// ==========================================
// FONCTION AUDIT & DÉTAILS DU PROJET
// ==========================================
const modalDetails = document.getElementById('modal-details');

async function loadAndDisplayAudit(projectId, projectDir, projectName) {
  document.getElementById('details-project-name').textContent = projectName;
  document.getElementById('audit-plugins-list').innerHTML = `
    <div class="loading-state"><div class="spinner"></div><p>Audit approfondi des extensions & thèmes...</p></div>
  `;
  document.getElementById('audit-themes-list').innerHTML = '';
  document.getElementById('stat-updates-count').style.display = 'none';
  document.getElementById('stat-alerts-count').style.display = 'none';

  openModal(modalDetails);

  try {
    const res = await fetch(`/api/projects/${projectId}/details?projectDir=${encodeURIComponent(projectDir)}`);
    const data = await res.json();

    // 1. Score de santé
    const scoreVal = data.healthScore ?? 100;
    const scoreCircle = document.getElementById('audit-score-circle');
    const scoreValEl = document.getElementById('audit-score-val');
    scoreValEl.textContent = `${scoreVal}%`;

    let scoreColor = '#10b981';
    if (scoreVal < 70) scoreColor = '#ef4444';
    else if (scoreVal < 90) scoreColor = '#f59e0b';

    scoreCircle.style.background = `conic-gradient(${scoreColor} 0% ${scoreVal}%, rgba(255, 255, 255, 0.1) ${scoreVal}% 100%)`;

    // 2. Synthèse
    const summaryTitle = document.getElementById('audit-summary-title');
    const summaryDesc = document.getElementById('audit-summary-desc');

    if (data.stats.criticalAlerts > 0) {
      summaryTitle.textContent = `⚠️ ${data.stats.criticalAlerts} alerte(s) critique(s) détectée(s)`;
      summaryDesc.textContent = `Des mises à jour majeures ou de sécurité requièrent votre vigilance avant mise en production.`;
    } else if (data.stats.updatesAvailable > 0) {
      summaryTitle.textContent = `🟡 ${data.stats.updatesAvailable} mise(s) à jour disponible(s)`;
      summaryDesc.textContent = `Le projet est fonctionnel, mais des composants peuvent être actualisés en toute sécurité.`;
    } else {
      summaryTitle.textContent = `🟢 Environnement parfaitement à jour`;
      summaryDesc.textContent = `Toutes les extensions et thèmes détectés sont sur leur dernière version stable.`;
    }

    document.getElementById('stat-plugins-count').textContent = `${data.stats.totalPlugins} Plugin(s)`;
    document.getElementById('stat-themes-count').textContent = `${data.stats.totalThemes} Thème(s)`;

    if (data.stats.updatesAvailable > 0) {
      const el = document.getElementById('stat-updates-count');
      el.textContent = `${data.stats.updatesAvailable} MAJ`;
      el.style.display = 'inline-block';
    }
    if (data.stats.criticalAlerts > 0) {
      const el = document.getElementById('stat-alerts-count');
      el.textContent = `${data.stats.criticalAlerts} Alertes`;
      el.style.display = 'inline-block';
    }

    // 3. Rendu de la liste des Plugins
    const pluginsContainer = document.getElementById('audit-plugins-list');
    if (!data.plugins || data.plugins.length === 0) {
      pluginsContainer.innerHTML = `<p style="color:#94a3b8; font-size:0.9rem;">Aucune extension détectée dans wp-content/plugins/.</p>`;
    } else {
      pluginsContainer.innerHTML = data.plugins.map((p) => {
        let badgeClass = 'badge-uptodate';
        if (p.isAtelier) badgeClass = 'badge-atelier';
        else if (p.status === 'security_update') badgeClass = 'badge-security';
        else if (p.status === 'major_update') badgeClass = 'badge-major';
        else if (p.status === 'minor_update') badgeClass = 'badge-minor';

        let cardClass = 'is-uptodate';
        if (p.riskLevel === 'high' || p.isSecurity) cardClass = 'has-alert';
        else if (p.status === 'minor_update') cardClass = 'has-warning';

        return `
          <div class="audit-item-card ${cardClass}">
            <div class="item-top">
              <span class="item-name">${escapeHtml(p.name)}</span>
              <div class="item-version-badges">
                <span style="font-size:0.8rem; color:#94a3b8;">v${escapeHtml(p.currentVersion)}</span>
                ${p.latestVersion && p.latestVersion !== p.currentVersion ? `
                  <span style="font-size:0.75rem; color:#64748b;">→ v${escapeHtml(p.latestVersion)}</span>
                ` : ''}
                <span class="item-badge ${badgeClass}">${p.badge || '🟢 À jour'}</span>
              </div>
            </div>
            ${p.message ? `
              <div class="item-message ${p.riskLevel === 'high' || p.isSecurity ? 'alert-text' : ''}">
                ${escapeHtml(p.message)}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    // 4. Rendu des Thèmes
    const themesContainer = document.getElementById('audit-themes-list');
    if (!data.themes || data.themes.length === 0) {
      themesContainer.innerHTML = `<p style="color:#94a3b8; font-size:0.9rem;">Aucun thème détecté dans wp-content/themes/.</p>`;
    } else {
      themesContainer.innerHTML = data.themes.map((t) => {
        return `
          <div class="audit-item-card is-uptodate">
            <div class="item-top">
              <span class="item-name">🎨 ${escapeHtml(t.name)}</span>
              <span style="font-size:0.8rem; color:#94a3b8;">v${escapeHtml(t.version)}</span>
            </div>
            ${t.isChildTheme ? `
              <div class="item-message" style="color:#38bdf8;">
                Thème enfant de <strong>${escapeHtml(t.parentTheme)}</strong>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    document.getElementById('audit-plugins-list').innerHTML = `
      <p style="color:#ef4444;">Erreur lors du chargement des détails : ${err.message}</p>
    `;
  }
}

// Recherche en direct
searchInput.addEventListener('input', renderProjects);

// Helpers
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Initialisation au chargement
loadAppConfig();
checkDocker();
fetchLatestWordPress(false);
loadDiscoveredProjects(false);

// Polling régulier
setInterval(checkDocker, 8000);
setInterval(() => loadDiscoveredProjects(false), 6000);

