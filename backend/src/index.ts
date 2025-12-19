import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { SocketHandler } from './sockets/SocketHandler';
import * as LobbyManager from './managers/LobbyManager.js';
import { stopAllRateLimiters } from './utils/rateLimiter.js';

const app = express();
const server = http.createServer(app);

import logger from './utils/logger.js';

// Liste blanche des origines autorisées en production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o.length > 0)
  : [];

// Validation de la configuration en production
if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.length === 0) {
  logger.warn('SECURITY WARNING: ALLOWED_ORIGINS is not set in production. CORS will reject all browser requests!');
}

// Crée une instance de Server (socket.io)
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // En production, vérifier la liste blanche strictement
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
        // En production sans ALLOWED_ORIGINS configuré, rejeter les requêtes cross-origin
        callback(new Error('Origin not allowed by CORS'));
        return;
      }

      // En développement, autoriser localhost et réseau local uniquement
      if (!origin) {
        callback(null, true);
        return;
      }
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.match(/^http:\/\/192\.168\.\d+\.\d+:\d+$/)) {
        callback(null, true);
        return;
      }
      // Rejeter les autres origines en dev aussi
      callback(new Error('Origin not allowed by CORS in development'));
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

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  // Stop the cleanup interval
  LobbyManager.stopCleanupInterval();

  // Stop all rate limiters
  stopAllRateLimiters();

  // Close the server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
