import { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@onskone/shared';
import logger from '../utils/logger.js';
import { ConnectionRegistry } from './ConnectionRegistry.js';
import { createHandlerContext } from './handlers/context.js';
import { registerLobbyHandlers } from './handlers/lobbyHandlers.js';
import { registerRoundHandlers } from './handlers/roundHandlers.js';
import { registerTimerHandlers } from './handlers/timerHandlers.js';
import { registerDisconnectHandler } from './handlers/disconnectHandler.js';

/**
 * Coquille mince qui câble les modules socket cohérents :
 *  - ConnectionRegistry  : détenteur UNIQUE des maps de timers / locks / kickés.
 *  - broadcasting.ts     : sérialisation + diffusion + expiration de phase (fonctions pures).
 *  - handlers/*          : un module register(socket, ctx) par famille d'events.
 *
 * Cette classe se contente d'instancier le registre + le contexte partagé et de câbler
 * chaque module de handlers à la connexion. AUCUNE logique métier ne vit ici.
 */
export class SocketHandler {
    private readonly io: Server<ClientToServerEvents, ServerToClientEvents>;
    private readonly registry: ConnectionRegistry;

    constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
        this.io = io;
        this.registry = new ConnectionRegistry();
        this.setupSocketEvents();
    }

    private setupSocketEvents(): void {
        const ctx = createHandlerContext(this.io, this.registry);

        this.io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
            logger.socket.connect(socket.id);
            registerLobbyHandlers(socket, ctx);
            registerRoundHandlers(socket, ctx);
            registerTimerHandlers(socket, ctx);
            registerDisconnectHandler(socket, ctx);
        });
    }
}
