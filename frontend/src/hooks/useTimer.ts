import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerOptions {
  onExpire?: () => void;
  autoStart?: boolean;
}

/**
 * Custom hook for countdown timer functionality
 * @param initialDuration - Initial duration in seconds
 * @param options - Configuration options
 * @returns Timer state and control functions
 */
export function useTimer(initialDuration: number, options: UseTimerOptions = {}) {
  const { onExpire, autoStart = false } = options;

  const [timeLeft, setTimeLeft] = useState(initialDuration);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false); // Protection contre les doubles appels

  // Keep onExpire ref up to date
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Reset time when initial duration changes
  useEffect(() => {
    setTimeLeft(initialDuration);
    hasExpiredRef.current = false; // Réinitialiser le flag d'expiration
  }, [initialDuration]);

  // Timer logic
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (timeLeft <= 0) {
      setIsRunning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Protection contre les doubles appels
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsRunning(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // Protection contre les doubles appels
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            onExpireRef.current?.();
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, timeLeft]);

  const start = useCallback(() => {
    hasExpiredRef.current = false;
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback((newDuration?: number) => {
    setTimeLeft(newDuration ?? initialDuration);
    setIsRunning(false);
    hasExpiredRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [initialDuration]);

  const restart = useCallback((newDuration?: number) => {
    setTimeLeft(newDuration ?? initialDuration);
    setIsRunning(true);
    hasExpiredRef.current = false;
  }, [initialDuration]);

  return {
    timeLeft,
    isRunning,
    start,
    stop,
    reset,
    restart,
  };
}