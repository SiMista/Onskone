import { ILobby, IPlayer } from '@onskone/shared';
import { IGame } from '../types/IGame';

export class Lobby implements ILobby {
    code: string;
    players: IPlayer[];
    game: IGame | null;
    lastActivity: Date;

    constructor(lobbyCode: string) {
        this.code = lobbyCode;
        this.players = [];
        this.game = null;
        this.lastActivity = new Date();
    }

    updateActivity(): void {
        this.lastActivity = new Date();
    }

    addPlayer(player: IPlayer): void {
        this.players.push(player);
    }

    setHost(player: IPlayer): void {
        this.players.forEach(p => {
            // Compare by id, not name (two players could theoretically have same name)
            p.isHost = p.id === player.id;
        });
    }

    removePlayer(player: IPlayer): void {
        this.players = this.players.filter(p => p.id !== player.id);
    }

    getPlayer(playerId: string): IPlayer | undefined {
        return this.players.find(p => p.id === playerId);
    }
}