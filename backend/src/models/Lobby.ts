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

    setHost(playerName: string): void {
        this.players.forEach(p => {
            if (p.name === playerName) {
                p.isHost = true;
            } else {
                p.isHost = false;
            }
        });
    }

    removePlayer(player: IPlayer): void {
        this.players = this.players.filter(p => p.id !== player.id);
    }

    getPlayer(playerId: string): IPlayer | undefined {
        return this.players.find(p => p.id === playerId);
    }
}