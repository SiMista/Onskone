import { useEffect, useRef } from 'react';
import socket from '../utils/socket';

/**
 * Démarre un timer côté serveur après un petit délai, une seule fois,
 * uniquement si le composant est piloté par le pilier.
 *
 * Le délai (500ms par défaut) sert à laisser le temps au DOM de monter
 * et au timer client (HourglassTimer) de s'enregistrer avant que le
 * `timerStarted` arrive en retour.
 *
 * Garantie : un seul `startTimer` par montage (idempotent via ref).
 */
export function useStartTimerDelayed(
  isLeader: boolean,
  lobbyCode: string,
  duration: number,
  delayMs = 500
): void {
  const startedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (isLeader && !startedRef.current) {
        startedRef.current = true;
        socket.emit('startTimer', { lobbyCode, duration });
      }
    }, delayMs);
    return () => clearTimeout(t);
  }, [isLeader, lobbyCode, duration, delayMs]);
}
