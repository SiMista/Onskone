/**
 * @onskone/shared
 *
 * Package de types partagés entre le frontend et le backend
 */

// Constants
export { GAME_CONSTANTS } from './constants.js';

// Player
export { IPlayer } from './types/player.js';

// Lobby
export { ILobby } from './types/lobby.js';

// Round
export {
  IRound,
  RoundPhase,
  GameCard
} from './types/round.js';

// Game
export {
  IGame,
  GameStatus,
  LeaderboardEntry,
  RoundData,
  RoundStat
} from './types/game.js';

// Socket Events
export {
  ServerToClientEvents,
  ClientToServerEvents,
  RevealResult
} from './types/socket-events.js';