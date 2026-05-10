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
    guesses: Record<string, string>; // Attributions finales du pilier
    scores: Record<string, number>;
    timerEnd: Date | null;
    timerStartedAt: number | undefined; // Timestamp de démarrage du timer
    timerDuration: number | undefined; // Durée du timer en secondes
    timerProcessedForPhase: RoundPhase | null | undefined; // Empêche le double traitement du timer
    timerPhase: RoundPhase | undefined; // Phase pour laquelle le timer a été démarré
    relancesUsed: number; // Nombre de relances utilisées par le pilier
    revealedIndices: number[]; // Indices des réponses révélées en phase REVEAL
    similarityCorrections: number[]; // Indices corrigés par similarité
    proposedCards: GameCard[]; // Les 3 cartes proposées au pilier pour la sélection
    shownGameCards: GameCard[]; // Cartes déjà montrées au pilier (pour éviter les doublons)
    shuffledAnswerIds: string[]; // Ordre des réponses mélangées pour la reconnexion
    guessMyAnswerMode: boolean; // Mode "Devine ma réponse" actif pour ce round
    substitutePlayerId: string | null; // Joueur substitut désigné par le pilier
    substituteAnswer: string | null; // Réponse écrite par le substitut au nom du pilier

    constructor(roundNumber: number, leader: IPlayer, gameCard: GameCard, guessMyAnswerMode: boolean = false) {
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
        this.similarityCorrections = [];
        this.proposedCards = [];
        this.shownGameCards = [];
        this.shuffledAnswerIds = [];
        this.guessMyAnswerMode = guessMyAnswerMode;
        this.substitutePlayerId = null;
        this.substituteAnswer = null;
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
        const phases = this.guessMyAnswerMode
            ? [
                RoundPhase.QUESTION_SELECTION,
                RoundPhase.SUBSTITUTE_SELECTION,
                RoundPhase.ANSWERING,
                RoundPhase.SUBSTITUTE_ANSWERING,
                RoundPhase.GUESSING,
                RoundPhase.REVEAL
            ]
            : [
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

    /**
     * Pool de réponses utilisé pour la phase GUESSING.
     * En mode "Devine ma réponse", inclut la réponse du substitut associée à l'id du pilier.
     */
    getGuessingAnswers(): Record<string, string> {
        const pool: Record<string, string> = { ...this.answers };
        if (this.guessMyAnswerMode && this.substituteAnswer) {
            pool[this.leader.id] = this.substituteAnswer;
        }
        return pool;
    }

    setSubstitutePlayer(playerId: string): void {
        this.substitutePlayerId = playerId;
    }

    setSubstituteAnswer(answer: string): void {
        this.substituteAnswer = answer;
    }

    calculateScores(): void {
        // Seul le pilier gagne des points : +1 par bonne attribution
        let chiefScore = 0;

        // En mode "Devine ma réponse", le pool inclut la réponse du substitut au nom du pilier
        const answers = this.getGuessingAnswers();

        // Pour chaque réponse, vérifier si le pilier a correctement deviné le joueur
        for (const playerId of Object.keys(answers)) {
            const guessedPlayerId = this.guesses[playerId];

            if (guessedPlayerId === playerId) {
                // Le pilier a deviné correctement
                chiefScore++;
            }
        }

        // Attribuer le score au pilier (les autres joueurs ne gagnent pas de points)
        this.scores[this.leader.id] = chiefScore;
    }

    addBonusScore(playerId: string, points: number): void {
        this.scores[playerId] = (this.scores[playerId] || 0) + points;
    }
}
