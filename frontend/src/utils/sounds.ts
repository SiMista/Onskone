/**
 * Utilitaire pour jouer des sons dans l'application
 */

const SOUNDS = {
  questionSelection: '/sounds/question_selection_phase.mp3',
  answering: '/sounds/answering_phase.mp3',
} as const;

type SoundName = keyof typeof SOUNDS;

// Cache des objets Audio pour éviter de les recréer à chaque fois
const audioCache: Partial<Record<SoundName, HTMLAudioElement>> = {};

/**
 * Joue un son par son nom
 */
export const playSound = (soundName: SoundName, volume: number = 0.5): void => {
  try {
    // Récupérer ou créer l'objet Audio
    let audio = audioCache[soundName];
    if (!audio) {
      audio = new Audio(SOUNDS[soundName]);
      audioCache[soundName] = audio;
    }

    // Réinitialiser au début si le son est déjà en cours
    audio.currentTime = 0;
    audio.volume = Math.max(0, Math.min(1, volume));

    // Jouer le son (catch pour gérer les restrictions d'autoplay)
    audio.play().catch(() => {
      // Silencieux si autoplay bloqué (l'utilisateur n'a pas encore interagi)
    });
  } catch {
    // Ignorer les erreurs de son
  }
};

export { SOUNDS };
