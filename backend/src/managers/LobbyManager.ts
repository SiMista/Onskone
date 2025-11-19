import {Lobby} from "../models/Lobby";
import { IPlayer, GameStatus } from '@onskone/shared';
import {GameManager} from './GameManager';
import {generateLobbyCode} from '../utils/helpers';

export namespace LobbyManager {
    const lobbies: Map<string, Lobby> = new Map();
    const INACTIVE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    // Create a lobby using a player and add it to the lobbies map and return lobby code
    export const create = (): string => {
        // if (!player.isHost) {  // Vérifie si le joueur a le statut "host"
        //     throw new Error("Player is not authorized to create a lobby.");
        // }
        const lobbyCode = generateLobbyCode();
        const lobby = new Lobby(lobbyCode);
        // lobby.addPlayer(player);
        lobbies.set(lobbyCode, lobby);
        return lobbyCode;
    }

    /**
     * Clean up inactive lobbies
     */
    export const cleanupInactiveLobbies = (): void => {
        const now = new Date();
        const lobbiesRemoved: string[] = [];

        for (const [code, lobby] of lobbies.entries()) {
            const inactiveTime = now.getTime() - lobby.lastActivity.getTime();

            if (inactiveTime > INACTIVE_TIMEOUT_MS) {
                lobbies.delete(code);
                lobbiesRemoved.push(code);
            }
        }

        if (lobbiesRemoved.length > 0) {
            console.log(`🧹 Cleaned up ${lobbiesRemoved.length} inactive lobbies: ${lobbiesRemoved.join(', ')}`);
        }
    }

    /**
     * Start automatic cleanup interval
     */
    export const startCleanupInterval = (): void => {
        setInterval(() => {
            cleanupInactiveLobbies();
        }, CLEANUP_INTERVAL_MS);

        console.log(`✅ Lobby cleanup service started (checking every ${CLEANUP_INTERVAL_MS / 1000 / 60} minutes)`);
    }

    export const addPlayer = (lobby: Lobby, player: IPlayer): void => {
        lobby.addPlayer(player);
    }

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

        if (player.isHost) {
            lobby.players[0].isHost = true;
        }

        return false;
    }

    export const startGame = (lobby: Lobby): boolean => {
        if (lobby.game?.status === GameStatus.IN_PROGRESS) {
            console.log('Game already started for this lobby.');
            return false;
        }

        if (lobby.players.length <= 2) {
            console.log('Not enough players to start the game.');
            return false;
        }

        try {
            lobby.game = GameManager.createGame(lobby);
            lobby.game.start();
            console.log(`Game started with code: ${lobby.code}`);
            return true;
        } catch (error) {
            console.error('Error starting game:', error);
            return false;
        }
    }

    export const getLobby = (lobbyCode: string): Lobby | undefined => {
        return lobbies.get(lobbyCode);
    }

    export const getLobbies = (): Map<string, Lobby> => {
        return lobbies;
    }
}