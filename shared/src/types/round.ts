import { IPlayer } from './player.js';

/**
 * Phases d'un round
 */
export enum RoundPhase {
  /** Le pilier sélectionne une question parmi 3 */
  QUESTION_SELECTION = 'QUESTION_SELECTION',

  /** Les joueurs (sauf le pilier) répondent à la question */
  ANSWERING = 'ANSWERING',

  /** Le pilier devine qui a écrit quelle réponse */
  GUESSING = 'GUESSING',

  /** Révélation des résultats */
  REVEAL = 'REVEAL'
}

/**
 * Carte de jeu contenant une catégorie et des questions
 */
export interface GameCard {
  /** Catégorie de la carte (ex: "Nourriture", "Voyage") */
  category: string;

  /** Liste de questions pour cette catégorie */
  questions: string[];
}

/**
 * Round de jeu
 */
export interface IRound {
  /** Numéro du round (1-indexed) */
  roundNumber: number;

  /** Joueur pilier pour ce round */
  leader: IPlayer;

  /** Carte de jeu assignée à ce round */
  gameCard: GameCard;

  /** Phase actuelle du round */
  phase: RoundPhase;

  /** Question sélectionnée par le pilier parmi les 3 de la carte */
  selectedQuestion: string | null;

  /** Réponses des joueurs: { playerId: answerText } */
  answers: Record<string, string>;

  /** État intermédiaire du drag & drop: { answerId: playerId } */
  currentGuesses: Record<string, string>;

  /** Attributions finales du pilier: { answerId: playerId } */
  guesses: Record<string, string>;

  /** Scores des joueurs pour ce round: { playerId: score } */
  scores: Record<string, number>;

  /** Date de fin du timer pour la phase actuelle */
  timerEnd: Date | null;

  /** Phase pour laquelle le timer a été traité (protection contre les doubles appels) */
  timerProcessedForPhase?: RoundPhase | null;

  /** Indices des réponses révélées dans la phase REVEAL */
  revealedIndices?: number[];

  /** Timestamp de démarrage du timer (pour synchronisation) */
  timerStartedAt?: number;

  /** Durée du timer en secondes */
  timerDuration?: number;

  /** Phase pour laquelle le timer a été démarré (évite les conflits entre phases) */
  timerPhase?: RoundPhase;

  /** Nombre de relances utilisées par le pilier en phase QUESTION_SELECTION */
  relancesUsed?: number;

  /** Cartes déjà montrées au pilier (pour éviter les doublons lors des relances) */
  shownGameCards?: GameCard[];

  /** Ordre des réponses mélangées pour la phase GUESSING (stocké pour la reconnexion) */
  shuffledAnswerIds?: string[];
}