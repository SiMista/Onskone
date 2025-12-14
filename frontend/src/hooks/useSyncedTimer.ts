import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../utils/socket';
import { RoundPhase } from '@onskone/shared';

interface UseSyncedTimerOptions {
  onExpire?: () => void;
  phase?: RoundPhase; // Phase pour laquelle ce timer est actif
}

/**
 * Hook pour un timer synchronisé avec le serveur
 * Tous les clients calculent le temps restant basé sur le timestamp serveur
 */
export function useSyncedTimer(defaultDuration: number, options: UseSyncedTimerOptions = {}) {
  const { onExpire, phase } = options;

  const [timeLeft, setTimeLeft] = useState(defaultDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  // Keep onExpire ref up to date
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Écouter l'événement timerStarted du serveur
  useEffect(() => {
    const handleTimerStarted = (data: { phase: RoundPhase; duration: number; startedAt: number }) => {
      // Si on filtre par phase, vérifier que c'est la bonne
      if (phase && data.phase !== phase) {
        return;
      }

      // Calculer le temps de fin basé sur le timestamp serveur
      const serverEndTime = data.startedAt + data.duration * 1000;
      setEndTime(serverEndTime);
      setIsRunning(true);
      hasExpiredRef.current = false;

      // Calculer le temps restant immédiatement
      const remaining = Math.max(0, Math.ceil((serverEndTime - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    socket.on('timerStarted', handleTimerStarted);

    return () => {
      socket.off('timerStarted', handleTimerStarted);
    };
  }, [phase]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const reset = useCallback(() => {
    setTimeLeft(defaultDuration);
    setIsRunning(false);
    setEndTime(null);
    hasExpiredRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [defaultDuration]);

  return {
    timeLeft,
    isRunning,
    reset,
  };
}
