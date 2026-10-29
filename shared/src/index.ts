/**
 * @onskone/shared
 *
 * Package de types partagés entre le frontend et le backend
 */

// Constants
export {
  GAME_CONSTANTS,
  NO_RESPONSE_PREFIX,
  isNoResponse,
  formatNoResponse,
  isGameSpeed,
  getBasePhaseDuration,
  getPhaseDuration,
} from './constants.js';

// Version de l'app + règle de maj forcée
export {
  parseVersion,
  isOlderVersion,
  isActiveVersion,
  shouldBlockForUpdate,
  CLIENT_VERSION_POLICY,
} from './version.js';
export type { VersionPolicy } from './version.js';

// Mode maintenance (activable depuis l'admin)
export { MAINTENANCE_OFF, isMaintenanceMode } from './maintenance.js';
export type { MaintenanceMode, MaintenanceState } from './maintenance.js';

// Synchronisation de l'état de partie (empreinte + cadence des syncCheck)
export { gameFingerprint, SYNC_CHECK_INTERVAL_MS, SYNC_ACK_TIMEOUT_MS } from './sync.js';
export type { GameFingerprintSource } from './sync.js';

// Player
export { IPlayer } from './types/player.js';

// Lobby
export { ILobby, GameMode, GameSpeed } from './types/lobby.js';

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
export { ERROR_CODES } from './types/socket-events.js';
export type {
  ErrorCode,
  ReclaimablePlayer,
  TimerStartedPayload,
  TimerStatePayload,
  ErrorPayload
} from './types/socket-events.js';

// Admin
export {
  AdminLobbyPhase,
  AdminLobbyPlayer,
  AdminLobbySummary,
  AdminDeckSubject,
  AdminDeckSummary,
  AdminDeckStatRow,
  AdminDeckStats
} from './types/admin.js';