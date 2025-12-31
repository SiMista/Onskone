/**
 * Sound Manager - Gestion robuste des sons avec Web Audio API
 *
 * Utilise Web Audio API pour une latence minimale sur mobile.
 * Précharge les sons au premier clic utilisateur pour éviter les délais.
 */

const SOUNDS = {
  questionSelection: '/sounds/question_selection_phase.mp3',
  answering: '/sounds/answering_phase.mp3',
} as const;

type SoundName = keyof typeof SOUNDS;

class SoundManager {
  private audioContext: AudioContext | null = null;
  private audioBuffers: Map<SoundName, AudioBuffer> = new Map();
  private isInitialized = false;
  private isLoading = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialise le contexte audio et précharge tous les sons.
   * Doit être appelé après une interaction utilisateur (click/touch).
   */
  async init(): Promise<void> {
    // Éviter les initialisations multiples
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    if (this.isLoading || this.isInitialized) return;
    this.isLoading = true;

    try {
      // Créer le contexte audio (avec fallback pour Safari)
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('Web Audio API not supported');
        return;
      }

      this.audioContext = new AudioContextClass();

      // Sur iOS/Safari, le contexte peut être en état "suspended"
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Précharger tous les sons en parallèle
      const loadPromises = (Object.keys(SOUNDS) as SoundName[]).map(
        soundName => this.loadSound(soundName)
      );
      await Promise.all(loadPromises);

      this.isInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize SoundManager:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Charge un fichier audio et le stocke en buffer
   */
  private async loadSound(soundName: SoundName): Promise<void> {
    if (!this.audioContext) return;

    try {
      const response = await fetch(SOUNDS[soundName]);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.audioBuffers.set(soundName, audioBuffer);
    } catch (error) {
      console.warn(`Failed to load sound: ${soundName}`, error);
    }
  }

  /**
   * Joue un son par son nom
   */
  play(soundName: SoundName, volume: number = 0.5): void {
    // Si pas encore initialisé, tenter d'initialiser et jouer en fallback
    if (!this.isInitialized || !this.audioContext) {
      this.playFallback(soundName, volume);
      // Tenter l'initialisation pour les prochains sons
      this.init();
      return;
    }

    const buffer = this.audioBuffers.get(soundName);
    if (!buffer) {
      this.playFallback(soundName, volume);
      return;
    }

    try {
      // Reprendre le contexte si suspendu (peut arriver après inactivité)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // Créer les nodes audio
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = buffer;
      gainNode.gain.value = Math.max(0, Math.min(1, volume));

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);
    } catch (error) {
      // Fallback en cas d'erreur
      this.playFallback(soundName, volume);
    }
  }

  /**
   * Fallback avec HTMLAudioElement si Web Audio API indisponible
   */
  private playFallback(soundName: SoundName, volume: number): void {
    try {
      const audio = new Audio(SOUNDS[soundName]);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.play().catch(() => {
        // Silencieux si autoplay bloqué
      });
    } catch {
      // Ignorer les erreurs
    }
  }
}

// Instance singleton
const soundManager = new SoundManager();

/**
 * Initialise le système de sons. À appeler au premier clic/touch utilisateur.
 */
export const initSounds = (): Promise<void> => soundManager.init();

/**
 * Joue un son par son nom
 */
export const playSound = (soundName: SoundName, volume: number = 0.5): void => {
  soundManager.play(soundName, volume);
};

export { SOUNDS };
export type { SoundName };
