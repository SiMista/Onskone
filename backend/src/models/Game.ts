import { randomInt } from 'crypto';
import {IGame, LeaderboardEntry} from '../types/IGame';
import {IRound} from '../types/IRound';
import {Round} from './Round';
import { GameCard, ILobby, GameStatus } from '@onskone/shared';

export class Game implements IGame {
    lobby: ILobby;
    rounds: IRound[] = [];
    currentRound: IRound | null;
    status: GameStatus;
    readonly cards: GameCard[];
    // Nombre de joueurs actifs au démarrage de la partie (fixe)
    private initialActivePlayerCount: number = 0;

    constructor(lobby: ILobby, questionsPool: GameCard[]) {
        this.lobby = lobby;
        this.currentRound = null;
        this.status = GameStatus.WAITING;
        this.cards = questionsPool;
    }

    nextRound(): void {
        if (this.status !== GameStatus.IN_PROGRESS) {
            throw new Error("La partie n'a pas démarré ou est déjà terminée. Statut: " + this.status);
        }

        // Vérifier qu'il y a des joueurs actifs
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length === 0) {
            throw new Error("Impossible de créer un round sans joueurs actifs");
        }

        // Vérifier qu'on n'a pas dépassé le nombre max de rounds
        if (this.isGameOver()) {
            throw new Error("Le nombre maximum de rounds a été atteint");
        }

        const roundNumber = this.currentRound ? this.currentRound.roundNumber + 1 : 1;

        // Trouver les joueurs actifs qui n'ont pas encore été piliers.
        // Ce cas est désormais détecté en amont par isGameOver() : nextRound() ne doit
        // pas être appelé quand il n'y a plus de pilier éligible (soft-lock).
        const eligibleLeaders = this.getEligibleLeaders();
        if (eligibleLeaders.length === 0) {
            throw new Error("Tous les joueurs actifs ont déjà été piliers");
        }

        // Choisir un pilier au HASARD parmi les éligibles (pas déterminé par l'ordre du lobby)
        const randomIndex = randomInt(0, eligibleLeaders.length);
        const leader = eligibleLeaders[randomIndex];

        const gameCard = this.getRandomGameCard();

        this.currentRound = new Round(roundNumber, leader, gameCard, this.lobby.guessMyAnswerMode === true);
        this.rounds.push(this.currentRound);
    }

    getRandomGameCard(): GameCard {
        if (this.cards.length === 0) {
            throw new Error("Aucune carte de jeu disponible");
        }
        const items = Array.from(this.cards);
        const randomIndex = randomInt(0, items.length);
        return items[randomIndex];
    }

    start(): void {
        // Capturer le nombre de joueurs actifs au démarrage (ne changera plus)
        this.initialActivePlayerCount = this.getActivePlayers().length;
        this.status = GameStatus.IN_PROGRESS;
    }

    end(): void {
        this.status = GameStatus.FINISHED;
    }

    getMaxRounds(): number {
        // Nombre de rounds = nombre de joueurs actifs au démarrage de la partie
        // Utilise la valeur capturée au start() pour éviter les incohérences
        // si des joueurs se déconnectent pendant la partie
        return this.initialActivePlayerCount;
    }

    getActivePlayers(): typeof this.lobby.players {
        return this.lobby.players.filter(p => p.isActive);
    }

    /**
     * Joueurs actifs qui n'ont pas encore été piliers cette partie.
     * Source de vérité partagée entre isGameOver() et nextRound() pour éviter
     * tout désaccord (soft-lock de fin de partie).
     */
    getEligibleLeaders(): typeof this.lobby.players {
        const previousLeaderIds = new Set(this.rounds.map(r => r.leader.id));
        return this.getActivePlayers().filter(p => !previousLeaderIds.has(p.id));
    }

    isGameOver(): boolean {
        // La partie est terminée quand on a fait autant de rounds que prévu initialement,
        // s'il n'y a plus assez de joueurs actifs pour continuer, ou s'il ne reste plus
        // aucun pilier éligible (tous les actifs ont déjà été piliers). Ce dernier cas
        // évite que nextRound() throw en boucle lorsque des joueurs se déconnectent.
        const activePlayers = this.getActivePlayers();
        return (
            this.rounds.length >= this.initialActivePlayerCount ||
            activePlayers.length < 2 ||
            this.getEligibleLeaders().length === 0
        );
    }

    getLeaderboard(): LeaderboardEntry[] {
        // Calculer le score total de chaque joueur à travers tous les rounds
        const playerScores: Record<string, number> = {};

        // Initialiser tous les joueurs avec un score de 0
        for (const player of this.lobby.players) {
            playerScores[player.id] = 0;
        }

        // Additionner les scores de chaque round
        for (const round of this.rounds) {
            for (const [playerId, score] of Object.entries(round.scores)) {
                if (playerScores[playerId] !== undefined) {
                    playerScores[playerId] += score;
                }
            }
        }

        // Créer le leaderboard et trier par score décroissant
        const leaderboard: LeaderboardEntry[] = this.lobby.players.map(player => ({
            player,
            score: playerScores[player.id] || 0
        }));

        return leaderboard.sort((a, b) => b.score - a.score);
    }
}