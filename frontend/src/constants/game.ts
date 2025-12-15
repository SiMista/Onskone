// Game configuration constants

// Mode debug: met les timers à 1 heure pour travailler sur le front tranquillement
export const DEBUG_MODE = false;

const DEBUG_TIMER = 3600; // 1 heure

// Configuration des avatars DiceBear - Caractéristiques exactes (pas de seed/probabilité)
// Documentation: https://www.dicebear.com/styles/micah/
const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/micah/svg';

export const AVATARS = [
  { id: 0, params: 'backgroundColor=b6e3f4&baseColor=f9c9b6&hair=fonze&hairColor=0e0e0e&mouth=smile&eyes=smiling&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=6bd9e9' },
  // Arabic women, 
  { id: 1, params: 'backgroundColor=ffdfbf&baseColor=f1c27d&hair=full&hairColor=3c2f23&mouth=smirk&eyes=eyes&eyebrows=up&nose=pointed&ears=attached&shirt=collared&shirtColor=ffb347&glasses=square&glassesProbability=100&glassesColor=363535' },
  { id: 2, params: 'backgroundColor=d1f4d1&baseColor=fad7b5&hair=dannyPhantom&hairColor=b55239&mouth=laughing&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=e3c698&glasses=round&glassesProbability=100&glassesColor=363535' },
  // Black women, pink shirt, earrings
  { id: 3, params: 'backgroundColor=dbbff2&baseColor=8f5742&hair=full&hairColor=1f1f1f&mouth=pucker&eyes=smilingShadow&eyebrows=up&nose=curve&earrings=hoop&earringsProbability=100&shirt=open&shirtColor=e33659' },
  // Punk man, black shirt
  { id: 4, params: 'backgroundColor=e3d1cf&baseColor=ebcdab&hair=mrT&hairColor=2cbdd4&mouth=nervous&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=2f302e' },
  // (Clover) White woman, short blond hair, red shirt
  { id: 5, params: 'backgroundColor=ebb0d9&baseColor=ffdbac&hair=pixie&hairColor=ffeb3b&mouth=smirk&eyes=smiling&eyebrows=up&nose=pointed&ears=attached&shirt=crew&shirtColor=f53838&earrings=stud' },
  // (Vikas) Indian man, turban, purple shirt
  { id: 6, params: 'backgroundColor=dce8d1&baseColor=bf8c67&hair=turban&hairColor=90ab79&mouth=laughing&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=collared&shirtColor=e5cfe8&glasses=square&facialHair=beard&facialHairProbability=100' },
  // Bald white man
  { id: 7, params: 'backgroundColor=c5e1f5&baseColor=e0ac69&hair=mrClean&mouth=nervous&eyes=smiling&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=1976d2&facialHair=scruff&facialHairProbability=100' },
  // (Simi) Black man, yellow shirt, earrings
  { id: 8, params: 'backgroundColor=eb9d9d&baseColor=8c542b&hair=dannyPhantom&hairColor=242424&mouth=smile&eyes=eyes&eyebrows=down&nose=curve&ears=attached&shirt=open&shirtColor=e3c946&earrings=stud&earringsProbability=100' },
  // (Boubou) Black man, blue polo, glasses
  { id: 9, params: 'backgroundColor=cfc5eb&baseColor=8d5524&hair=fonze&hairColor=242424&mouth=surprised&eyes=eyes&eyebrows=up&nose=pointed&ears=attached&shirt=collared&shirtColor=304a8a&glasses=square&glassesProbability=100&glassesColor=1a1a1a' },
  // White woman, brown hair, green shirt, earrings
  { id: 10, params: 'backgroundColor=edc3ad&baseColor=fad7b5&hair=full&hairColor=6a4e35&mouth=smile&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=crew&shirtColor=7bc462&earrings=stud&earringsProbability=100' },
  // (Mimi) Indian woman, bun hairstyle, orange shirt, earrings
  { id: 11, params: 'backgroundColor=bce0cd&baseColor=8c542b&hair=pixie&hairColor=1f1f1f&mouth=smirk&eyes=smilingShadow&eyebrows=up&nose=pointed&ears=attached&shirt=collared&shirtColor=ed852b&earrings=stud&earringsProbability=100' },
  // (Kaaris) African bald man, beard, gray shirt
  { id: 12, params: 'backgroundColor=f2da77&baseColor=6b3d1a&hair=mrClean&mouth=nervous&eyes=eyes&eyebrows=up&nose=curve&ears=attached&shirt=open&shirtColor=707070&facialHair=beard&facialHairProbability=100' },
] as const;

// Fonction pour générer l'URL DiceBear à partir d'un avatarId
export const getAvatarUrl = (avatarId: number): string => {
  const avatar = AVATARS[avatarId] || AVATARS[0];
  return `${DICEBEAR_BASE}?${avatar.params}&scale=100`;
};

export const GAME_CONFIG = {
  // Player limits
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 20,

  // Character limits
  MAX_NAME_LENGTH: 20,
  MAX_ANSWER_LENGTH: 70,

  // Timer durations (in seconds)
  TIMERS: {
    QUESTION_SELECTION: DEBUG_MODE ? DEBUG_TIMER : 30,
    ANSWERING: DEBUG_MODE ? DEBUG_TIMER : 60,
    GUESSING: DEBUG_MODE ? DEBUG_TIMER : 90,
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