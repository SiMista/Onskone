import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { Dictionary } from '../i18n/dictionary';
import { useToast } from '../components/Toast';
import { useSocketEvent } from './useSocketEvent';
import { clearLastGame } from '../utils/playerHelpers';

/**
 * Gère les deux events serveur qui éjectent le joueur vers l'accueil :
 *  - `kickedFromLobby` : expulsé par l'hôte (toast nominatif si dispo) ;
 *  - `lobbyClosed` : salon fermé (inactivité).
 *
 * Logique identique entre `Lobby` et `Game`, d'où l'extraction.
 */
export function useLobbyExitEvents(navigate: NavigateFunction, t: Dictionary): void {
  const showToast = useToast();

  const handleKickedFromLobby = useCallback((data?: { hostName?: string }) => {
    const message = data?.hostName
      ? t.lobby.toasts.kicked(data.hostName)
      : t.lobby.toasts.kickedAnon;
    showToast(message, 'error', 4500);
    clearLastGame(); // expulsé : ne pas proposer de revenir dans cette partie
    navigate('/');
  }, [navigate, showToast, t]);

  const handleLobbyClosed = useCallback(() => {
    showToast(t.lobby.toasts.closedInactive, 'error', 4500);
    clearLastGame();
    navigate('/');
  }, [navigate, showToast, t]);

  useSocketEvent('kickedFromLobby', handleKickedFromLobby);
  useSocketEvent('lobbyClosed', handleLobbyClosed);
}
