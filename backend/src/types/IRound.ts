import { IPlayer } from "./IPlayer";
import {GameCard} from "../managers/GameManager";

export enum RoundPhase {
  QUESTION_SELECTION = 'QUESTION_SELECTION',
  ANSWERING = 'ANSWERING',
  GUESSING = 'GUESSING',
  REVEAL = 'REVEAL'
}

export interface IRound {
  roundNumber: number;
  leader: IPlayer;
  gameCard: GameCard;
  phase: RoundPhase;
  selectedQuestion: string | null; // La question choisie par le chef parmi les 3
  answers: Record<string, string>; // Réponses des joueurs (clé = ID du joueur, valeur = réponse)
  currentGuesses: Record<string, string>; // État intermédiaire du drag & drop (clé = ID réponse, valeur = ID joueur)
  guesses: Record<string, string>; // Attributions finales du chef (clé = ID réponse, valeur = ID joueur)
  scores: Record<string, number>; // Scores des joueurs pour ce round (clé = ID du joueur, valeur = score)
  timerEnd: Date | null; // Fin du timer pour la phase actuelle
  calculateScores(): void;
  addAnswer(playerId: string, answer: string): void;
  setSelectedQuestion(question: string): void;
  updateCurrentGuess(answerId: string, playerId: string | null): void;
  submitGuesses(guesses: Record<string, string>): void;
  nextPhase(): void;
}
