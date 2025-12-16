import * as LobbyManager from "../managers/LobbyManager";
import * as GameManager from "../managers/GameManager";
import {Player} from "../models/Player";
import {Lobby} from "../models/Lobby";
import {Game} from "../models/Game";

export class TestHelper {
    static createLobbyWithPlayers(playerNames: string[] = []): Lobby {
        const hostPlayer = new Player("Host from TestHelper", "test-socket-id", true);
        const lobbyCode = LobbyManager.create();
        const lobby = LobbyManager.getLobby(lobbyCode);
        if (!lobby) {
            throw new Error(`Lobby with code ${lobbyCode} not found`);
        }
        lobby.addPlayer(hostPlayer);
        playerNames.forEach(playerName => {
            const player = new Player(playerName, `socket-${playerName}`);
            lobby.addPlayer(player);
        });
        return lobby;
    }

    static createPlayers(playerNames: string[]): Player[] {
        return playerNames.map((name) => new Player(name, `socket-${name}`));
    }


    static startGameWithPlayers(playerNames: string[]): Game {
        const lobby = this.createLobbyWithPlayers(playerNames);
        return GameManager.createGame(lobby);
    }
}
