// Game configuration constants
import { GAME_CONSTANTS, RoundPhase } from '@onskone/shared';

// Mode debug: met les timers à 1 heure pour travailler sur le front tranquillement
// Activé via VITE_DEBUG_MODE=true dans .env OU via le query param ?debug=1
// (en DEV uniquement - toujours désactivé en production)
// Sticky debug flag: once enabled via ?debug=1, it persists for the whole tab
// session (survives navigations + reloads). Use ?debug=0 to clear it.
const resolveDebugMode = (): boolean => {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_DEBUG_MODE === 'true') return true;
  if (typeof window === 'undefined') return false;
  try {
    const param = new URLSearchParams(window.location.search).get('debug');
    if (param === '1') { sessionStorage.setItem('debug', '1'); return true; }
    if (param === '0') { sessionStorage.removeItem('debug'); return false; }
    return sessionStorage.getItem('debug') === '1';
  } catch {
    return false;
  }
};
const DEBUG_MODE = resolveDebugMode();

const DEBUG_TIMER = 3600; // 1 heure

// Configuration des avatars DiceBear - Caractéristiques exactes (pas de seed/probabilité)
// Documentation: https://www.dicebear.com/styles/micah/
const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/micah/svg';

export const AVATARS = [
  // (Fred, Scooby Doo) White man, blonde hair, blue shirt
  { id: 0, params: 'backgroundColor=b6e3f4&baseColor=f2be99&hair=fonze&hairColor=f5d731&mouth=smile&eyes=smiling&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=82deff' },
  // Black women, blue shirt, earrings
  { id: 1, params: 'backgroundColor=edce95&baseColor=8f5742&hair=full&hairColor=1f1f1f&mouth=smile&eyes=eyes&eyebrows=up&&nose=curve&earrings=stud&earringsProbability=100&shirt=open&shirtColor=5cb7e0&glasses=round&glassesProbability=100&glassesColor=363535' },
  // (Harry) White man, red hair, glasses
  { id: 2, params: 'backgroundColor=d1f4d1&baseColor=f2be99&hair=dannyPhantom&hairColor=b55239&mouth=laughing&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=e3c698&glasses=round&glassesProbability=100&glassesColor=363535' },
  // (Brinda) Black women, pink shirt, earrings
  { id: 3, params: 'backgroundColor=dbbff2&baseColor=8f5742&hair=full&hairColor=1f1f1f&mouth=pucker&eyes=smilingShadow&eyebrows=up&nose=curve&earrings=hoop&earringsProbability=100&shirt=open&shirtColor=e33659' },
  // Punk man, black shirt
  { id: 4, params: 'backgroundColor=e3d1cf&baseColor=f2be99&hair=mrT&hairColor=2cbdd4&mouth=nervous&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=2f302e' },
  // (Clover) White woman, short blond hair, red shirt
  { id: 5, params: 'backgroundColor=ebb0d9&baseColor=f2be99&hair=pixie&hairColor=ffeb3b&mouth=smirk&eyes=smiling&eyebrows=up&nose=pointed&ears=attached&shirt=crew&shirtColor=f53838&earrings=stud' },
  // (Vikas) Indian man, turban, purple shirt
  { id: 6, params: 'backgroundColor=dce8d1&baseColor=bf8c67&hair=turban&hairColor=90ab79&mouth=laughing&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=collared&shirtColor=e3d5f0&facialHair=beard&facialHairProbability=100' },
  // (Michel), Bald white man
  { id: 7, params: 'backgroundColor=c5e1f5&baseColor=e0ac69&hair=mrClean&mouth=nervous&eyes=smiling&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=653f8a&facialHair=scruff&facialHairProbability=100' },
  // (Simi) Black man, yellow shirt, earrings
  { id: 8, params: 'backgroundColor=eb9d9d&baseColor=8c542b&hair=fonze&hairColor=242424&mouth=smile&eyes=eyes&eyebrows=down&nose=curve&ears=attached&shirt=open&shirtColor=e3c946&earrings=stud&earringsProbability=100' },
  // (Boubou) Black man, blue polo, glasses
  { id: 9, params: 'backgroundColor=cfc5eb&baseColor=8d5524&hair=fonze&hairColor=242424&mouth=surprised&eyes=eyes&eyebrows=up&nose=pointed&ears=attached&shirt=collared&shirtColor=304a8a&glasses=square&glassesProbability=100&glassesColor=1a1a1a' },
  // (Sam, Totally Spies) White woman, red hair, green shirt, earrings
  { id: 10, params: 'backgroundColor=c4edb9&baseColor=f2be99&hair=full&hairColor=cc5f37&mouth=smile&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=7bc462&earrings=stud&earringsProbability=100' },
  // (Mimi) Indian woman, bun hairstyle, orange shirt, earrings
  { id: 11, params: 'backgroundColor=ede3ab&baseColor=8c542b&hair=pixie&hairColor=1f1f1f&mouth=smirk&eyes=smilingShadow&eyebrows=up&nose=pointed&ears=attached&shirt=collared&shirtColor=ed852b&earrings=stud&earringsProbability=100' },
  // (Kaaris) African bald man, beard, gray shirt
  { id: 12, params: 'backgroundColor=edcf68&baseColor=6b3d1a&hair=mrClean&mouth=nervous&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=open&shirtColor=707070&facialHair=beard&facialHairProbability=100&facialHairColor=0f0f0f' },
  // (Arab lover) Arabic man, black hair, pink shirt, earrings
  { id: 13, params: 'backgroundColor=e670a9&baseColor=f1c27d&hair=fonze&hairColor=3c2f23&mouth=pucker&eyes=smiling&eyebrows=down&nose=pointed&ears=attached&shirt=collared&shirtColor=e4dded&earrings=stud&earringsProbability=100' },
  // White girl, purple shirt, earrings
  { id: 14, params: 'backgroundColor=8cc2db&baseColor=f2be99&hair=full&hairColor=1a1a1a&mouth=smile&eyes=smilingShadow&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=b17dc7&earrings=hoop&earringsProbability=100' },
  // Arabic women, black hair, glasses
  { id: 15, params: 'backgroundColor=ffdfbf&baseColor=f1c27d&hair=full&hairColor=3c2f23&mouth=smirk&eyes=eyes&eyebrows=up&nose=pointed&ears=attached&shirt=collared&shirtColor=ba773c&glasses=square&glassesProbability=100&glassesColor=363535' },
  // Arab man, green shirt
  { id: 16, params: 'backgroundColor=ffe6a7&baseColor=bf8c67&hair=fonze&hairColor=3a2f2f&mouth=smile&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=collared&shirtColor=8ab17d' },
  // (Vera, Scooby Doo) White woman, red hair, orange shirt, glasses
  { id: 17, params: 'backgroundColor=d2a5e8&baseColor=f2be99&hair=pixie&hairColor=bf411b&mouth=smirk&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=open&shirtColor=ed9d3b&glasses=square&glassesProbability=100&glassesColor=1f1f1f' }
] as const;

