# @onskone/shared

Package de types TypeScript partagés entre le frontend et le backend du jeu Onskone.

## 📦 Installation

### Dans le backend

```bash
cd backend
npm install --save ../shared
```

Ou ajouter dans `backend/package.json`:
```json
{
  "dependencies": {
    "@onskone/shared": "file:../shared"
  }
}
```

### Dans le frontend

```bash
cd frontend
npm install --save ../shared
```

Ou ajouter dans `frontend/package.json`:
```json
{
  "dependencies": {
    "@onskone/shared": "file:../shared"
  }
}
```

## 🔨 Build

```bash
cd shared
npm install
npm run build
```

Cela va compiler les types TypeScript vers `dist/`.

## 📖 Usage

### Backend

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

// Types pour Socket.IO
import { Server } from 'socket.io';

const io: Server<ClientToServerEvents, ServerToClientEvents> = new Server(server, {
  cors: { origin: "*" }
});

// Maintenant tous les événements sont typés!
io.on('connection', (socket) => {
  socket.on('createLobby', (data) => {
    // 'data' est typé automatiquement comme { playerName: string }
    console.log(data.playerName);
  });

  socket.emit('lobbyCreated', { lobbyCode: 'ABC123' }); // ✅ Typé
  socket.emit('wrongEvent', {}); // ❌ TypeScript error!
});
```

### Frontend

```typescript
import {
  Player,
  Game,
  RoundPhase,
  ServerToClientEvents,
  ClientToServerEvents
} from '@onskone/shared';
import { io, Socket } from 'socket.io-client';

// Socket typé
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('http://localhost:8080');

// Tous les événements sont typés
socket.emit('createLobby', { playerName: 'Alice' }); // ✅ OK
socket.emit('createLobby', { wrongField: true }); // ❌ TypeScript error!

socket.on('gameStarted', (data) => {
  // 'data.game' est typé comme IGame
  console.log(data.game.status);
});
```

## 📝 Types disponibles

- **IPlayer**: Joueur
- **ILobby**: Lobby (salle d'attente)
- **IRound**: Round de jeu
- **IGame**: Partie
- **GameCard**: Carte de question
- **RoundPhase**: Enum des phases d'un round
- **GameStatus**: Enum des statuts de jeu
- **LeaderboardEntry**: Entrée du classement
- **RevealResult**: Résultat d'une réponse
- **ServerToClientEvents**: Événements serveur → client
- **ClientToServerEvents**: Événements client → serveur

## 🔄 Workflow de développement

1. Modifier les types dans `shared/src/types/`
2. Rebuild: `npm run build` (ou `npm run watch` en dev)
3. Les changements sont automatiquement disponibles dans frontend et backend

## ⚠️ Important

- Toujours rebuild après avoir modifié les types
- En développement, utiliser `npm run watch` pour rebuild automatique
- Les deux projets (frontend/backend) doivent installer le package shared