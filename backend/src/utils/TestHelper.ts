import * as LobbyManager from "../managers/LobbyManager";
import {Player} from "../models/Player";
import {Lobby} from "../models/Lobby";
import {getDefaultSelectedDecks} from "../data/questionsRepository";

export class TestHelper {
    static createLobbyWithPlayers(playerNames: string[] = []): Lobby {
        const hostPlayer = new Player("Host from TestHelper", "test-socket-id", true);
        const lobbyCode = LobbyManager.create();
        const lobby = LobbyManager.getLobby(lobbyCode);
        if (!lobby) {
            throw new Error(`Lobby with code ${lobbyCode} not found`);
        }
        // Un salon démarre sans thème : on en coche pour que createGame ait un pool.
        lobby.selectedDecks = getDefaultSelectedDecks(lobby.locale);
        lobby.addPlayer(hostPlayer);
        playerNames.forEach(playerName => {
            const player = new Player(playerName, `socket-${playerName}`);
            lobby.addPlayer(player);
        });
        return lobby;
    }
}
