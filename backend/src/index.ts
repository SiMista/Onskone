import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { SocketHandler } from './sockets/SocketHandler';
import * as LobbyManager from './managers/LobbyManager.js';
import { stopAllRateLimiters } from './utils/rateLimiter.js';
import ticketsRouter from './routes/tickets.js';
import adminDataRouter from './routes/adminData.js';
import { printBanner } from './utils/banner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Déploiement derrière un reverse proxy (1 hop) : faire confiance au premier
// X-Forwarded-For pour que req.ip reflète l'IP réelle du client. Sans ça, le
// rate-limit anti-bruteforce (login admin, tickets) serait contournable en
// forgeant le header X-Forwarded-For.
app.set('trust proxy', 1);

import logger from './utils/logger.js';

// Liste blanche des origines autorisées en production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o.length > 0)
  : [];

// Origines des apps natives Capacitor : toujours autorisées (web ET prod).
// Android sert la page depuis https://localhost, iOS depuis capacitor://localhost.
const CAPACITOR_ORIGINS = ['capacitor://localhost', 'https://localhost'];

// Validation de la configuration en production
if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.length === 0) {
  logger.warn('SECURITY WARNING: ALLOWED_ORIGINS is not set in production. CORS will reject all browser requests!');
}

// Crée une instance de Server (socket.io)
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // En production, vérifier la liste blanche strictement.
      // Politique alignée sur le middleware HTTP : on n'autorise plus
      // inconditionnellement les requêtes sans Origin. Les apps natives Capacitor
      // envoient bien un Origin (capacitor://localhost / https://localhost) couvert
      // par CAPACITOR_ORIGINS ; un client navigateur légitime envoie toujours un Origin.
      if (process.env.NODE_ENV === 'production') {
        // Apps natives Capacitor (toujours autorisées)
        if (origin && CAPACITOR_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        // Vérifier si l'origine est dans la liste blanche
        if (origin && ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        // Sinon (Origin absent ou non autorisé), rejeter
        callback(new Error('Origin not allowed by CORS'));
        return;
      }

      // En développement, autoriser localhost et réseau local uniquement
      if (!origin) {
        callback(null, true);
        return;
      }
      // Match EXACT d'origine (pas de sous-chaîne : 'evil-localhost.com' ne doit pas passer).
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/.test(origin)) {
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
LobbyManager.startCleanupInterval(io);

// Middleware CORS pour les routes HTTP REST (tickets + admin)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    let allowed = false;
    if (process.env.NODE_ENV === 'production') {
      allowed = ALLOWED_ORIGINS.includes(origin) || CAPACITOR_ORIGINS.includes(origin);
    } else {
      allowed = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/.test(origin);
    }
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '128kb' }));

app.use('/api', ticketsRouter);
app.use('/api', adminDataRouter);

// En production, servir le frontend statique. Le dossier est resolu via
// FRONTEND_DIST si présent, sinon ../frontend/build par rapport au backend.
const FRONTEND_DIST = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.resolve(__dirname, '../../frontend/build');

if (fs.existsSync(FRONTEND_DIST)) {
  logger.info(`Serving frontend from ${FRONTEND_DIST}`);
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.send('Hello World');
  });
}

// Lancer le serveur HTTP (port défini par PORT, sinon 8080 par défaut)
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  printBanner();
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

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
});
