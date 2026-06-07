import {Lobby} from "../models/Lobby";
import type { ServerPlayer } from '../types/ServerPlayer.js';
import { ServerToClientEvents, ClientToServerEvents, Locale, DEFAULT_LOCALE } from '@onskone/shared';
import { Server } from 'socket.io';
import {generateLobbyCode} from '../utils/helpers';
import logger from '../utils/logger';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

const lobbies: Map<string, Lobby> = new Map();
const INACTIVE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 heures
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Crée un lobby et renvoie son code, garanti unique.
 */
export const create = (locale: Locale = DEFAULT_LOCALE): string => {
    let lobbyCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
        lobbyCode = generateLobbyCode();
        attempts++;
        if (attempts >= maxAttempts) {
            throw new Error('Unable to generate unique lobby code');
        }
    } while (lobbies.has(lobbyCode));

    const lobby = new Lobby(lobbyCode, locale);
    lobbies.set(lobbyCode, lobby);
    return lobbyCode;
};

/**
 * Supprime les lobbies inactifs.
 * Usage interne uniquement (appelé par startCleanupInterval).
 */
const cleanupInactiveLobbies = (io?: IoServer): void => {
    const now = new Date();
    const lobbiesRemoved: string[] = [];

    for (const [code, lobby] of lobbies.entries()) {
        const inactiveTime = now.getTime() - lobby.lastActivity.getTime();

        if (inactiveTime > INACTIVE_TIMEOUT_MS) {
            lobbies.delete(code);
            lobbiesRemoved.push(code);

            if (io) {
                io.to(code).emit('lobbyClosed', { reason: 'inactive' });
                // Sortir tous les sockets de la room et couper la connexion
                // pour libérer la mémoire serveur et arrêter les reconnexions fantômes
                io.in(code).disconnectSockets(true);
            }
        }
    }

    if (lobbiesRemoved.length > 0) {
        logger.info(`Nettoyage de ${lobbiesRemoved.length} lobbies inactifs`, { lobbies: lobbiesRemoved });
    }
};

/**
 * Démarre l'intervalle de nettoyage automatique.
 * Appelable plusieurs fois sans risque : tout intervalle précédent est annulé
 * (évite une fuite mémoire au hot reload).
 */
export const startCleanupInterval = (io?: IoServer): void => {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
    }

    cleanupIntervalId = setInterval(() => {
        cleanupInactiveLobbies(io);
    }, CLEANUP_INTERVAL_MS);

    logger.info(`Service de nettoyage des lobbies démarré (toutes les ${CLEANUP_INTERVAL_MS / 1000 / 60} min, timeout ${INACTIVE_TIMEOUT_MS / 1000 / 60 / 60}h)`);
};

/**
 * Arrête l'intervalle de nettoyage.
 */
export const stopCleanupInterval = (): void => {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        logger.info('Service de nettoyage des lobbies arrêté');
    }
};

export const addPlayer = (lobby: Lobby, player: ServerPlayer): void => {
    lobby.addPlayer(player);
};

/**
 * Retire un joueur du lobby.
 * @returns true si le lobby est devenu vide et a été supprimé, false sinon.
 */
export const removePlayer = (lobby: Lobby, player: ServerPlayer): boolean => {
    lobby.removePlayer(player);

    if (lobby.players.length === 0) {
        lobbies.delete(lobby.code);
        return true;
    }

    if (player.isHost && lobby.players.length > 0) {
        // Promouvoir le premier joueur ACTIF comme hôte (pas un joueur déconnecté)
        const newHost = lobby.players.find(p => p.isActive) || lobby.players[0];
        newHost.isHost = true;
    }

    return false;
};

export const getLobby = (lobbyCode: string): Lobby | undefined => {
    // Normaliser en majuscules : les codes de lobby sont générés en majuscules
    return lobbies.get(lobbyCode.toUpperCase());
};

export const getLobbies = (): Map<string, Lobby> => {
    return lobbies;
};
