import { useEffect, useRef, useState } from 'react';

interface UseRafProgressOptions {
  /** Durée de référence (secondes) pour calculer le pourcentage restant. */
  duration: number;
  /**
   * Timestamp epoch (ms) de fin de timer fourni par le serveur. Quand non-null,
   * la progression suit l'horloge réelle ; quand null, on retombe sur le
   * fallback `timeLeft` (compte à rebours local en secondes).
   */
  endTime: number | null;
  /** Temps restant local (secondes), utilisé tant que `endTime` est null. */
  timeLeft: number;
  /**
   * Quand `false`, la boucle requestAnimationFrame est suspendue (aucune frame
   * n'est planifiée). Utile pour un timer monté uniquement pour sa logique
   * d'expiration mais masqué (`hidden`) : on évite un re-render à 60fps.
   * Défaut : `true`.
   */
  active?: boolean;
  /**
   * Quand `false`, la valeur `progress` retournée n'est PLUS mise à jour à chaque
   * frame : `setProgress` n'est jamais appelé, donc le consommateur ne se re-render
   * pas à 60fps. La RAF continue de tourner pour rafraîchir `remainingMs`/`remainingSec`
   * (au passage de chaque seconde uniquement). À utiliser par un consommateur qui
   * n'a besoin que de la seconde entière (ex. HourglassTimer, dont le sable est animé
   * en CSS et piloté par la seconde). Défaut : `true`.
   */
  emitProgress?: boolean;
}

interface RafProgress {
  /** Pourcentage de temps restant, borné [0, 100]. */
  progress: number;
  /** Millisecondes restantes (arrondi sup. en secondes via `remainingSec`). */
  remainingMs: number;
  /** Secondes restantes, arrondies au plafond (ceil). */
  remainingSec: number;
}

/**
 * Boucle requestAnimationFrame partagée entre Timer et HourglassTimer : calcule
 * en continu le pourcentage de temps restant (et les ms/sec associées) à partir
 * du `endTime` serveur, avec repli sur un compte à rebours local quand le timer
 * n'a pas encore été synchronisé.
 *
 * La RAF est annulée au démontage et relancée à chaque changement de
 * duration/endTime/timeLeft (mêmes dépendances que l'effet d'origine).
 */
export function useRafProgress({ duration, endTime, timeLeft, active = true, emitProgress = true }: UseRafProgressOptions): RafProgress {
  // `progress` change à chaque frame (animation continue). `seconds` (ms + sec
  // entière) ne change qu'au passage d'une seconde, ce qui permet aux consommateurs
  // n'observant que la seconde de ne pas re-render à chaque frame.
  const [progress, setProgress] = useState(100);
  const [seconds, setSeconds] = useState<{ remainingMs: number; remainingSec: number }>(() => ({
    remainingMs: duration * 1000,
    remainingSec: duration,
  }));
  const rafRef = useRef<number | null>(null);
  // `emitProgress` est effectivement constant par consommateur, mais on le lit via
  // une ref (rafraîchie à chaque render) plutôt que via les deps de l'effet : ça
  // évite de relancer la boucle RAF si la valeur changeait, tout en gardant les
  // dépendances de l'effet identiques à l'origine.
  const emitProgressRef = useRef(emitProgress);
  emitProgressRef.current = emitProgress;

  useEffect(() => {
    // Suspendu : ne rien planifier (un pending éventuel a déjà été annulé par le
    // cleanup de la frame précédente). Évite le re-render à 60fps d'un timer masqué.
    if (!active) return;
    const tick = () => {
      const remainingMs = endTime === null
        ? timeLeft * 1000
        : Math.max(0, endTime - Date.now());
      // Ne pousser `progress` (et donc re-render à chaque frame) que si le
      // consommateur en a besoin ; sinon la RAF ne sert qu'à rafraîchir la seconde.
      if (emitProgressRef.current) {
        const progress = Math.max(0, Math.min(100, (remainingMs / (duration * 1000)) * 100));
        setProgress(progress);
      }
      const remainingSec = Math.ceil(remainingMs / 1000);
      // Bail-out : ne pousser un nouvel objet `seconds` que si la seconde entière
      // change réellement (évite un re-render par frame des consommateurs de sec).
      setSeconds(prev => (prev.remainingSec === remainingSec ? prev : { remainingMs, remainingSec }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [endTime, duration, timeLeft, active]);

  return { progress, remainingMs: seconds.remainingMs, remainingSec: seconds.remainingSec };
}
