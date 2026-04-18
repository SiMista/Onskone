import { IRound } from './IRound';
import {
  GameStatus,
  ILobby,
  IPlayer,
  LeaderboardEntry,
  IGame as IGameData,
  GameCard
} from '@onskone/shared';

// Interface pour la classe Game (avec méthodes métier)
// Étend l'interface de données du shared mais redéfinit les types avec méthodes
export interface IGame extends Omit<IGameData, 'rounds' | 'currentRound'> {
  rounds: IRound[];
  currentRound: IRound | null;
  /** Pool de cartes filtré selon les decks sélectionnés (figé au démarrage) */
  cards: GameCard[];
  nextRound(): void;
  start(): void;
  end(): void;
  isGameOver(): boolean;
  getLeaderboard(): LeaderboardEntry[];
  getMaxRounds(): number;
}

// Re-export pour compatibilité
export { LeaderboardEntry, ILobby, IPlayer, GameStatus, IRound };
