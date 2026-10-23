import { useState, useEffect, useRef } from 'react';
import socket from '../utils/socket';
import { localTimerEnd } from '../utils/timerClock';
import { RoundPhase, type TimerStartedPayload, type TimerStatePayload } from '@onskone/shared';

interface UseSyncedTimerOptions {
  onExpire?: () => void;
  phase?: RoundPhase; // Phase pour laquelle ce timer est actif
  lobbyCode?: string; // Code du lobby pour demander l'état du timer
}

/**
 * Hook pour un timer synchronisé avec le serveur
 * Tous les clients calculent le temps restant basé sur le timestamp serveur
 */
export function useSyncedTimer(defaultDuration: number, options: UseSyncedTimerOptions = {}) {
  const { onExpire, phase, lobbyCode } = options;

  const [timeLeft, setTimeLeft] = useState(defaultDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [serverDuration, setServerDuration] = useState<number | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  // Garder la ref onExpire à jour
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Écouter l'événement timerStarted du serveur
  useEffect(() => {
    const handleTimerStarted = (data: TimerStartedPayload) => {
      // Si on filtre par phase, vérifier que c'est la bonne
      if (phase && data.phase !== phase) {
        return;
      }

      // Échéance sur l'horloge LOCALE, déduite du temps restant côté serveur : la
      // montre du client (PC mal réglé) ne doit pas décaler le compte à rebours.
      const serverEndTime = localTimerEnd(data);
      setEndTime(serverEndTime);
      setServerDuration(data.duration);
      setIsRunning(true);
      hasExpiredRef.current = false;

      // Calculer le temps restant immédiatement
      const remaining = Math.max(0, Math.ceil((serverEndTime - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    // Gérer aussi timerState pour la récupération d'état
    const handleTimerState = (data: TimerStatePayload) => {
      if (!data) return;
      // Réutiliser la même logique que timerStarted
      handleTimerStarted(data);
    };

    socket.on('timerStarted', handleTimerStarted);
    socket.on('timerState', handleTimerState);

    // Rattrapage d'un `timerStarted` manqué (montage tardif, coupure socket au début
    // de la phase, Edge) : on demande l'état après un court délai, puis on retente
    // tant qu'aucun timer n'a jamais démarré. Une seule demande suffisait à laisser
    // le sablier plein toute la phase si sa réponse était `null` (rate limit, socket
    // en reconnexion). Une fois le timer reçu (puis expiré), on ne redemande plus.
    const needsCatchUp = !isRunning && endTime === null && !!phase && !!lobbyCode;
    const requestState = () => {
      if (needsCatchUp) socket.emit('requestTimerState', { lobbyCode, phase });
    };
    const requestTimeout = setTimeout(requestState, 100);
    const retryInterval = needsCatchUp ? setInterval(requestState, 2000) : null;

    return () => {
      socket.off('timerStarted', handleTimerStarted);
      socket.off('timerState', handleTimerState);
      clearTimeout(requestTimeout);
      if (retryInterval) clearInterval(retryInterval);
    };
  }, [phase, isRunning, endTime, lobbyCode]);

  // Mettre à jour le countdown basé sur endTime
  useEffect(() => {
    if (!isRunning || endTime === null) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Fonction pour calculer et mettre à jour le temps restant
    const updateTimeLeft = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setIsRunning(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true;
          onExpireRef.current?.();
        }
      }
    };

    // Mise à jour immédiate
    updateTimeLeft();

    // Puis toutes les secondes
    intervalRef.current = setInterval(updateTimeLeft, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, endTime]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return {
    timeLeft,
    endTime,
    serverDuration,
  };
}
