import {Lobby} from "../models/Lobby";
import {IPlayer} from "../types/IPlayer";
import {GameManager} from './GameManager';
import {generateLobbyCode} from '../utils/helpers';
import {GameStatus} from "../models/Game";

export namespace LobbyManager {
    const lobbies: Map<string, Lobby> = new Map();

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
        if (lobby.players.length === 1) {
            lobbies.delete(lobby.code);
            return true;
        }
        lobby.removePlayer(player);

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