// Fonction pour générer l'URL DiceBear à partir d'un avatarId
export const getAvatarUrl = (avatarId: number): string => {
  const avatar = AVATARS[avatarId] || AVATARS[0];
  return `${DICEBEAR_BASE}?${avatar.params}&scale=100`;
};

export const GAME_CONFIG = {
  // Player limits (from shared constants)
  MIN_PLAYERS: GAME_CONSTANTS.MIN_PLAYERS,
  MAX_PLAYERS: GAME_CONSTANTS.MAX_PLAYERS,

  // Character limits (from shared constants)
  MAX_NAME_LENGTH: GAME_CONSTANTS.MAX_NAME_LENGTH,
  MAX_ANSWER_LENGTH: GAME_CONSTANTS.MAX_ANSWER_LENGTH,
} as const;

// ===== Durée des phases avec multiplicateur de temps réglable =====
// Le multiplicateur (réglé par l'hôte dans le lobby) scale toutes les durées de
// phase. On centralise ici plutôt que de multiplier inline dans chaque composant
// de phase (il y en a 6) — single source of truth.

// Borne le multiplicateur dans la plage des niveaux autorisés (fallback DEFAULT si NaN).
const clampMultiplier = (m: number): number => {
  if (!Number.isFinite(m)) return GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT;
  const levels = GAME_CONSTANTS.TIME_MULTIPLIER_LEVELS;
  return Math.min(Math.max(m, levels[0]), levels[levels.length - 1]);
};

// Durée "de base" (avant multiplicateur) d'une phase, en secondes.
// La phase GUESSING a une durée dynamique : 120s à 3 joueurs, +20s par joueur
// supplémentaire (règle historiquement portée par GuessingPhase.tsx).
const GUESSING_BASE = 120;
const GUESSING_EXTRA_PER_PLAYER = 20;
const basePhaseDuration = (phase: RoundPhase, playerCount: number): number => {
  if (phase === RoundPhase.GUESSING) {
    return GUESSING_BASE + Math.max(0, playerCount - 3) * GUESSING_EXTRA_PER_PLAYER;
  }
  switch (phase) {
    case RoundPhase.QUESTION_SELECTION: return GAME_CONSTANTS.TIMERS.QUESTION_SELECTION;
    case RoundPhase.SUBSTITUTE_SELECTION: return GAME_CONSTANTS.TIMERS.SUBSTITUTE_SELECTION;
    case RoundPhase.ANSWERING: return GAME_CONSTANTS.TIMERS.ANSWERING;
    case RoundPhase.SUBSTITUTE_ANSWERING: return GAME_CONSTANTS.TIMERS.SUBSTITUTE_ANSWERING;
    default: return 0; // REVEAL (pas de timer)
  }
};

