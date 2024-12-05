"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const SocketHandler_1 = require("./sockets/SocketHandler"); // Import de la classe qui gère les événements des sockets
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Crée une instance de Server (socket.io)
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "http://localhost:3000", // Remplace par l'URL de ton frontend si nécessaire
        methods: ["GET", "POST"],
    },
});
// Instancier le gestionnaire de sockets avec l'instance 'io'
new SocketHandler_1.SocketHandler(io);
app.get('/', (req, res) => {
    res.send('Hello World');
});
// Lancer le serveur HTTP sur le port 5000
server.listen(5000, () => {
    console.log('Server running on http://localhost:5000');
});
