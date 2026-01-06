import { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents, IGame } from '@onskone/shared';
import { TimeoutManager } from './TimeoutManager.js';

export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export interface HandlerContext {
    io: TypedServer;
    socket: TypedSocket;
    timeoutManager: TimeoutManager;
}

/**
 * Check if the socket is the current round's leader
 * @returns true if socket is leader, false otherwise (also emits error to socket)
 * Note: After this returns true, game and game.currentRound are guaranteed non-null
 */
export function requireLeader(
    socket: TypedSocket,
    game: IGame | null | undefined,
    action: string
): boolean {
    if (!game?.currentRound) {
        socket.emit('error', { message: 'Partie ou round introuvable' });
        return false;
    }
    if (socket.id !== game.currentRound.leader.socketId) {
        socket.emit('error', { message: `Seul le pilier peut ${action}` });
        return false;
    }
    return true;
}
