import { useState, useEffect } from 'react';
import { IPlayer } from '@onskone/shared';

/**
 * Custom hook to manage current player state with localStorage persistence
 * @param lobbyCode - Optional lobby code for namespaced storage
 * @returns [currentPlayer, setCurrentPlayer, clearCurrentPlayer]
 */
export function useCurrentPlayer(lobbyCode?: string) {
  const storageKey = lobbyCode ? `playerName_${lobbyCode}` : 'currentPlayer';

  const [currentPlayer, setCurrentPlayer] = useState<IPlayer | null>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to parse stored player data:', error);
      localStorage.removeItem(storageKey);
      return null;
    }
  });

  // Auto-save to localStorage when player changes
  useEffect(() => {
    if (currentPlayer) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(currentPlayer));
      } catch (error) {
        console.error('Failed to save player data:', error);
      }
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [currentPlayer, storageKey]);

  const clearCurrentPlayer = () => {
    setCurrentPlayer(null);
    localStorage.removeItem(storageKey);
  };

  return [currentPlayer, setCurrentPlayer, clearCurrentPlayer] as const;
}