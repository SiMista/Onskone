import { ILobby, IPlayer, GAME_CONSTANTS, SelectedDecks, GameMode, Locale, DEFAULT_LOCALE } from '@onskone/shared';
import { IGame } from '../types/IGame';
import { getDefaultSelectedDecks } from '../managers/GameManager';

export class Lobby implements ILobby {
    code: string;
    players: IPlayer[];
    game: IGame | null;
    lastActivity: Date;
    selectedDecks: SelectedDecks;
    gameMode: GameMode;
    guessMyAnswerMode: boolean;
    timeMultiplier: number;
    locale: Locale;

    constructor(lobbyCode: string, locale: Locale = DEFAULT_LOCALE) {
        this.code = lobbyCode;
        this.players = [];
        this.game = null;
        this.lastActivity = new Date();
        this.locale = locale;
        this.selectedDecks = getDefaultSelectedDecks(locale);
        this.gameMode = 'local';
        this.guessMyAnswerMode = false;
        this.timeMultiplier = GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT;
    }

    updateActivity(): void {
        this.lastActivity = new Date();
    }

    addPlayer(player: IPlayer): void {
        if (this.players.length >= GAME_CONSTANTS.MAX_PLAYERS) {
            throw new Error(`Le salon est plein (maximum ${GAME_CONSTANTS.MAX_PLAYERS} joueurs)`);
        }
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