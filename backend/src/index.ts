import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { SocketHandler } from './sockets/SocketHandler';

const app = express();
const server = http.createServer(app);

// Crée une instance de Server (socket.io)
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Remplace par l'URL de ton frontend si nécessaire
    methods: ["GET", "POST"],
  },
});

// Instancier le gestionnaire de sockets avec l'instance 'io'
new SocketHandler(io);

app.get('/', (req, res) => {
  res.send('Hello World');
});

// Lancer le serveur HTTP sur le port 5000
server.listen(5003, () => {
  console.log('Server running on http://localhost:5003');
});
