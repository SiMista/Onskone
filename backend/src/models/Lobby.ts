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
            if (p.name === player.name) {
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