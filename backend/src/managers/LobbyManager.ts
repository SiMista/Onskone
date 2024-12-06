import { Lobby } from "../models/Lobby";
import { IPlayer } from "../types/IPlayer";
import { GameManager } from './GameManager';
import { generateLobbyCode } from '../utils/helpers';

export namespace LobbyManager {
    const lobbies: Map<string, Lobby> = new Map();

    // Create a lobby using a player and add it to the lobbies map and return lobby code
    export const createLobby = (player: IPlayer): string => {
        if (!player.isHost) {  // Vérifie si le joueur a le statut "host"
            throw new Error("Player is not authorized to create a lobby.");
        }
        const lobbyCode = generateLobbyCode();
        const lobby = new Lobby(lobbyCode);
        lobby.addPlayer(player);
        lobbies.set(lobbyCode, lobby);
        return lobbyCode;
    }


    export const addPlayerToLobby = (lobbyCode: string, player: IPlayer): void => {
        const lobby = lobbies.get(lobbyCode);
        if (!lobby) {
            throw new Error("Lobby does not exist.");
        }
        lobby.addPlayer(player);
    }

    export const removePlayerFromLobby = (lobbyCode: string, player: IPlayer): void => {
        const lobby = lobbies.get(lobbyCode);
        if (lobby) {
            if (lobby.players.length === 1) { // Remove lobby if last player leaves
                lobbies.delete(lobbyCode);
                return;
            }
            if (player.isHost) { // Change host if host leaves
                lobby.removePlayer(player);
                lobby.players[0].isHost = true;
            }
        }
        else {
            console.log('Lobby does not exist');
        }
    }

    export const startGame = (lobbyCode: string): boolean => {
        const lobby = lobbies.get(lobbyCode);
        if (!lobby) {
            console.log('Lobby does not exist');
            return false;
        }
        if (lobby.gameStarted) {
            console.log('Game already started for this lobby.');
            return false;
        }
        if (lobby.players.length <= 2) {
            console.log('Not enough players to start the game.');
            return false;
        }
        try {
            lobby.startGame();
            const game = GameManager.createGame(lobby);
            lobby.game = game;
            console.log(`Game started with code: ${lobbyCode}`);
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