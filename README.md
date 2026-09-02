# 🪵 WoodPress 2.0

> **L'orchestrateur WordPress & Docker local haute performance pour agences et créateurs web.**  
> Développé par **Florian Nègre — Codinflo** (`https://codinflo.fr/atelier`).

[![Release](https://img.shields.io/github/v/release/Florian-Negre/woodpress-?color=22c55e&label=version)](https://github.com/Florian-Negre/woodpress-/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-orange.svg)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-1.75+-brown.svg)](https://www.rust-lang.org)

---

## ✨ Fonctionnalités Clés

- 🚀 **Multi-sites simultanés sans conflit** : Chaque site WordPress possède sa pile Docker hermétique (Apache, MariaDB, PhpMyAdmin, Mailpit) avec ports isolés.
- ⚡ **Détection universelle & Conteneurisation 1-clic** : Analyse vos répertoires et convertit automatiquement vos sites existants (Laragon, WampServer, XAMPP) vers Docker sans jamais modifier vos fichiers sources.
- 📦 **Sauvegardes universelles .AZF** : Export et import de packages complets (fichiers + base de données SQL) transférables en 30 secondes.
- 🐘 **Switcher PHP (8.2 à 8.5)** : Basculez la version PHP de vos sites en 1 clic avec consultation intégrée des nouveautés et dépréciations officielles.
- 🌐 **Domaines locaux personnalisés (`.local`)** : Accédez à vos sites via `https://monsite.local` avec synchronisation automatique du fichier hosts Windows (élévation UAC) et mise à jour MySQL.
- 🔍 **Établi & Diagnostic de santé** : Gestion des utilisateurs WordPress, réinitialisation de mot de passe en 1 clic, logs Docker en direct.

---

## 🛠️ Stack Technique

- **Frontend** : Vanilla JavaScript + CSS moderne, Vite.
- **Desktop Runtime** : Tauri 2.0 (Rust).
- **Conteneurisation** : Docker & Docker Compose.
- **Companion Plugin** : [`woodpress_bridge`](https://github.com/Florian-Negre/woodpress_bridge).

---

## 🚀 Développement Local

### Prérequis
- [Node.js 18+](https://nodejs.org)
- [Rust & Cargo](https://rustup.rs)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### Lancement
```bash
# 1. Cloner le dépôt
git clone https://github.com/Florian-Negre/woodpress-.git
cd woodpress-

# 2. Installer les dépendances frontend
npm install

# 3. Lancer en mode développement
npm run tauri dev
```

### Compilation Release
```bash
npm run build
npx tauri build --no-bundle
```

---

## 📖 Documentation & Liens

- **Documentation Agences** : Consultez [`GUIDE_AGENCE.md`](GUIDE_AGENCE.md).
- **Site Officiel & Téléchargement** : [`https://codinflo.fr/atelier`](https://codinflo.fr/atelier).
- **Extension WordPress Companion** : [`https://github.com/Florian-Negre/woodpress_bridge`](https://github.com/Florian-Negre/woodpress_bridge).
