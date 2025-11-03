import { io, Socket } from "socket.io-client";
import { SERVER_URL } from '../constants/game';
import { ServerToClientEvents, ClientToServerEvents } from '@onskone/shared';

// Socket typé avec les événements serveur→client et client→serveur
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

export default socket;
