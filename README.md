# Onskoné? 🎭

**Onskoné?** est un jeu multijoueur en ligne, simple, amusant et intuitif, conçu pour apprendre à mieux connaître les autres joueurs de manière ludique et surprenante.

Chaque joueur partage une partie de lui-même en répondant à des questions personnelles (goûts, habitudes, défauts, souvenirs…). Le **pilier de la manche** doit deviner quelle réponse appartient à quel joueur, en mobilisant son intuition, son sens de l'observation et sa connaissance des autres.

Jouez **en présentiel** autour d'une table ou **à distance**, en petit groupe ou jusqu'à **20 joueurs**.

---

## 🧠 Concept du jeu

À chaque manche :

1. Un joueur est désigné comme **pilier** (leader) de la manche.
2. Le pilier reçoit une **carte** (catégorie + thème + sujet) avec **3 questions** au choix. Il peut **relancer** sa carte jusqu'à 3 fois s'il n'en aime aucune.
3. Il choisit **une question** à poser à tous les joueurs (lui inclus).
4. Tous répondent **anonymement** dans le temps imparti.
5. Le pilier doit ensuite **attribuer chaque réponse au bon joueur** par drag & drop.
6. La **phase de révélation** dévoile les bonnes attributions, calcule les scores du round et met à jour le **score collectif** de la partie.

### 🎮 Deux modes de jeu

- **Classique** : le pilier répond aussi à sa propre question, comme tout le monde.
- **Devine ma réponse** : le pilier ne répond pas. Il choisit un **substitut** qui écrit la réponse qu'il imagine à sa place - au pilier ensuite de retrouver qui a écrit quoi (y compris la fausse réponse rédigée pour lui).

### 🏠 Présentiel ou distanciel

- **Local (présentiel)** : interface optimisée pour partager un même écran et passer le téléphone.
- **Remote (distanciel)** : chaque joueur sur son propre appareil, idéal pour les soirées en ligne.

---

## ✨ Fonctionnalités

- 🔗 **Salons** créés en un clic, partagés via un **code à 6 caractères**
- 👤 **Avatars** personnalisables (18 illustrations) et pseudo
- 🃏 **Sélection de decks** : l'hôte choisit les **catégories et thèmes** activés pour la partie
- ♻️ **Relances de cartes** (3 par round) pour le pilier
- ⏱️ **Timers synchronisés** côté serveur pour chaque phase (sélection, réponse, devinette)
- 🧠 **Système de scoring par similarité** : les réponses très proches sont automatiquement reconnues comme équivalentes
- 🏆 **Score collectif** & **paliers de connaissance** (jusqu'à 100 %) pour mesurer la complicité du groupe
- 🎉 **Émojis et réactions** en temps réel
- 🔁 **Reconnexion** transparente en cas de coupure
- 🔒 **Salons fermés** une fois la partie démarrée (pas d'intrusion en cours de jeu)
- 📱 **Interface responsive** (mobile, tablette, desktop, mode paysage optimisé)
- 🔊 **Effets sonores** et animations soignées
- 📊 **Analytics** via Umami (privacy-friendly)

---

## ⚙️ Stack technique

- **Frontend** : React + Vite + TypeScript + Tailwind CSS + Socket.IO-client
- **Backend** : Node.js + TypeScript + Express + Socket.IO
- **Shared** : package de types TypeScript partagés (`@onskone/shared`)
- **Monorepo** : pnpm workspaces

---

## 📁 Structure du monorepo

```
onskone/
├── frontend/          # Application React (Vite + TypeScript)
├── backend/           # Serveur Node.js (Express + Socket.IO)
├── shared/            # Types & constantes partagés (@onskone/shared)
├── pnpm-workspace.yaml
└── package.json
```

Documentation de déploiement :

- [DEPLOYMENT_CLOUD.md](./DEPLOYMENT_CLOUD.md) - déploiement sur plateformes cloud
- [DEPLOYMENT_VPS.md](./DEPLOYMENT_VPS.md) - déploiement sur VPS

---

## 🚀 Installation & développement

### Prérequis

- **Node.js** ≥ 18
- **pnpm** ≥ 8

```bash
npm install -g pnpm
```

### Installation

```bash
pnpm install
```

### Lancer en développement

```bash
# Frontend + backend + shared (mode watch) en parallèle
pnpm dev

# Ou individuellement :
pnpm dev:frontend   # http://localhost:3000
pnpm dev:backend    # http://localhost:8080
pnpm dev:shared     # rebuild auto des types partagés
```

Sous Windows, vous pouvez utiliser `start-dev.bat`. Sous Linux/macOS, `start-dev.sh`.

### Build

```bash
# Build complet
pnpm build

# Ou étape par étape (toujours shared en premier !)
pnpm build:shared
pnpm build:frontend
pnpm build:backend
```

### Vérifications

```bash
pnpm typecheck
pnpm lint
```

---

## 📦 Gestion des dépendances avec pnpm

```bash
# Ajouter une dépendance dans un package
pnpm --filter frontend add axios
pnpm --filter backend add joi
pnpm --filter @onskone/shared add -D @types/node

# Dépendance dev globale (racine)
pnpm add -w -D prettier

# Supprimer
pnpm --filter frontend remove axios
```

---

## 🔄 Types partagés

Le package `@onskone/shared` contient tous les types et constantes partagés entre frontend et backend :

```typescript
import {
  IPlayer,
  ILobby,
  IRound,
  IGame,
  RoundPhase,
  GameStatus,
  GameMode,
  GameCard,
  SelectedDecks,
  ServerToClientEvents,
  ClientToServerEvents,
  GAME_CONSTANTS,
} from '@onskone/shared';
```

### Workflow

1. Modifier les types dans `shared/src/types/`.
2. Ils sont rebuild automatiquement si `pnpm dev:shared` tourne.
3. Frontend et backend les consomment via `@onskone/shared`.

---

## 🧹 Nettoyage

```bash
# Supprime tous les node_modules et fichiers de build
pnpm clean

# Réinstallation propre
pnpm install
```

---

## 📝 Scripts disponibles

| Script               | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `pnpm dev`           | Lance frontend + backend + shared en mode dev        |
| `pnpm dev:frontend`  | Lance uniquement le frontend                         |
| `pnpm dev:backend`   | Lance uniquement le backend                          |
| `pnpm dev:shared`    | Lance shared en mode watch                           |
| `pnpm build`         | Build tous les packages                              |
| `pnpm build:shared`  | Build le package shared (à faire avant les autres)   |
| `pnpm build:frontend`| Build le frontend                                    |
| `pnpm build:backend` | Build le backend                                     |
| `pnpm typecheck`     | Vérification TypeScript sur tous les packages        |
| `pnpm lint`          | Lint tous les packages                               |
| `pnpm clean`         | Nettoie node_modules et fichiers de build            |