/**
 * Durée effective d'une phase en secondes, multiplicateur appliqué.
 * En mode DEBUG, on ignore le multiplicateur et on renvoie la durée de debug (1h).
 */
export const getPhaseDuration = (
  phase: RoundPhase,
  timeMultiplier: number = GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT,
  playerCount = 3,
): number => {
  if (DEBUG_MODE) return DEBUG_TIMER;
  const base = basePhaseDuration(phase, playerCount);
  return Math.max(1, Math.round(base * clampMultiplier(timeMultiplier)));
};

// Marge approximative pour la phase REVEAL (pas de timer serveur) dans l'estimation.
const REVEAL_ESTIMATE_SECONDS = 20;

// Les joueurs n'utilisent jamais tout le timer : on n'estime qu'une fraction du temps imparti.
const ESTIMATE_TIMER_USAGE = 0.3;

/**
 * Estimation de la durée totale d'une partie en MINUTES, pour l'affichage "~X min"
 * dans le lobby. Total ≈ durée d'un round × nombre de joueurs (1 round par joueur).
 * Le multiplicateur DEBUG n'est volontairement PAS pris en compte ici (l'estimation
 * reflète les vraies durées de jeu, pas le mode debug).
 */
export const estimateGameMinutes = (
  playerCount: number,
  timeMultiplier: number,
  guessMyAnswerMode: boolean,
): number => {
  const m = clampMultiplier(timeMultiplier);
  // Fraction du timer réellement consommée (les joueurs répondent avant la fin).
  const dur = (phase: RoundPhase) =>
    Math.round(basePhaseDuration(phase, playerCount) * m * ESTIMATE_TIMER_USAGE);
  let roundSeconds =
    dur(RoundPhase.QUESTION_SELECTION) +
    dur(RoundPhase.ANSWERING) +
    dur(RoundPhase.GUESSING) +
    Math.round(REVEAL_ESTIMATE_SECONDS * m); // pas de timer : on scale juste sur la vitesse
  if (guessMyAnswerMode) {
    roundSeconds += dur(RoundPhase.SUBSTITUTE_SELECTION) + dur(RoundPhase.SUBSTITUTE_ANSWERING);
  }
  const totalSeconds = roundSeconds * Math.max(1, playerCount);
  return Math.max(1, Math.round(totalSeconds / 60));
};

// Couleurs associées à chaque catégorie de cartes (utilisées pour le fond du
// bloc illustration des thèmes et le surlignage des pills sélectionnées).
// Les catégories non listées tombent sur DEFAULT_CATEGORY_COLOR.
export const CATEGORY_COLORS: Record<string, string> = {
  ICEBREAKERS: '#1aafda', // bleu
  FUN: '#f6b31f',         // jaune
  DEEP: '#ea4747',        // violet
};
const DEFAULT_CATEGORY_COLOR = '#9ca3af'; // gris par défaut

export const getCategoryColor = (category: string): string =>
  CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR;

// Mix linéaire entre un hex et une cible (255 = blanc, 0 = noir).
const mixHex = (hex: string, target: number, ratio: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const channel = (c: number) =>
    Math.round(Math.max(0, Math.min(255, c + (target - c) * ratio))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
};
export const lightenHex = (hex: string, amount: number) => mixHex(hex, 255, amount);
export const darkenHex = (hex: string, amount: number) => mixHex(hex, 0, amount);

// Version pastel/adoucie pour les pilules de fond.
export const getSoftCategoryColor = (category: string, amount = 0.35): string =>
  lightenHex(getCategoryColor(category), amount);

// Configuration de l'URL du serveur backend
const getServerUrl = () => {
  // Si une variable d'environnement est définie, l'utiliser
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  // En production (pas localhost), utiliser le même origin (Nginx fait le proxy)
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

  if (isLocalDev) {
    // En dev local, se connecter directement au backend sur le port 8080
    return `http://${hostname}:8080`;
  }

  // En production, utiliser le même origin (port 80/443, Nginx proxy vers 8080)
  return typeof window !== 'undefined' ? window.location.origin : '';
};

export const SERVER_URL = getServerUrl();