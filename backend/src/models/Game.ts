import { randomInt } from 'crypto';
import { IGame } from '../types/IGame';
import {IRound} from '../types/IRound';
import {Round} from './Round';
import { GameCard, ILobby, GameStatus, LeaderboardEntry } from '@onskone/shared';

export class Game implements IGame {
    lobby: ILobby;
    rounds: IRound[] = [];
    currentRound: IRound | null;
    status: GameStatus;
    readonly cards: GameCard[];
    // Questions déjà choisies par un pilier pendant cette partie : elles ne sont plus
    // proposées (grisées sur leur carte, qui disparaît quand toutes les siennes sont prises).
    readonly usedQuestions: Set<string> = new Set();
    // Nombre de piliers possibles au démarrage (joueurs actifs non exclus, fixe) :
    // c'est le nombre de manches de la partie.
    private initialLeaderCount: number = 0;
    // Ids de ces piliers prévus : prioritaires sur un joueur inactif au démarrage qui
    // reviendrait en cours de partie (sinon il prendrait la manche d'un prévu, qui
    // finirait "hors classement" sans l'avoir demandé).
    private initialLeaderIds: Set<string> = new Set();

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

        // Désarmer le timeout serveur du round sortant AVANT de le remplacer : sans ça
        // son setTimeout vit jusqu'à son échéance naturelle (jusqu'à plusieurs minutes
        // sur GUESSING). Le callback est inoffensif (il revérifie l'identité du round),
        // mais il retient le round par closure et retarde le graceful shutdown. Le
        // chemin `nextPhase()` clear déjà ; celui-ci (skip pilier) ne passait pas par là.
        this.currentRound?.clearServerTimer();

        this.currentRound = new Round(roundNumber, leader, gameCard, this.lobby.guessMyAnswerMode === true);
        this.rounds.push(this.currentRound);
    }

    getRandomGameCard(): GameCard {
        if (this.cards.length === 0) {
            throw new Error("Aucune carte de jeu disponible");
        }
        // Indexation directe : pas besoin de copier tout le tableau pour un simple tirage.
        return this.cards[randomInt(0, this.cards.length)];
    }

    /**
     * Cartes encore proposables : celles qui ont au moins une question non jouée.
     * Deck épuisé (petit deck / partie longue) : on recycle, `usedQuestions` est vidé
     * et tout le pool redevient disponible plutôt que de bloquer la manche.
     */
    getSelectableCards(): GameCard[] {
        const selectable = this.cards.filter(card => card.questions.some(q => !this.usedQuestions.has(q)));
        if (selectable.length > 0) return selectable;
        this.usedQuestions.clear();
        return this.cards;
    }

    start(): void {
        // Capturer les piliers possibles au démarrage (ne changeront plus)
        const candidates = this.getLeaderCandidates();
        this.initialLeaderCount = candidates.length;
        this.initialLeaderIds = new Set(candidates.map(p => p.id));
        this.status = GameStatus.IN_PROGRESS;
    }

    end(): void {
        this.status = GameStatus.FINISHED;
    }

    getMaxRounds(): number {
        // Nombre de rounds = nombre de piliers possibles au démarrage de la partie
        // (joueurs actifs que l'hôte n'a pas exclus). Utilise la valeur capturée au
        // start() pour éviter les incohérences si des joueurs se déconnectent.
        return this.initialLeaderCount;
    }

    getActivePlayers(): typeof this.lobby.players {
        return this.lobby.players.filter(p => p.isActive);
    }

    /** Joueurs actifs que l'hôte n'a pas exclus du rôle de pilier. */
    getLeaderCandidates(): typeof this.lobby.players {
        const excluded = new Set(this.lobby.excludedLeaderIds ?? []);
        return this.getActivePlayers().filter(p => !excluded.has(p.id));
    }

    /**
     * Piliers possibles (actifs, non exclus) qui ne l'ont pas encore été cette partie.
     * Ceux prévus au démarrage passent en priorité ; un revenant ne sert qu'à combler
     * la place d'un prévu parti. Source de vérité partagée entre isGameOver() et
     * nextRound() pour éviter tout désaccord (soft-lock de fin de partie).
     */
    getEligibleLeaders(): typeof this.lobby.players {
        const previousLeaderIds = new Set(this.rounds.map(r => r.leader.id));
        const eligible = this.getLeaderCandidates().filter(p => !previousLeaderIds.has(p.id));
        const planned = eligible.filter(p => this.initialLeaderIds.has(p.id));
        return planned.length > 0 ? planned : eligible;
    }

    isGameOver(): boolean {
        // La partie est terminée quand on a fait autant de rounds que prévu initialement,
        // s'il n'y a plus assez de joueurs actifs pour continuer, ou s'il ne reste plus
        // aucun pilier éligible (tous les piliers possibles l'ont déjà été). Ce dernier cas
        // évite que nextRound() throw en boucle lorsque des joueurs se déconnectent.
        const activePlayers = this.getActivePlayers();
        return (
            this.rounds.length >= this.initialLeaderCount ||
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

        // Créer le leaderboard et trier par score décroissant.
        // Anti-fuite : le leaderboard est diffusé aux clients (gameEnded/revealResults/
        // gameState). On projette donc chaque joueur sur sa vue publique pour omettre
        // socketId ET reconnectToken (server-only). Projection INLINE volontaire :
        // importer serializePlayer (broadcasting) créerait un cycle Game ↔ broadcasting.
        const leaderboard: LeaderboardEntry[] = this.lobby.players.map(player => ({
            player: {
                id: player.id,
                name: player.name,
                isHost: player.isHost,
                score: player.score,
                isActive: player.isActive,
                avatarId: player.avatarId,
                isPremium: player.isPremium,
            },
            score: playerScores[player.id] || 0
        }));

        return leaderboard.sort((a, b) => b.score - a.score);
    }
}