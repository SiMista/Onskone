import { RoundPhase, WHITEBOARD, isWhiteboardLocalId } from '@onskone/shared';
import { Round } from '../../models/Round';
import type { Lobby } from '../../models/Lobby';
import type { Game } from '../../models/Game';
import type { Player } from '../../models/Player';
import { sanitizeWhiteboardPoints } from '../../models/Whiteboard.js';
import { rateLimiters } from '../../utils/rateLimiter.js';
import { type HandlerContext, type AppSocket, withGuards } from './context.js';

/**
 * Tableau blanc partagé (cf. shared/src/whiteboard.ts) : pendant QUESTION_SELECTION,
 * les non-piliers dessinent ensemble. Tout est SILENCIEUX : un envoi refusé (mauvaise
 * phase, limite atteinte, rate limit) est ignoré sans toast — c'est un passe-temps,
 * pas une action de jeu.
 */

const ignore = () => { /* silencieux */ };

interface Drawer {
    round: Round;
    player: Player;
    color: number;
}

/**
 * Le socket peut-il dessiner : rattaché au slot du joueur (anti-usurpation, comme
 * syncCheck), non-pilier, manche en QUESTION_SELECTION (et la bonne manche si le
 * client la précise : un paquet en retard ne déborde jamais sur la suivante).
 */
function resolveDrawer(
    socket: AppSocket,
    lobby: Lobby | undefined,
    game: Game | null,
    playerId: string,
    roundNumber?: number,
): Drawer | null {
    if (!lobby || !game) return null;
    const round = game.currentRound;
    if (!(round instanceof Round) || round.phase !== RoundPhase.QUESTION_SELECTION) return null;
    if (roundNumber !== undefined && round.roundNumber !== roundNumber) return null;
    const player = lobby.getPlayer(playerId);
    if (!player || player.socketId !== socket.id || !socket.rooms.has(lobby.code)) return null;
    if (player.id === round.leader.id) return null;
    return { round, player, color: game.getWhiteboardColor(player.id) };
}

export function registerWhiteboardHandlers(socket: AppSocket, _ctx: HandlerContext): void {
    socket.on('getWhiteboard', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.getWhiteboard,
            requireLobbyCode: true,
            requirePlayerId: 'playerId',
            onReject: ignore,
        }, ({ lobby, game }, data) => {
            const drawer = resolveDrawer(socket, lobby, game, data.playerId);
            if (!drawer) return;
            socket.emit('whiteboardState', {
                roundNumber: drawer.round.roundNumber,
                myColor: drawer.color,
                strokes: drawer.round.whiteboard.snapshot(),
            });
        });
    });

    socket.on('whiteboardDraw', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.whiteboardDraw,
            requireLobbyCode: true,
            requirePlayerId: 'playerId',
            onReject: ignore,
        }, ({ lobby, game }, data) => {
            if (!isWhiteboardLocalId(data.strokeId) || typeof data.roundNumber !== 'number') return;
            const points = sanitizeWhiteboardPoints(data.points);
            if (!points) return;
            const drawer = resolveDrawer(socket, lobby, game, data.playerId, data.roundNumber);
            if (!drawer) return;
            const stroke = drawer.round.whiteboard.draw(drawer.player.id, drawer.color, data.strokeId, points);
            if (!stroke) return;
            // Pas d'écho : l'auteur a déjà son trait à l'écran.
            socket.to(lobby.code).emit('whiteboardStroke', { roundNumber: drawer.round.roundNumber, stroke });
        });
    });

    socket.on('whiteboardUndo', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.whiteboardUndo,
            requireLobbyCode: true,
            requirePlayerId: 'playerId',
            onReject: ignore,
        }, ({ lobby, game }, data) => {
            const localIds: unknown = data.strokeIds;
            if (!Array.isArray(localIds) || localIds.length === 0 || localIds.length > WHITEBOARD.MAX_STROKES_PER_UNDO) return;
            if (!localIds.every(isWhiteboardLocalId) || typeof data.roundNumber !== 'number') return;
            const drawer = resolveDrawer(socket, lobby, game, data.playerId, data.roundNumber);
            if (!drawer) return;
            const strokeIds = localIds
                .map(localId => drawer.round.whiteboard.undo(drawer.player.id, drawer.color, localId))
                .filter((id): id is string => id !== null);
            if (strokeIds.length === 0) return;
            socket.to(lobby.code).emit('whiteboardStrokeRemoved', { roundNumber: drawer.round.roundNumber, strokeIds });
        });
    });
}
