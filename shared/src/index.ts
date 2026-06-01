/**
 * @onskone/shared
 *
 * Package de types partagés entre le frontend et le backend
 */

// Constants
export { GAME_CONSTANTS, NO_RESPONSE_PREFIX, isNoResponse, formatNoResponse } from './constants.js';

// Player
export { IPlayer } from './types/player.js';

// Lobby
export { ILobby, GameMode } from './types/lobby.js';

// Locale (langues supportées pour les questions + textes du site)
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, isLocale } from './types/locale.js';
export type { Locale } from './types/locale.js';

// Decks
export { DecksCatalog, DecksCatalogWithMeta, ThemeInfo, SelectedDecks } from './types/decks.js';

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
  LeaderboardEntry
} from './types/game.js';

// Socket Events
export {
  ServerToClientEvents,
  ClientToServerEvents,
  RevealResult,
  ReconnectionData
} from './types/socket-events.js';

// Admin
export {
  AdminLobbyPhase,
  AdminLobbyPlayer,
  AdminLobbySummary,
  AdminDeckSubject,
  AdminDeckSummary
} from './types/admin.js';