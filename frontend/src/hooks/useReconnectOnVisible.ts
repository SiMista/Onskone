import { useEffect, useRef } from 'react';
import socket from '../utils/socket';

/**
 * Sur retour de l'app au premier plan (visibilitychange → visible) :
 *  - si le socket est connecté, appelle `action()` immédiatement
 *  - sinon enregistre un `once('connect', action)` et relance la connexion
 *
 * Aussi enregistre `action` comme handler `connect` permanent pour gérer
 * les pertes de connexion en cours de session.
 *
 * Garantit le cleanup propre de tous les listeners (y compris le `once`
 * en attente) au démontage du composant, pour éviter d'appeler `action`
 * après l'unmount.
 */
export function useReconnectOnVisible(action: () => void): void {
  // On garde la dernière `action` dans une ref pour ne pas re-souscrire
  // à chaque render si le caller ne mémoïse pas son callback.
  const actionRef = useRef(action);
  useEffect(() => { actionRef.current = action; }, [action]);

  useEffect(() => {
    const call = () => actionRef.current();

    // Écouter les reconnexions socket en continu
    socket.on('connect', call);

    // Référence vers un éventuel once('connect') en attente (visibilitychange)
    let pendingOnce: (() => void) | null = null;
    let pendingActive = false;

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (socket.connected) {
        call();
        return;
      }
      if (pendingActive) return; // déjà un once en attente
      pendingActive = true;
      pendingOnce = () => {
        pendingActive = false;
        pendingOnce = null;
        call();
      };
      socket.once('connect', pendingOnce);
      socket.connect();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      socket.off('connect', call);
      if (pendingOnce) socket.off('connect', pendingOnce);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
