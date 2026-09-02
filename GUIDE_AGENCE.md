# 🪵 WoodPress 2.0 — Guide de Déploiement & Bonnes Pratiques pour Agences Web

> **Orchestrateur WordPress & Docker Haute Performance**  
> *Auteur : Florian Nègre — Codinflo*  
> *Documentation officielle : `https://codinflo.fr/atelier`*

---

## 🎯 1. Pourquoi WoodPress pour votre agence ?

Les agences et freelances WordPress gèrent couramment des dizaines de sites en local avec des configurations éclatées (Laragon, WampServer, LocalWP, XAMPP).  
Ces outils historiques posent des limites majeures :
1. **Conflits de ports récurrents** (port 80 ou 3306 déjà pris).
2. **Version PHP globale** : impossible de faire tourner un vieux projet PHP 8.1 en même temps qu'un projet moderne PHP 8.4 ou 8.5.
3. **Pollution de la machine hôte** et difficultés de migration d'un poste à un autre.

**WoodPress résout cela nativement :**
- ✅ **Multi-sites simultanés** : chaque WordPress s'exécute dans une pile Docker 100% hermétique et isolée (`-p <projet>`).
- ✅ **Détection universelle** : scanne vos dossiers de travail existants et détecte instantanément vos sites Docker ou Laragon/WAMP.
- ✅ **Conteneurisation en 1 clic** : migre un site Laragon/WAMP vers Docker sans jamais modifier vos fichiers sources.
- ✅ **Sauvegardes et déploiements universels `.AZF`** : archive complète (fichiers + base de données MySQL) transférable en 30 secondes.

---

## 🚀 2. Démarrage Rapide

### Prérequis
1. **Windows 10/11 ou Linux**.
2. **Docker Desktop** (ou moteur Docker natif sous Linux) installé et lancé.
3. **Téléchargement** : Installez WoodPress depuis [`https://codinflo.fr/atelier`](https://codinflo.fr/atelier) ou via GitHub Releases.

### Premier lancement & Déclaration des Espaces de Travail
1. Lancez **WoodPress**.
2. Cliquez sur `+ Ajouter un dossier de travail` dans la barre latérale pour déclarer vos répertoires (ex: `C:\Workspace`, `D:\Clients-Sites`, `E:\Laragon\www`).
3. Cliquez sur **`🔄 Scanner`** : WoodPress découvre automatiquement l'ensemble de vos sites en moins de 100 ms !

---

## ⚡ 3. Migrer vos anciens sites Laragon / WAMP / Standalone

Si vous avez des sites locaux existants :
1. Le site apparaît dans l'Atelier avec un badge d'avertissement ambre : **`⚡ Laragon / WampServer détecté`**.
2. Cliquez sur le bouton **`⚡ Conteneuriser Docker`** sur la carte.
3. Choisissez le port local souhaité et la version de PHP (PHP 8.2, 8.3, 8.4 ou 8.5).
4. Cliquez sur **`Créer l'environnement Docker`** :
   - WoodPress génère un fichier `docker-compose.yml` optimisé avec Apache, MariaDB, PhpMyAdmin et Mailpit.
   - Vos fichiers `wp-content/`, plugins, thèmes et médias restent **strictement intacts**.
   - Le site démarre immédiatement !

---

## 📦 4. Le format de sauvegarde universel `.AZF`

Le format `.AZF` (Archive Zippée Fournie) est le standard d'échange de WoodPress.

### Exporter un site en `.AZF` :
- Cliquez sur le menu **`···`** de la carte du site > **`💾 Exporter .AZF`** (ou depuis l'Établi).
- WoodPress génère une archive compressée contenant :
  - La totalité des fichiers WordPress (`wp-content`, plugins, thèmes, uploads).
  - Le dump complet de la base de données SQL (`database.sql`).
  - Le fichier de métadonnées (`manifest.json` avec version WP, PHP et configuration).

### Importer un `.AZF` chez un collaborateur ou un client :
- Cliquez sur **`Importer .AZF`** dans l'en-tête de l'Atelier.
- Sélectionnez le fichier `.AZF`, choisissez le nom du projet et le port HTTP.
- WoodPress décompresse l'archive, injecte automatiquement la base de données MySQL et démarre le site en 30 secondes chrono !

---

## 🐘 5. Gestion des versions PHP & Patch Notes

Chaque projet WordPress peut avoir sa propre version PHP sans impacter les autres :
1. Cliquez sur le lien PHP de la carte ou rendez-vous dans l'**Établi** du site.
2. Consultez la modale **Patch Notes PHP** avec les nouveautés officielles (Property Hooks, Asymmetric Visibility, JIT, etc.).
3. Sélectionnez la version cible (**PHP 8.2 / 8.3 / 8.4 / 8.5**) et validez : WoodPress met à jour la configuration Docker et redémarre la pile en quelques secondes.

---

## 🌐 6. Domaines Locaux Personnalisés (`.local`)

Pour éviter de travailler avec des URLs de type `localhost:8080` :
1. Dans l'Établi du site, cliquez sur l'URL du domaine local (ex: `monclient.local`).
2. Définissez le nom de domaine souhaité (ex: `axpc84.local`).
3. WoodPress :
   - Ajoute automatiquement la résolution `127.0.0.1 monclient.local` dans le fichier système `hosts` (avec gestion automatique des droits Windows UAC).
   - Met à jour les options `siteurl` et `home` dans la table MySQL `wp_options`.

---

## 🔑 7. Gestion des Utilisateurs WordPress & Dépannage

- **Ajout d'un compte Administrateur d'urgence** : dans l'Établi > onglet *Utilisateurs WP*, cliquez sur `+ Ajouter un utilisateur` pour créer un accès admin sans passer par le terminal ou phpMyAdmin.
- **Réinitialisation de mot de passe** : un clic sur `🔑 Réinitialiser MDP` génère un nouveau hash MD5 direct dans la base de données.
- **Conflits de ports** : si un port HTTP est déjà utilisé par un autre logiciel, WoodPress le surligne en rouge et propose un bouton `Résoudre` qui réassigne un port libre en 1 clic.

---

## 🔄 8. Mises à Jour de WoodPress (Auto-Updater)

WoodPress intègre un système de mise à jour automatique connecté aux releases GitHub officielles (`Florian-Negre/woodpress`).  
Dès qu'une nouvelle version est publiée, l'application vous avertit au démarrage et met à jour le binaire en toute transparence.

---

*Pour toute question ou contribution : [https://github.com/Florian-Negre/woodpress](https://github.com/Florian-Negre/woodpress)*
