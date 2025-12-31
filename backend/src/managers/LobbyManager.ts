import {Lobby} from "../models/Lobby";
import { IPlayer } from '@onskone/shared';
import {generateLobbyCode} from '../utils/helpers';
import logger from '../utils/logger';

const lobbies: Map<string, Lobby> = new Map();
const INACTIVE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Create a lobby and return lobby code
 * Ensures unique lobby codes
 */
export const create = (): string => {
    let lobbyCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    // Generate unique lobby code
    do {
        lobbyCode = generateLobbyCode();
        attempts++;
        if (attempts >= maxAttempts) {
            throw new Error('Unable to generate unique lobby code');
        }
    } while (lobbies.has(lobbyCode));

    const lobby = new Lobby(lobbyCode);
    lobbies.set(lobbyCode, lobby);
    return lobbyCode;
};

/**
 * Clean up inactive lobbies
 * Ne supprime pas les lobbies avec une partie en cours
 */
export const cleanupInactiveLobbies = (): void => {
    const now = new Date();
    const lobbiesRemoved: string[] = [];
    const lobbiesSkipped: string[] = [];

    for (const [code, lobby] of lobbies.entries()) {
        const inactiveTime = now.getTime() - lobby.lastActivity.getTime();

        if (inactiveTime > INACTIVE_TIMEOUT_MS) {
            // Ne pas supprimer les lobbies avec une partie en cours
            if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                lobbiesSkipped.push(code);
                // Mettre à jour l'activité pour éviter de re-checker trop souvent
                lobby.updateActivity();
                continue;
            }

            // Ne pas supprimer les lobbies avec des joueurs actifs
            const hasActivePlayers = lobby.players.some(p => p.isActive);
            if (hasActivePlayers) {
                lobbiesSkipped.push(code);
                continue;
            }

            lobbies.delete(code);
            lobbiesRemoved.push(code);
        }
    }

    if (lobbiesRemoved.length > 0) {
        logger.info(`Nettoyage de ${lobbiesRemoved.length} lobbies inactifs`, { lobbies: lobbiesRemoved });
    }
    if (lobbiesSkipped.length > 0) {
        logger.debug(`${lobbiesSkipped.length} lobbies ignorés (partie en cours ou joueurs actifs)`);
    }
};

/**
 * Start automatic cleanup interval
 * Safe to call multiple times (clears previous interval)
 */
export const startCleanupInterval = (): void => {
    // Clear existing interval to prevent memory leak on hot reload
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
    }

    cleanupIntervalId = setInterval(() => {
        cleanupInactiveLobbies();
    }, CLEANUP_INTERVAL_MS);

    logger.info(`Service de nettoyage des lobbies démarré (toutes les ${CLEANUP_INTERVAL_MS / 1000 / 60} min)`);
};

/**
 * Stop the cleanup interval
 */
export const stopCleanupInterval = (): void => {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        logger.info('Service de nettoyage des lobbies arrêté');
    }
};

export const addPlayer = (lobby: Lobby, player: IPlayer): void => {
    lobby.addPlayer(player);
};

/**
 * Remove a player from the lobby
 * @param lobby
 * @param player
 * @returns boolean - true if lobby is empty and removed, false otherwise
 */
export const removePlayer = (lobby: Lobby, player: IPlayer): boolean => {
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
    // Normalize to uppercase since lobby codes are generated as uppercase
    return lobbies.get(lobbyCode.toUpperCase());
};

export const getLobbies = (): Map<string, Lobby> => {
    return lobbies;
};
