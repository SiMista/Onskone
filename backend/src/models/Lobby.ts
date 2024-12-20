import {ILobby} from '../types/ILobby';
import {IPlayer} from '../types/IPlayer';
import {IGame} from '../types/IGame';

export class Lobby implements ILobby {
    code: string;
    players: IPlayer[];
    game: IGame | null;

    constructor(lobbyCode: string) {
        this.code = lobbyCode;
        this.players = [];
        this.game = null;
    }

    addPlayer(player: IPlayer): void {
        this.players.push(player);
    }

    removePlayer(player: IPlayer): void {
        this.players = this.players.filter(p => p.id !== player.id);
    }

    getPlayer(playerId: string): IPlayer | undefined {
        return this.players.find(p => p.id === playerId);
    }
}