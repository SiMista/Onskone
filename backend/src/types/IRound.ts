import type { IRound as IRoundData, GameCard, IPlayer } from '@onskone/shared';
import { RoundPhase } from '@onskone/shared';

// Interface pour la classe Round (avec méthodes métier + bookkeeping serveur).
// Étend la VUE PUBLIQUE du shared (IRoundData) puis y rajoute tous les champs
// serveur-only retirés du contrat public (anti-fuite). Ces champs
// ne doivent jamais être projetés vers les clients par serializeGame/roundStarted.
export interface IRound extends IRoundData {
  // ===== Champs serveur-only (jamais émis aux clients) =====

  /** État intermédiaire du drag & drop: { answerId: playerId } */
  currentGuesses: Record<string, string>;

  /** Attributions finales du pilier: { answerId: playerId } */
  guesses: Record<string, string>;

  /** Date de fin du timer pour la phase actuelle (bookkeeping serveur) */
  timerEnd: Date | null;

  /** Phase pour laquelle le timer a été traité (protection contre les doubles appels) */
  timerProcessedForPhase?: RoundPhase | null;

  /** Timestamp de démarrage du timer (pour synchronisation) */
  timerStartedAt?: number;

  /** Durée du timer en secondes */
  timerDuration?: number;

  /** Phase pour laquelle le timer a été démarré (évite les conflits entre phases) */
  timerPhase?: RoundPhase;

  /** Nombre de relances utilisées par le pilier en phase QUESTION_SELECTION */
  relancesUsed: number;

  /** Les 3 cartes proposées au pilier pour la sélection */
  proposedCards: GameCard[];

  /** Cartes déjà montrées au pilier (pour éviter les doublons lors des relances) */
  shownGameCards: GameCard[];

  /** Indices des réponses corrigées par similarité */
  similarityCorrections: number[];

  // ===== Méthodes métier =====

  calculateScores(): void;
  addAnswer(playerId: string, answer: string): void;
  removeAnswer(playerId: string): void;
  setSelectedQuestion(question: string): void;
  updateCurrentGuess(answerId: string, playerId: string | null): void;
  submitGuesses(guesses: Record<string, string>): void;
  addBonusScore(playerId: string, points: number): void;
  nextPhase(): void;
  getGuessingAnswers(): Record<string, string>;
  getRespondingPlayers(players: IPlayer[]): IPlayer[];
  getGuessTargets(players: IPlayer[]): IPlayer[];
  fillMissingAnswers(players: IPlayer[], reason: string): IPlayer[];
  prepareGuessing(): { id: string; text: string; ownerId?: string }[];
  getOrderedGuessingAnswers(): { id: string; text: string; ownerId?: string }[];
  authorForSlot(slotId: string): string | undefined;
  slotForAuthor(authorId: string): string | undefined;
  getSlotIds(): Set<string>;
  currentGuessesBySlot(): Record<string, string>;
  setSubstitutePlayer(playerId: string): void;
  setSubstituteAnswer(answer: string): void;
}
