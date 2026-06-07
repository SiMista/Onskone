import { IPlayer } from './player.js';

/**
 * Phases d'un round
 */
export enum RoundPhase {
  /** Le pilier sélectionne une question parmi 3 */
  QUESTION_SELECTION = 'QUESTION_SELECTION',

  /** Le pilier choisit le joueur qui répondra à sa place (mode "Devine ma réponse") */
  SUBSTITUTE_SELECTION = 'SUBSTITUTE_SELECTION',

  /** Les joueurs (sauf le pilier) répondent à la question */
  ANSWERING = 'ANSWERING',

  /** Le substitut écrit la réponse qu'il imagine pour le pilier (mode "Devine ma réponse") */
  SUBSTITUTE_ANSWERING = 'SUBSTITUTE_ANSWERING',

  /** Le pilier devine qui a écrit quelle réponse */
  GUESSING = 'GUESSING',

  /** Révélation des résultats */
  REVEAL = 'REVEAL'
}

/**
 * Carte de jeu contenant une catégorie et des questions
 */
export interface GameCard {
  /** Catégorie de la carte (ex: "ICEBREAKERS", "FUN", "DEEP") */
  category: string;

  /** Thème de la carte (ex: "QUOTIDIEN", "ENTRE NOUS") */
  theme: string;

  /** Sujet de la carte (ex: "Matin", "Meilleurs") */
  subject: string;

  /** Liste de questions pour ce sujet */
  questions: string[];
}

/**
 * Round de jeu — **contrat PUBLIC** (vue émise aux clients).
 *
 * IMPORTANT : ce type ne contient QUE les champs réellement lus par le frontend.
 * Tout le bookkeeping serveur (timers, ordre de mélange, attributions intermédiaires,
 * cartes proposées, corrections de similarité…) vit côté backend dans
 * `backend/src/types/IRound.ts` + la classe `backend/src/models/Round.ts`, et NE doit
 * PAS transiter par le réseau (anti-fuite).
 *
 * Le backend PROJETTE explicitement vers ce type dans `serializeGame`/`roundStarted`
 * (il ne renvoie jamais l'instance `Round` brute), de sorte que les champs serveur-only
 * ne fuitent ni au type, ni au runtime.
 *
 * Le nom `IRound` est volontairement conservé : c'est le type importé tel quel par le
 * frontend (transparence du contrat).
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

  /**
   * Réponses des joueurs: { playerId: answerText }.
   * Lu par le frontend uniquement sur les rounds terminés (`gameEnded.rounds`,
   * stats de fin de partie). Sur le round en cours, le pool n'arrive jamais ici :
   * il est diffusé mélangé via `shuffledAnswersReceived`.
   */
  answers: Record<string, string>;

  /** Scores des joueurs pour ce round: { playerId: score } (lu en fin de partie) */
  scores: Record<string, number>;

  /** Indices des réponses révélées dans la phase REVEAL */
  revealedIndices: number[];

  /** Mode "Devine ma réponse" actif pour ce round (snapshot du lobby au moment du round) */
  guessMyAnswerMode: boolean;

  /** ID du joueur substitut désigné par le pilier (mode "Devine ma réponse") */
  substitutePlayerId?: string | null;

  /** Réponse écrite par le substitut au nom du pilier (mode "Devine ma réponse") */
  substituteAnswer?: string | null;
}