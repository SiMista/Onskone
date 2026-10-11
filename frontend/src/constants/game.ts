// Game configuration constants
import {
  GAME_CONSTANTS,
  RoundPhase,
  getBasePhaseDuration,
} from '@onskone/shared';
import type { GameSpeed } from '@onskone/shared';
import { Capacitor } from '@capacitor/core';

// Domaine public canonique du jeu (site web prod). Sert de base aux liens
// partageables : dans l'app native, window.location.origin vaut capacitor://localhost
// / https://localhost (inexploitable), donc on ne peut PAS s'appuyer dessus.
export const PUBLIC_WEB_URL = 'https://onskone.fr';

// Base d'URL pour un lien partagé à l'extérieur (invitation).
// - natif : toujours le domaine public (le lien doit marcher chez le destinataire) ;
// - web : l'origine courante (reste flexible sur previews / domaines alternatifs).
export const getShareBaseUrl = (): string => {
  if (Capacitor.isNativePlatform()) return PUBLIC_WEB_URL;
  return typeof window !== 'undefined' ? window.location.origin : PUBLIC_WEB_URL;
};

// Construit le lien d'invitation à un lobby (chemin /join/<code>, matchable par
// les App Links Android / Universal Links iOS, contrairement à un query param).
export const buildInviteUrl = (lobbyCode: string): string =>
  `${getShareBaseUrl()}/join/${encodeURIComponent(lobbyCode)}`;

// Extrait le code de lobby d'une URL d'invitation (chemin /join/<code> ou ancien
// ?lobbyCode=). Renvoie undefined si l'URL est non parsable ou sans code.
export const extractLobbyCode = (url: string): string | undefined => {
  try {
    const parsed = new URL(url);
    const fromPath = parsed.pathname.match(/\/join\/([^/?#]+)/)?.[1];
    return fromPath ?? parsed.searchParams.get('lobbyCode') ?? undefined;
  } catch {
    return undefined;
  }
};

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

/**
 * Vitesse de jeu à appliquer au lobby quand le mode debug est actif.
 * `null` hors DEV : le mode debug n'existe pas en production.
 *
 * Remplace l'ancien `DEBUG_TIMER` (1h renvoyée localement par getPhaseDuration).
 * Celui-ci ne trompait que l'affichage : la durée fait autorité côté serveur, qui
 * coupait la phase à l'heure réelle. Et surtout, le pilier l'envoyait via
 * `startTimer`, imposant 1h à TOUTE la table — joueurs en prod compris.
 * Passer par la vitesse du lobby rend le réglage explicite, partagé et
 * refusé par le serveur hors développement.
 */
export const DEBUG_GAME_SPEED: GameSpeed | null =
  DEBUG_MODE ? GAME_CONSTANTS.GAME_SPEED_DEBUG : null;

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

// ===== Durée des phases selon la vitesse de jeu =====
// Les tables de durées et leur logique vivent dans @onskone/shared (single source
// of truth partagée avec le backend, cf. broadcasting.getServerPhaseDuration) :
// ré-exportée telle quelle, sans enveloppe. La durée fait autorité côté SERVEUR (il
// ignore celle envoyée par le client), donc un allongement purement local ne ferait
// qu'afficher un sablier qui ment. Pour rallonger les phases en DEV, l'hôte règle la
// vitesse de debug du lobby (GAME_SPEED_DEBUG), appliquée par le serveur et donc
// partagée par toute la table.
export { getPhaseDuration } from '@onskone/shared';

// Marge approximative pour la phase REVEAL (pas de timer serveur) dans l'estimation.
const REVEAL_ESTIMATE_SECONDS = 20;

// Les joueurs n'utilisent jamais tout le timer : on n'estime qu'une fraction du temps imparti.
const ESTIMATE_TIMER_USAGE = 0.5;

/**
 * Durée totale d'une partie en SECONDES si chaque timer est consommé à hauteur de
 * `timerUsage` (0..1). Total ≈ durée d'un round × nombre de manches (1 par pilier).
 * `playerCount` pèse sur la devinette (plus de réponses à attribuer).
 * La vitesse DEBUG n'est volontairement PAS prise en compte ici (on reflète les
 * vraies durées de jeu, pas le mode debug).
 */
const gameSeconds = (
  playerCount: number,
  roundCount: number,
  gameSpeed: GameSpeed,
  guessMyAnswerMode: boolean,
  timerUsage: number,
): number => {
  const speed = gameSpeed === GAME_CONSTANTS.GAME_SPEED_DEBUG ? GAME_CONSTANTS.GAME_SPEED_DEFAULT : gameSpeed;
  const dur = (phase: RoundPhase) =>
    Math.round(getBasePhaseDuration(phase, playerCount, speed) * timerUsage);
  let roundSeconds =
    dur(RoundPhase.QUESTION_SELECTION) +
    dur(RoundPhase.ANSWERING) +
    dur(RoundPhase.GUESSING) +
    REVEAL_ESTIMATE_SECONDS; // pas de timer : même marge quelle que soit la vitesse
  if (guessMyAnswerMode) {
    roundSeconds += dur(RoundPhase.SUBSTITUTE_SELECTION) + dur(RoundPhase.SUBSTITUTE_ANSWERING);
  }
  return roundSeconds * Math.max(1, roundCount);
};

/**
 * Estimation de la durée totale d'une partie en MINUTES, pour l'affichage "~X min"
 * dans le lobby (fraction ESTIMATE_TIMER_USAGE de chaque timer).
 */
export const estimateGameMinutes = (
  playerCount: number,
  roundCount: number,
  gameSpeed: GameSpeed,
  guessMyAnswerMode: boolean,
): number => {
  // Fraction du timer réellement consommée (les joueurs répondent avant la fin).
  const totalSeconds = gameSeconds(playerCount, roundCount, gameSpeed, guessMyAnswerMode, ESTIMATE_TIMER_USAGE);
  return Math.max(1, Math.round(totalSeconds / 60));
};

/**
 * Durée MAX d'une partie en MINUTES (arrondie au-dessus) : tous les timers vont
 * au bout. La révélation, sans timer, garde sa marge REVEAL_ESTIMATE_SECONDS.
 */
export const maxGameMinutes = (
  playerCount: number,
  roundCount: number,
  gameSpeed: GameSpeed,
  guessMyAnswerMode: boolean,
): number => Math.max(1, Math.ceil(gameSeconds(playerCount, roundCount, gameSpeed, guessMyAnswerMode, 1) / 60));

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