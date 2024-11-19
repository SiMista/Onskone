import { Player } from '../models/Player';

export class PlayerManager {
    private players: Map<string, Player>;

    constructor() {
        this.players = new Map();
    }

    createPlayer(id: string, name: string): void {
        const player = new Player(id, name);
        this.players.set(id, player);
    }

    createHostPlayer(id: string, name: string): void {
        const player = new Player(id, name, true); // isHost = true
        this.players.set(id, player);
    }
}