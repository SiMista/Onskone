# Onskoné? 🎭

**Onskoné?** est un jeu multijoueur en ligne simple, amusant et intuitif, conçu pour apprendre à mieux connaître les autres joueurs de manière ludique et surprenante.

Le but du jeu est d’apprendre à mieux connaître les autres joueurs de manière ludique et surprenante. Chaque joueur partage une partie de lui-même en répondant à des questions personnelles, comme ses goûts, ses habitudes ou ses défauts. Le pilier de la manche, qui doit deviner quelle réponse correspond à quel joueur, explore ses capacités de déduction et son intuition tout en essayant de comprendre la personnalité des autres, tout en s'amusant avec les surprises et les erreurs de déduction du pilier.


## 🧠 Concept du jeu

Le but du jeu est d’apprendre à mieux connaître les autres joueurs en utilisant son intuition, son sens de l'observation ou ses souvenirs !

À chaque manche :
- Un joueur est désigné au hasard comme **pilier de la manche** (ou "leader").
- Ce pilier reçoit une **carte** contenant un thème (ex : goûts, habitudes, défauts...) et **3 questions personnelles**.
- Il choisit **une question à poser à tous les joueurs** (lui y compris).
- Les réponses sont **envoyées anonymement**.
- Le pilier doit ensuite **deviner quelle réponse appartient à quel joueur**.


## ⚙️ Fonctionnement

### 🧰 Technologies utilisées

- **Frontend** : React + Vite + TypeScript + Tailwind CSS + Socket.IO-client
- **Backend** : Node.js + TypeScript + Express + Socket.IO
- **Shared** : Types TypeScript partagés
- **Monorepo** : pnpm workspaces

### 🚀 Fonctionnalités principales

- Création et partage facile de **salons** via un code d'invitation
- Gestion des **joueurs** avec rôle d'**hôte**
- Sélection aléatoire de **cartes de jeu avec 3 questions**
- Réponses anonymes et système de **déduction**
- Communication en temps réel via **WebSockets**
- Interface simple et responsive

---

## 📁 Structure du Monorepo

```
onskone/
├── frontend/          # Application React (Vite + TypeScript)
├── backend/           # Serveur Node.js (Express + Socket.IO)
├── shared/            # Types TypeScript partagés (@onskone/shared)
├── pnpm-workspace.yaml
└── package.json
```

## 🚀 Installation & Développement

### Prérequis

- **Node.js** >= 18
- **pnpm** >= 8

Si pnpm n'est pas installé:
```bash
npm install -g pnpm
```

### Installation

À la racine du projet:
```bash
pnpm install
```

Cela installe toutes les dépendances de tous les packages (frontend, backend, shared).

### Lancer en développement

```bash
# Lancer tout (frontend + backend + shared en mode watch)
pnpm dev

# Ou individuellement:
pnpm dev:frontend   # http://localhost:3000
pnpm dev:backend    # http://localhost:8080
pnpm dev:shared     # Rebuild auto des types
```

### Build

```bash
# Build tous les packages
pnpm build

# Ou individuellement:
pnpm build:shared    # Toujours builder shared en premier!
pnpm build:frontend
pnpm build:backend
```

## 📦 Gestion des dépendances avec pnpm

### Ajouter une dépendance

```bash
# Dans le frontend
pnpm --filter frontend add axios

# Dans le backend
pnpm --filter backend add joi

# Dans shared
pnpm --filter @onskone/shared add -D @types/node

# À la racine (dev dependencies globales)
pnpm add -w -D prettier
```

### Supprimer une dépendance

```bash
pnpm --filter frontend remove axios
```

## 🔄 Types Partagés

Le package `@onskone/shared` contient tous les types partagés entre frontend et backend:

```typescript
import {
  IPlayer,
  ILobby,
  IRound,
  IGame,
  RoundPhase,
  GameStatus,
  ServerToClientEvents,
  ClientToServerEvents
} from '@onskone/shared';
```

### Workflow types

1. Modifier les types dans `shared/src/types/`
2. Ils sont automatiquement rebuild si `pnpm dev:shared` tourne
3. Frontend et backend les utilisent via `@onskone/shared`

## 🧹 Nettoyage

```bash
# Supprimer tous les node_modules et fichiers build
pnpm clean

# Réinstaller proprement
pnpm install
```

## 📝 Scripts disponibles

| Script | Description |
|--------|-------------|
| `pnpm dev` | Lance frontend + backend + shared en mode dev |
| `pnpm dev:frontend` | Lance uniquement le frontend |
| `pnpm dev:backend` | Lance uniquement le backend |
| `pnpm dev:shared` | Lance shared en mode watch |
| `pnpm build` | Build tous les packages |
| `pnpm clean` | Nettoie tous les node_modules |
