/**
 * Stats persistantes du joueur (localStorage, namespacé Studio).
 *
 * Schéma versionné -> si on change la forme plus tard, on migre via `version`.
 */
import { studioStorage } from './studioStorage';

const STORAGE_KEY = 'onskone:profile';
const CURRENT_VERSION = 1;

export interface PlayerStats {
  version: number;
  gamesPlayed: number;
  bestScore: number;
  correctGuessesAsLeader: number;
  roundsAsLeader: number;
  lastPseudo: string | null;
  lastAvatarId: number | null;
  unlockedAchievements: string[];
  /** Liste de lobbyCodes déjà comptés -> garde-fou anti double-compte si l'utilisateur refresh EndGame. */
  recordedLobbies: string[];
}

const DEFAULT_STATS: PlayerStats = {
  version: CURRENT_VERSION,
  gamesPlayed: 0,
  bestScore: 0,
  correctGuessesAsLeader: 0,
  roundsAsLeader: 0,
  lastPseudo: null,
  lastAvatarId: null,
  unlockedAchievements: [],
  recordedLobbies: [],
};

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-game',
    title: 'Première partie',
    description: 'Tu as terminé ta toute première partie.',
    icon: 'fluent-emoji-flat:party-popper',
  },
  {
    id: 'loyal-10',
    title: 'Fidèle',
    description: '10 parties au compteur.',
    icon: 'fluent-emoji-flat:fire',
  },
  {
    id: 'veteran-50',
    title: 'Vétéran',
    description: '50 parties terminées. La maison vous remercie.',
    icon: 'fluent-emoji-flat:gem-stone',
  },
  {
    id: 'mind-reader-20',
    title: "Lecteur d'esprit",
    description: '20 bonnes devinettes en tant que leader.',
    icon: 'fluent-emoji-flat:bullseye',
  },
  {
    id: 'perfect-score',
    title: 'Score parfait',
    description: 'Une équipe à 100%. Onskoné !',
    icon: 'fluent-emoji-flat:trophy',
  },
];

const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

export const getAchievement = (id: string): Achievement | undefined => ACHIEVEMENT_BY_ID.get(id);

export function getStats(): PlayerStats {
  try {
    const raw = studioStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CURRENT_VERSION) {
      return { ...DEFAULT_STATS };
    }
    return { ...DEFAULT_STATS, ...parsed };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function saveStats(stats: PlayerStats): void {
  try {
    studioStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    /* silent */
  }
}

export function rememberIdentity(pseudo: string, avatarId: number): void {
  const stats = getStats();
  stats.lastPseudo = pseudo;
  stats.lastAvatarId = avatarId;
  saveStats(stats);
}

interface GameEndPayload {
  lobbyCode: string;
  playerScore: number;
  teamPct: number;
  roundsAsLeader: number;
  correctGuessesAsLeader: number;
}

/**
 * Enregistre une fin de partie et retourne la liste des achievements nouvellement débloqués.
 * Idempotent : si on a déjà enregistré ce lobbyCode, no-op.
 */
export function recordGameEnd(payload: GameEndPayload): Achievement[] {
  const stats = getStats();
  if (stats.recordedLobbies.includes(payload.lobbyCode)) return [];

  stats.gamesPlayed += 1;
  stats.bestScore = Math.max(stats.bestScore, payload.playerScore);
  stats.roundsAsLeader += payload.roundsAsLeader;
  stats.correctGuessesAsLeader += payload.correctGuessesAsLeader;
  stats.recordedLobbies.push(payload.lobbyCode);
  // Borne à 50 derniers pour pas faire grossir la clé indéfiniment.
  if (stats.recordedLobbies.length > 50) {
    stats.recordedLobbies = stats.recordedLobbies.slice(-50);
  }

  const newlyUnlocked: Achievement[] = [];
  const unlock = (id: string) => {
    if (stats.unlockedAchievements.includes(id)) return;
    const ach = getAchievement(id);
    if (!ach) return;
    stats.unlockedAchievements.push(id);
    newlyUnlocked.push(ach);
  };

  if (stats.gamesPlayed >= 1) unlock('first-game');
  if (stats.gamesPlayed >= 10) unlock('loyal-10');
  if (stats.gamesPlayed >= 50) unlock('veteran-50');
  if (stats.correctGuessesAsLeader >= 20) unlock('mind-reader-20');
  if (payload.teamPct >= 100) unlock('perfect-score');

  saveStats(stats);
  return newlyUnlocked;
}
