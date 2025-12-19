import { io, Socket } from "socket.io-client";
import { SERVER_URL } from '../constants/game';
import { ServerToClientEvents, ClientToServerEvents } from '@onskone/shared';

// Socket typé avec les événements serveur→client et client→serveur
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity, // Ne jamais abandonner (important pour mobile)
  timeout: 20000,
});

export default socket;
