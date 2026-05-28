/**
 * Stats persistantes du joueur (localStorage, namespacé Studio).
 *
 * Schéma versionné -> si on change la forme plus tard, on migre via `version`.
 */
import { studioStorage } from './studioStorage';

const STORAGE_KEY = 'onskone:profile';
// v2 -> remplace bestScore par totalPoints, ajoute topFinishes.
const CURRENT_VERSION = 2;

export interface PlayerStats {
  version: number;
  gamesPlayed: number;
  totalPoints: number;
  correctGuessesAsLeader: number;
  roundsAsLeader: number;
  topFinishes: number;
  lastPseudo: string | null;
  lastAvatarId: number | null;
  unlockedAchievements: string[];
  /** Succès déjà consultés par l'utilisateur (ouverture de la modale). Permet de marquer les nouveaux. */
  seenAchievements: string[];
  /** Liste de lobbyCodes déjà comptés -> garde-fou anti double-compte si l'utilisateur refresh EndGame. */
  recordedLobbies: string[];
}

const DEFAULT_STATS: PlayerStats = {
  version: CURRENT_VERSION,
  gamesPlayed: 0,
  totalPoints: 0,
  correctGuessesAsLeader: 0,
  roundsAsLeader: 0,
  topFinishes: 0,
  lastPseudo: null,
  lastAvatarId: null,
  unlockedAchievements: [],
  seenAchievements: [],
  recordedLobbies: [],
};

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Si vrai, le succès n'apparaît pas dans la liste tant qu'il n'est pas débloqué. */
  hidden?: boolean;
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
    description: '25 parties terminées. Mais t’es pas fatigué ?',
    icon: 'fluent-emoji-flat:gem-stone',
  },
  {
    id: 'mind-reader-20',
    title: "Lecteur d'esprit",
    description: 'Trouver 20 réponses en tant que pilier.',
    icon: 'fluent-emoji-flat:bullseye',
  },
  {
    id: 'marathon',
    title: 'Marathon',
    description: 'Terminer une partie de 10 manches ou plus.',
    icon: 'fluent-emoji-flat:running-shoe',
  },
  {
    id: 'top-1-thrice',
    title: 'Sur le podium',
    description: "Finir 1er d'une partie, 3 fois.",
    icon: 'fluent-emoji-flat:1st-place-medal',
  },
  {
    id: 'zero-percent',
    title: 'Catastrophe industrielle',
    description: 'Atteindre 0% en équipe. Bravo (?).',
    icon: 'fluent-emoji-flat:skull',
    hidden: true,
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
    const merged: PlayerStats = { ...DEFAULT_STATS, ...parsed };
    // Migration silencieuse : si seenAchievements absent, on considère les succès déjà débloqués
    // comme déjà vus pour éviter de spammer une notif rétroactive aux anciens utilisateurs.
    if (parsed.seenAchievements === undefined) {
      merged.seenAchievements = [...merged.unlockedAchievements];
    }
    return merged;
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

/** Renvoie les succès débloqués mais pas encore consultés (drive le point de notif). */
export function getUnseenAchievementIds(): string[] {
  const stats = getStats();
  const seen = new Set(stats.seenAchievements);
  return stats.unlockedAchievements.filter(id => !seen.has(id));
}

/** Marque tous les succès débloqués comme vus. Renvoie la liste qui vient d'être marquée. */
export function markAchievementsAsSeen(): string[] {
  const stats = getStats();
  const seen = new Set(stats.seenAchievements);
  const newlySeen = stats.unlockedAchievements.filter(id => !seen.has(id));
  if (newlySeen.length === 0) return [];
  stats.seenAchievements = [...stats.unlockedAchievements];
  saveStats(stats);
  return newlySeen;
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
  /** Nombre total de manches jouées dans la partie (pour marathon). */
  roundsPlayed: number;
  /** Rang final du joueur (1 = premier). */
  finishRank: number;
}

/**
 * Enregistre une fin de partie et retourne la liste des achievements nouvellement débloqués.
 * Idempotent : si on a déjà enregistré ce lobbyCode, no-op.
 */
export function recordGameEnd(payload: GameEndPayload): Achievement[] {
  const stats = getStats();
  if (stats.recordedLobbies.includes(payload.lobbyCode)) return [];

  stats.gamesPlayed += 1;
  stats.totalPoints += payload.playerScore;
  stats.roundsAsLeader += payload.roundsAsLeader;
  stats.correctGuessesAsLeader += payload.correctGuessesAsLeader;
  if (payload.finishRank === 1) stats.topFinishes += 1;
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
  if (stats.gamesPlayed >= 25) unlock('veteran-50');
  if (stats.correctGuessesAsLeader >= 20) unlock('mind-reader-20');
  if (payload.teamPct >= 100) unlock('perfect-score');
  if (payload.roundsPlayed >= 10) unlock('marathon');
  if (stats.topFinishes >= 3) unlock('top-1-thrice');
  if (payload.teamPct <= 0) unlock('zero-percent');

  saveStats(stats);
  return newlyUnlocked;
}
