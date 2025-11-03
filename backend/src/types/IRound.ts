import { IPlayer, RoundPhase, GameCard, IRound as IRoundData } from '@onskone/shared';

// Interface pour la classe Round (avec méthodes métier)
// Étend l'interface de données du shared
export interface IRound extends IRoundData {
  calculateScores(): void;
  addAnswer(playerId: string, answer: string): void;
  setSelectedQuestion(question: string): void;
  updateCurrentGuess(answerId: string, playerId: string | null): void;
  submitGuesses(guesses: Record<string, string>): void;
  nextPhase(): void;
}

// Re-export pour compatibilité
export { RoundPhase, IPlayer, GameCard };
