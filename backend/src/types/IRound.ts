import { IPlayer } from "./IPlayer";

export interface IRound {
    roundNumber: number;
    leader: IPlayer;
    questions: string[];            
    answers: Record<string, string>;              
    scores: Record<string, number>; // Scores des joueurs pour ce round (clé = ID du joueur, valeur = score)
    calculateScores(): void;    
  }
  