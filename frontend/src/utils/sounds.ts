/**
 * Sound Manager - Gestion simple et robuste des sons
 *
 * Utilise HTMLAudioElement avec préchargement pour une meilleure compatibilité.
 */

const SOUNDS = {
  questionSelection: '/sounds/question_selection_phase.mp3',
  answering: '/sounds/answering_phase.mp3',
} as const;

type SoundName = keyof typeof SOUNDS;

class SoundManager {
  private audioElements: Map<SoundName, HTMLAudioElement> = new Map();
  private isInitialized = false;

  /**
   * Initialise et précharge tous les sons.
   * Doit être appelé après une interaction utilisateur (click/touch).
   */
  init(): void {
    if (this.isInitialized) return;

    // Précharger tous les sons
    (Object.keys(SOUNDS) as SoundName[]).forEach(soundName => {
      const audio = new Audio(SOUNDS[soundName]);
      audio.preload = 'auto';
      audio.load(); // Précharge sans jouer
      this.audioElements.set(soundName, audio);
    });

    this.isInitialized = true;
  }

  /**
   * Joue un son par son nom
   */
  play(soundName: SoundName, volume: number = 0.5): void {
    // Tenter d'initialiser si pas encore fait
    if (!this.isInitialized) {
      this.init();
    }

    const audio = this.audioElements.get(soundName);

    if (audio) {
      // Utiliser l'élément préchargé
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.play().catch(() => {
        // Silencieux si autoplay bloqué
      });
    } else {
      // Fallback: créer un nouvel élément
      try {
        const newAudio = new Audio(SOUNDS[soundName]);
        newAudio.volume = Math.max(0, Math.min(1, volume));
        newAudio.play().catch(() => {
          // Silencieux si autoplay bloqué
        });
      } catch {
        // Ignorer les erreurs
      }
    }
  }
}

// Instance singleton
const soundManager = new SoundManager();

/**
 * Initialise le système de sons. À appeler au premier clic/touch utilisateur.
 */
export const initSounds = (): void => soundManager.init();

/**
 * Joue un son par son nom
 */
export const playSound = (soundName: SoundName, volume: number = 0.5): void => {
  soundManager.play(soundName, volume);
};

export { SOUNDS };
export type { SoundName };
