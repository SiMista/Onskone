import { useEffect, useState } from 'react';
import { isStudioFrame } from './studioStorage';

// Simulateur de crash de rendu pour le Studio : permet de voir en vrai le
// comportement des SectionErrorBoundary / AppErrorBoundary. Inerte hors iframe
// Studio. Le parent envoie `{type: 'studio:crash', target}` ; la sonde de la
// cible lève une exception PENDANT son rendu (seul cas qu'un boundary attrape).

export type StudioCrashTarget = 'phase' | 'timer' | 'global';

/** Cible armée -> clé de l'écran visé. Une sonde ne plante que pour SA clé : un
 *  changement de manche/phase (ou « Réessayer », via clearStudioCrash) désarme. */
const armed = new Map<StudioCrashTarget, string>();

export const clearStudioCrash = (): void => armed.clear();

export function useStudioCrash(target: StudioCrashTarget, crashKey: string): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isStudioFrame) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      if (!data || typeof data !== 'object' || data.type !== 'studio:crash' || data.target !== target) return;
      armed.set(target, crashKey);
      setTick((n) => n + 1);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [target, crashKey]);

  if (isStudioFrame && armed.get(target) === crashKey) {
    throw new Error(`[studio] crash simulé (${target})`);
  }
}

export const StudioCrashProbe = ({ target, crashKey }: { target: StudioCrashTarget; crashKey: string }) => {
  useStudioCrash(target, crashKey);
  return null;
};
