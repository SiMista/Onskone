import { io, Socket } from "socket.io-client";

// Connexion à ton backend sur le port 5000
const socket: Socket = io("http://localhost:5000");

export default socket;
