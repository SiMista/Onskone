import { IPlayer } from "./IPlayer";
import {GameCard} from "../managers/GameManager";

export interface IRound {
  roundNumber: number;
  leader: IPlayer;
  gameCard: GameCard;
  answers: Record<string, string>;
  scores: Record<string, number>; // Scores des joueurs pour ce round (clé = ID du joueur, valeur = score)
  calculateScores(): void;
  addAnswer(playerId: string, answer: string): void;
}
