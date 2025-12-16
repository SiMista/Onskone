import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { SocketHandler } from './sockets/SocketHandler';
import * as LobbyManager from './managers/LobbyManager.js';

const app = express();
const server = http.createServer(app);

// Liste blanche des origines autorisées en production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];

// Crée une instance de Server (socket.io)
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // En production, vérifier la liste blanche
      if (process.env.NODE_ENV === 'production') {
        // Autoriser les requêtes sans origin (mobile apps, server-to-server)
        if (!origin) {
          callback(null, true);
          return;
        }
        // Vérifier si l'origine est dans la liste blanche
        if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        // Si ALLOWED_ORIGINS est vide, autoriser le même domaine
        if (ALLOWED_ORIGINS.length === 0) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed by CORS'));
        return;
      }

      // En développement, autoriser localhost et réseau local
      if (!origin || origin.includes('localhost') || origin.match(/^http:\/\/192\.168\.\d+\.\d+:\d+$/)) {
        callback(null, true);
      } else {
        callback(null, true);
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
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
