import { LobbyManager } from "../managers/LobbyManager";
import { GameManager } from "../managers/GameManager";
import { PlayerManager } from "../managers/PlayerManager";
import { Player } from "../models/Player";
import { Lobby } from "../models/Lobby";
import { Game } from "../models/Game";

export class TestHelper {
    static createLobbyWithPlayers(playerNames: string[] = []): Lobby {
        const hostPlayer = PlayerManager.createHostPlayer("Host from TestHelper");
        const lobbyCode = LobbyManager.createLobby(hostPlayer);
        const lobby = LobbyManager.getLobby(lobbyCode);
        if (!lobby) {
            throw new Error(`Lobby with code ${lobbyCode} not found`);
        }
        playerNames.forEach(playerName => {
            const player = PlayerManager.createPlayer(playerName);
            lobby.addPlayer(player);
        });
        return lobby;
    }

    static createPlayers(playerNames: string[]): Player[] {
        return playerNames.map((name) => PlayerManager.createPlayer(name));
    }
    

    static startGameWithPlayers(playerNames: string[]): Game {
        const lobby = this.createLobbyWithPlayers(playerNames);
        const game = GameManager.createGame(lobby);
        return game;
    }
}
