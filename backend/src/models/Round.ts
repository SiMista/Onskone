import {IRound, RoundPhase} from '../types/IRound';
import { IPlayer, GameCard } from '@onskone/shared';

export class Round implements IRound {
    roundNumber: number;
    leader: IPlayer;
    gameCard: GameCard;
    phase: RoundPhase;
    selectedQuestion: string | null;
    answers: Record<string, string>; // Réponses des joueurs (clé = ID du joueur, valeur = réponse)
    currentGuesses: Record<string, string>; // État intermédiaire du drag & drop
    guesses: Record<string, string>; // Attributions finales du chef
    scores: Record<string, number>;
    timerEnd: Date | null;
    timerStartedAt: number | undefined; // Timestamp de démarrage du timer
    timerDuration: number | undefined; // Durée du timer en secondes
    timerProcessedForPhase: RoundPhase | null | undefined; // Empêche le double traitement du timer
    timerPhase: RoundPhase | undefined; // Phase pour laquelle le timer a été démarré
    relancesUsed: number; // Nombre de relances utilisées par le chef
    revealedIndices: number[]; // Indices des réponses révélées en phase REVEAL
    shownGameCards: GameCard[]; // Cartes déjà montrées au chef (pour éviter les doublons)

    constructor(roundNumber: number, leader: IPlayer, gameCard: GameCard) {
        this.roundNumber = roundNumber;
        this.leader = leader;
        this.gameCard = gameCard;
        this.phase = RoundPhase.QUESTION_SELECTION;
        this.selectedQuestion = null;
        this.answers = {};
        this.currentGuesses = {};
        this.guesses = {};
        this.scores = {};
        this.timerEnd = null;
        this.timerStartedAt = undefined;
        this.timerDuration = undefined;
        this.timerProcessedForPhase = null;
        this.timerPhase = undefined;
        this.relancesUsed = 0;
        this.revealedIndices = [];
        this.shownGameCards = [];
    }

    addAnswer(playerId: string, answer: string): void {
        this.answers[playerId] = answer;
    }

    setSelectedQuestion(question: string): void {
        this.selectedQuestion = question;
    }

    updateCurrentGuess(answerId: string, playerId: string | null): void {
        if (playerId === null) {
            delete this.currentGuesses[answerId];
        } else {
            this.currentGuesses[answerId] = playerId;
        }
    }

    submitGuesses(guesses: Record<string, string>): void {
        this.guesses = guesses;
    }

    nextPhase(): void {
        const phases = [
            RoundPhase.QUESTION_SELECTION,
            RoundPhase.ANSWERING,
            RoundPhase.GUESSING,
            RoundPhase.REVEAL
        ];
        const currentIndex = phases.indexOf(this.phase);
        if (currentIndex < phases.length - 1) {
            this.phase = phases[currentIndex + 1];
        }
    }

    calculateScores(): void {
        // Le chef gagne +1 point pour chaque bonne attribution
        let chiefScore = 0;

        // Initialiser les scores de tous les joueurs à 0
        for (const playerId of Object.keys(this.answers)) {
            this.scores[playerId] = 0;
        }

        // Pour chaque réponse, vérifier si le chef a correctement deviné le joueur
        for (const playerId of Object.keys(this.answers)) {
            // Trouver l'ID de cette réponse dans guesses
            const guessedPlayerId = this.guesses[playerId];

            if (guessedPlayerId === playerId) {
                // Le chef a deviné correctement
                chiefScore++;
            } else if (guessedPlayerId && guessedPlayerId !== playerId) {
                // Le chef s'est trompé - le vrai auteur gagne 1 point (réponse trompeuse)
                this.scores[playerId] = (this.scores[playerId] || 0) + 1;
            }
            // Si guessedPlayerId est undefined/null, personne ne gagne de point pour cette réponse
        }

        // Attribuer le score au chef
        this.scores[this.leader.id] = chiefScore;
    }
}
