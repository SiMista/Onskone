import { useEffect } from 'react';
import { isStudioFrame } from '../utils/studioStorage';

/**
 * Avertit l'utilisateur avant qu'il ne quitte la page (rechargement / fermeture).
 * @param enabled - Active ou non l'avertissement
 */
export function useLeavePrompt(
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;
    // Studio : ne jamais bloquer les rechargements/navigations dans une iframe studio.
    if (isStudioFrame) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Les navigateurs modernes ignorent les messages custom et affichent un
      // prompt générique : il suffit de fixer returnValue pour le déclencher.
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);
}