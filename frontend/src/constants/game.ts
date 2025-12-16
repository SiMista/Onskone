// Game configuration constants
import { GAME_CONSTANTS } from '@onskone/shared';

// Mode debug: met les timers à 1 heure pour travailler sur le front tranquillement
export const DEBUG_MODE = false;

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
  { id: 8, params: 'backgroundColor=eb9d9d&baseColor=8c542b&hair=dannyPhantom&hairColor=242424&mouth=smile&eyes=eyes&eyebrows=down&nose=curve&ears=attached&shirt=open&shirtColor=e3c946&earrings=stud&earringsProbability=100' },
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

  // Timer durations (in seconds) - with debug override
  TIMERS: {
    QUESTION_SELECTION: DEBUG_MODE ? DEBUG_TIMER : GAME_CONSTANTS.TIMERS.QUESTION_SELECTION,
    ANSWERING: DEBUG_MODE ? DEBUG_TIMER : GAME_CONSTANTS.TIMERS.ANSWERING,
    GUESSING: DEBUG_MODE ? DEBUG_TIMER : GAME_CONSTANTS.TIMERS.GUESSING,
  },

  // UI
  COPIED_MESSAGE_DURATION: 2000, // milliseconds
  CONFETTI_DURATION: 5000, // milliseconds
  CONFETTI_COUNT: 50,
} as const;

// En développement, utiliser le même hostname que la page pour permettre l'accès depuis d'autres appareils
const getServerUrl = () => {
  // Si une variable d'environnement est définie, l'utiliser
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }
  // Sinon, utiliser le même hostname que la page actuelle avec le port du backend
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${hostname}:8080`;
};

export const SERVER_URL = getServerUrl();