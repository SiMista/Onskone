import {LobbyManager} from "../managers/LobbyManager";
import {GameManager} from "../managers/GameManager";
import {Player} from "../models/Player";
import {Lobby} from "../models/Lobby";
import {Game} from "../models/Game";

export class TestHelper {
    static createLobbyWithPlayers(playerNames: string[] = []): Lobby {
        const hostPlayer = new Player("Host from TestHelper", true);
        const lobbyCode = LobbyManager.create(hostPlayer);
        const lobby = LobbyManager.getLobby(lobbyCode);
        if (!lobby) {
            throw new Error(`Lobby with code ${lobbyCode} not found`);
        }
        playerNames.forEach(playerName => {
            const player = new Player(playerName);
            lobby.addPlayer(player);
        });
        return lobby;
    }

    static createPlayers(playerNames: string[]): Player[] {
        return playerNames.map((name) => new Player(name));
    }


    static startGameWithPlayers(playerNames: string[]): Game {
        const lobby = this.createLobbyWithPlayers(playerNames);
        return GameManager.createGame(lobby);
    }
}
