import { LobbyManager } from "../managers/LobbyManager";
import { GameManager } from "../managers/GameManager";
import { PlayerManager } from "../managers/PlayerManager";
import { Player } from "../models/Player";
import { Lobby } from "../models/Lobby";
import { Game } from "../models/Game";

export class TestHelper {
    static createAllManagers(): { gameManager: GameManager, lobbyManager: LobbyManager, playerManager: PlayerManager } {
        const gameManager = new GameManager('./src/data/questions.json');
        const lobbyManager = new LobbyManager(gameManager);
        const playerManager = new PlayerManager();
        return { gameManager, lobbyManager, playerManager };
    }

    static createHostPlayer(playerManager: PlayerManager, name = "Host Player"): Player {
        return playerManager.createHostPlayer(name);
    }

    static createLobbyWithPlayers(
        lobbyManager: LobbyManager,
        playerManager: PlayerManager,
        hostPlayer: Player,
        playerNames: string[] = ["Player 2", "Player 3"]
    ): Lobby {
        const lobbyCode = lobbyManager.createLobby(hostPlayer);
        playerNames.forEach(name => {
            const player = playerManager.createPlayer(name);
            lobbyManager.addPlayerToLobby(lobbyCode, player);
        });
        const lobby = lobbyManager.getLobby(lobbyCode);
        if (!lobby) {
            throw new Error(`Lobby with code ${lobbyCode} not found`);
        }
        return lobby;
    }

    static startGame(lobbyManager: LobbyManager, gameManager: GameManager, lobby: Lobby): Game {
        lobbyManager.startGame(lobby.lobbyCode);
        const game = gameManager.getGame(lobby.lobbyCode);
        if (!game) {
            throw new Error(`Game for lobby code ${lobby.lobbyCode} not found`);
        }
        return game;
    }
}
