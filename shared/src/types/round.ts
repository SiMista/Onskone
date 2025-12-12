import { IPlayer } from './player.js';

/**
 * Phases d'un round
 */
export enum RoundPhase {
  /** Le chef sélectionne une question parmi 3 */
  QUESTION_SELECTION = 'QUESTION_SELECTION',

  /** Les joueurs (sauf le chef) répondent à la question */
  ANSWERING = 'ANSWERING',

  /** Le chef devine qui a écrit quelle réponse */
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

  /** Joueur chef pour ce round */
  leader: IPlayer;

  /** Carte de jeu assignée à ce round */
  gameCard: GameCard;

  /** Phase actuelle du round */
  phase: RoundPhase;

  /** Question sélectionnée par le chef parmi les 3 de la carte */
  selectedQuestion: string | null;

  /** Réponses des joueurs: { playerId: answerText } */
  answers: Record<string, string>;

  /** État intermédiaire du drag & drop: { answerId: playerId } */
  currentGuesses: Record<string, string>;

  /** Attributions finales du chef: { answerId: playerId } */
  guesses: Record<string, string>;

  /** Scores des joueurs pour ce round: { playerId: score } */
  scores: Record<string, number>;

  /** Date de fin du timer pour la phase actuelle */
  timerEnd: Date | null;

  /** Phase pour laquelle le timer a été traité (protection contre les doubles appels) */
  timerProcessedForPhase: RoundPhase | null;
}