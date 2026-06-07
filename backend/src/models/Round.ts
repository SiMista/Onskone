import {IRound, RoundPhase} from '../types/IRound';
import { IPlayer, GameCard, formatNoResponse } from '@onskone/shared';
import { shuffleArray } from '../utils/helpers.js';

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
    serverTimerHandle: NodeJS.Timeout | null; // Timeout serveur autoritatif d'expiration de phase

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
        this.serverTimerHandle = null;
    }

    /**
     * Annule le timeout serveur autoritatif s'il est armé.
     * Appelé avant de (ré)armer un timer ou au nettoyage de phase.
     */
    clearServerTimer(): void {
        if (this.serverTimerHandle) {
            clearTimeout(this.serverTimerHandle);
            this.serverTimerHandle = null;
        }
    }

    addAnswer(playerId: string, answer: string): void {
        this.answers[playerId] = answer;
    }

    removeAnswer(playerId: string): void {
        delete this.answers[playerId];
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
            // Réinitialiser le timer au changement de phase : sans ça, un client qui
            // reconnecte recevrait le compte à rebours périmé de la phase précédente.
            // Chaque phase doit (re)démarrer son propre timer.
            // NB: on NE remet PAS `timerPhase` à undefined. Il garde la dernière phase
            // armée, ce qui permet à processTimerExpiration d'IGNORER un `timerExpired`
            // tardif émis par le pilier pour la phase précédente après une transition
            // déclenchée par le timeout serveur — sinon la nouvelle phase serait traitée
            // en avance. requestTimerState retombe quand même sur null (timerStartedAt vidé).
            this.clearServerTimer();
            this.timerEnd = null;
            this.timerStartedAt = undefined;
            this.timerDuration = undefined;
        }
    }

    /**
     * Pool de réponses utilisé pour la phase GUESSING.
     * En mode "Devine ma réponse", inclut la réponse du substitut associée à l'id du pilier.
     */
    getGuessingAnswers(): Record<string, string> {
        const pool: Record<string, string> = { ...this.answers };
        // Tester `!= null` plutôt que la truthiness : une réponse de substitut valide ne peut
        // pas être vide (re-validée post-sanitize), mais on évite de perdre l'entrée du pilier
        // pour une chaîne falsy inattendue.
        if (this.guessMyAnswerMode && this.substituteAnswer != null) {
            pool[this.leader.id] = this.substituteAnswer;
        }
        return pool;
    }

    /**
     * Joueurs censés répondre pendant la phase ANSWERING : actifs, hors pilier.
     * Sert de référence pour le décompte `expectedAnswers` et la détection
     * "tout le monde a répondu".
     */
    getRespondingPlayers(players: IPlayer[]): IPlayer[] {
        return players.filter(p => p.isActive && p.id !== this.leader.id);
    }

    /**
     * Cibles draggables de la phase GUESSING. En mode "Devine ma réponse" le pilier
     * est lui aussi une cible (le substitut a écrit en son nom) ; sinon on l'exclut.
     * Centralise le pattern `guessMyAnswerMode ? players : players.filter(!= leader)`
     * répété dans plusieurs handlers.
     */
    getGuessTargets(players: IPlayer[]): IPlayer[] {
        return this.guessMyAnswerMode
            ? players
            : players.filter(p => p.id !== this.leader.id);
    }

    /**
     * Remplit une réponse NO_RESPONSE pour chaque joueur fourni qui n'a pas encore
     * répondu (clé absente de `answers`). Utilisé à l'expiration du timer (tous les
     * non-piliers) et à la soumission de la dernière réponse (joueurs inactifs).
     * @returns les joueurs effectivement complétés (pour le logging côté appelant).
     */
    fillMissingAnswers(players: IPlayer[], reason: string): IPlayer[] {
        const filled: IPlayer[] = [];
        for (const player of players) {
            if (this.answers[player.id] === undefined) {
                this.addAnswer(player.id, formatNoResponse(player.name, reason));
                filled.push(player);
            }
        }
        return filled;
    }

    /** Pool de réponses (incl. substitut) sous forme de tableau { id, text }. */
    private guessingAnswersArray(): { id: string; text: string }[] {
        return Object.entries(this.getGuessingAnswers()).map(([playerId, answer]) => ({
            id: playerId,
            text: answer,
        }));
    }

    /**
     * Prépare la phase GUESSING : construit le pool de réponses (incl. la réponse du
     * substitut en mode "Devine ma réponse"), le mélange et mémorise l'ordre dans
     * `shuffledAnswerIds` (pour reconstruire le même ordre à la reconnexion).
     * @returns les réponses mélangées { id, text } à diffuser aux clients.
     */
    prepareGuessing(): { id: string; text: string }[] {
        const shuffled = shuffleArray(this.guessingAnswersArray());
        this.shuffledAnswerIds = shuffled.map(a => a.id);
        return shuffled;
    }

    /**
     * Réponses de la phase GUESSING dans l'ordre stable du round : réutilise l'ordre
     * mémorisé dans `shuffledAnswerIds` si présent (reconnexion → même ordre pour tous),
     * sinon mélange une première fois et le mémorise. Source unique pour `prepareGuessing`
     * (1re entrée en GUESSING) et `requestShuffledAnswers`.
     */
    getOrderedGuessingAnswers(): { id: string; text: string }[] {
        const answersArray = this.guessingAnswersArray();
        if (this.shuffledAnswerIds && this.shuffledAnswerIds.length > 0) {
            const answersMap = new Map(answersArray.map(a => [a.id, a]));
            return this.shuffledAnswerIds
                .map(id => answersMap.get(id))
                .filter((a): a is { id: string; text: string } => a !== undefined);
        }
        return this.prepareGuessing();
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
