import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { SocketHandler } from './sockets/SocketHandler';
import { LobbyManager } from './managers/LobbyManager.js';

const app = express();
const server = http.createServer(app);

// Crée une instance de Server (socket.io)
const io = new Server(server, {
  cors: {
    // Accepter toutes les origines en développement pour permettre l'accès depuis d'autres appareils
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origin (mobile apps, Postman, etc.) ou depuis le réseau local
      if (!origin || origin.includes('localhost') || origin.match(/^http:\/\/192\.168\.\d+\.\d+:\d+$/)) {
        callback(null, true);
      } else {
        callback(null, true); // En dev, autoriser tout. En prod, restreindre selon les besoins
      }
    },
    methods: ["GET", "POST"],
  },
});

// Instancier le gestionnaire de sockets avec l'instance 'io'
new SocketHandler(io);

// Démarrer le service de nettoyage des lobbies inactifs
LobbyManager.startCleanupInterval();

app.get('/', (req, res) => {
  res.send('Hello World');
});

// Lancer le serveur HTTP sur le port 5000
server.listen(8080, () => {
  console.log('Server running on http://localhost:8080');
});
