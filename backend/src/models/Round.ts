import { randomUUID } from 'crypto';
import { IRound } from '../types/IRound';
import { IPlayer, GameCard, RoundPhase, formatNoResponse, NO_RESPONSE_PREFIX } from '@onskone/shared';
import { shuffleArray } from '../utils/helpers.js';

/** Une entrée du pool de devinette telle que diffusée aux clients (auteur anonymisé). */
export interface PublicGuessAnswer {
    /** Slot opaque (NON corrélé à l'auteur). Sert d'identifiant côté client. */
    id: string;
    text: string;
    /**
     * Auteur — fourni UNIQUEMENT pour les réponses NO_RESPONSE (dont le texte révèle
     * déjà le joueur, ex « X n'a pas répondu »), pour permettre l'auto-attribution.
     * `undefined` pour les vraies réponses : l'auteur reste secret jusqu'au REVEAL.
     */
    ownerId?: string;
}

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
    // Pool GUESSING anonymisé : chaque réponse a un slot opaque + son auteur réel.
    // Ordre = ordre mélangé diffusé aux clients. Source de vérité du mapping slot↔auteur.
    answerSlots: { slotId: string; authorId: string; text: string }[];
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
        this.answerSlots = [];
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

    /** Construit le pool { slotId, authorId, text } : un slot OPAQUE par réponse. */
    private buildAnswerSlots(): { slotId: string; authorId: string; text: string }[] {
        return Object.entries(this.getGuessingAnswers()).map(([authorId, text]) => ({
            slotId: randomUUID(),
            authorId,
            text,
        }));
    }

    /** Projette answerSlots vers la vue publique (auteur masqué, sauf NO_RESPONSE). */
    private toPublicPool(): PublicGuessAnswer[] {
        return this.answerSlots.map(s => ({
            id: s.slotId,
            text: s.text,
            // NO_RESPONSE : le texte révèle déjà l'auteur -> on le fournit pour l'auto-attribution.
            ownerId: s.text.startsWith(NO_RESPONSE_PREFIX) ? s.authorId : undefined,
        }));
    }

    /**
     * Prépare la phase GUESSING : construit le pool (incl. réponse du substitut en mode
     * "Devine ma réponse"), assigne un SLOT OPAQUE à chaque réponse (anti-fuite de
     * l'auteur), mélange l'ordre et mémorise le tout dans `answerSlots`.
     * @returns la vue publique { id: slot, text, ownerId? } à diffuser aux clients.
     */
    prepareGuessing(): PublicGuessAnswer[] {
        this.answerSlots = shuffleArray(this.buildAnswerSlots());
        return this.toPublicPool();
    }

    /**
     * Vue publique du pool dans l'ordre stable du round : réutilise `answerSlots` s'il est
     * déjà construit (reconnexion → mêmes slots/même ordre pour tous), sinon prépare une
     * 1re fois. Source unique pour `prepareGuessing` (entrée GUESSING) et requestShuffledAnswers.
     */
    getOrderedGuessingAnswers(): PublicGuessAnswer[] {
        if (this.answerSlots.length > 0) return this.toPublicPool();
        return this.prepareGuessing();
    }

    /** Auteur réel associé à un slot opaque (undefined si slot inconnu). */
    authorForSlot(slotId: string): string | undefined {
        return this.answerSlots.find(s => s.slotId === slotId)?.authorId;
    }

    /** Slot opaque associé à un auteur (pour traduire l'état serveur -> client). */
    slotForAuthor(authorId: string): string | undefined {
        return this.answerSlots.find(s => s.authorId === authorId)?.slotId;
    }

    /** Ensemble des slots valides (pour valider les answerId reçus des clients). */
    getSlotIds(): Set<string> {
        return new Set(this.answerSlots.map(s => s.slotId));
    }

    /** Traduit l'état interne currentGuesses (par auteur) vers la vue client (par slot). */
    currentGuessesBySlot(): Record<string, string> {
        const bySlot: Record<string, string> = {};
        for (const [authorId, guessedPlayerId] of Object.entries(this.currentGuesses)) {
            const slotId = this.slotForAuthor(authorId);
            if (slotId) bySlot[slotId] = guessedPlayerId;
        }
        return bySlot;
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
