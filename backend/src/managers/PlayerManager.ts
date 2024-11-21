import { Player } from '../models/Player';

export class PlayerManager {
    private players: Map<string, Player>;

    constructor() {
        this.players = new Map();
    }

    createPlayer(name: string): Player {
        const player = new Player(name);
        this.players.set(player.id, player);
        return player;
    }

    createHostPlayer(name: string): Player {
        const player = new Player(name, true); // isHost = true
        this.players.set(player.id, player);
        return player;
    }
}