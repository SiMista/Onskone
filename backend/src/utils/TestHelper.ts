import * as LobbyManager from "../managers/LobbyManager";
import {Player} from "../models/Player";
import {Lobby} from "../models/Lobby";

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
}
