import { useCallback, useEffect, useRef, useState } from 'react';
import socket from '../utils/socket';
import {
  DecksCatalog,
  DecksCatalogWithMeta,
  SelectedDecks,
  GAME_CONSTANTS,
} from '@onskone/shared';
import type { ServerToClientEvents } from '@onskone/shared';
import { useSocketEvent } from './useSocketEvent';

interface UseLobbyStateResult {
  decksCatalog: DecksCatalog;
  decksCatalogMeta: DecksCatalogWithMeta;
  selectedDecks: SelectedDecks;
  guessMyAnswerMode: boolean;
  timeMultiplier: number;
  onGuessMyAnswerModeChange: (next: boolean) => void;
  onTimeMultiplierChange: (next: number) => void;
  onSelectedDecksChange: (next: SelectedDecks) => void;
}

/**
 * État des réglages du lobby (catalogue de thèmes, sélection, mode "Devine ma
 * réponse", rythme de jeu) et leur synchronisation socket.
 *
 * Les changements sont appliqués localement immédiatement (optimiste) puis
 * émis au serveur via un petit debounce par clé (`queueSettingEmit`) pour ne
 * pas spammer le réseau quand l'hôte drague un slider ou coche/décoche vite.
 * Les events serveur (`lobbyDecksState`, `*Updated`) réconcilient l'état.
 */
export function useLobbyState(lobbyCode: string | undefined): UseLobbyStateResult {
  const [decksCatalog, setDecksCatalog] = useState<DecksCatalog>({});
  const [decksCatalogMeta, setDecksCatalogMeta] = useState<DecksCatalogWithMeta>({});
  const [selectedDecks, setSelectedDecks] = useState<SelectedDecks>({});
  const [guessMyAnswerMode, setGuessMyAnswerMode] = useState<boolean>(false);
  const [timeMultiplier, setTimeMultiplier] = useState<number>(GAME_CONSTANTS.TIME_MULTIPLIER_DEFAULT);

  // Payloads typés via le contrat serveur (ServerToClientEvents) plutôt qu'inline :
  // ajouter/retirer un champ côté serveur force la mise à jour ici (sinon erreur de typecheck).
  const handleLobbyDecksState = useCallback((data: Parameters<ServerToClientEvents['lobbyDecksState']>[0]) => {
    setDecksCatalog(data.catalog);
    setDecksCatalogMeta(data.catalogWithMeta);
    setSelectedDecks(data.selected);
    setGuessMyAnswerMode(data.guessMyAnswerMode);
    setTimeMultiplier(data.timeMultiplier);
  }, []);

  const handleGuessMyAnswerModeUpdated = useCallback((data: Parameters<ServerToClientEvents['guessMyAnswerModeUpdated']>[0]) => {
    setGuessMyAnswerMode(data.guessMyAnswerMode);
  }, []);

  const handleTimeMultiplierUpdated = useCallback((data: Parameters<ServerToClientEvents['timeMultiplierUpdated']>[0]) => {
    setTimeMultiplier(data.timeMultiplier);
  }, []);

  const settingsEmitTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const queueSettingEmit = useCallback((key: string, fn: () => void, delay = 150) => {
    const timers = settingsEmitTimers.current;
    if (timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(() => {
      delete timers[key];
      fn();
    }, delay);
  }, []);

  // Vide les timers de debounce en attente au démontage ET à tout changement de
  // lobbyCode : sinon un emit debouncé en vol partirait avec l'ancien lobbyCode capturé.
  useEffect(() => {
    return () => {
      const timers = settingsEmitTimers.current;
      Object.values(timers).forEach(clearTimeout);
      settingsEmitTimers.current = {};
    };
  }, [lobbyCode]);

  const onGuessMyAnswerModeChange = useCallback((next: boolean) => {
    setGuessMyAnswerMode(next);
    if (!lobbyCode) return;
    queueSettingEmit('guessMyAnswerMode', () => {
      socket.emit('updateGuessMyAnswerMode', { lobbyCode, guessMyAnswerMode: next });
    });
  }, [lobbyCode, queueSettingEmit]);

  const onTimeMultiplierChange = useCallback((next: number) => {
    setTimeMultiplier(next);
    if (!lobbyCode) return;
    queueSettingEmit('timeMultiplier', () => {
      socket.emit('updateTimeMultiplier', { lobbyCode, timeMultiplier: next });
    });
  }, [lobbyCode, queueSettingEmit]);

  const onSelectedDecksChange = useCallback((next: SelectedDecks) => {
    setSelectedDecks(next);
    if (!lobbyCode) return;
    queueSettingEmit('selectedDecks', () => {
      socket.emit('updateSelectedDecks', { lobbyCode, selected: next });
    });
  }, [lobbyCode, queueSettingEmit]);

  useSocketEvent('lobbyDecksState', handleLobbyDecksState);
  useSocketEvent('guessMyAnswerModeUpdated', handleGuessMyAnswerModeUpdated);
  useSocketEvent('timeMultiplierUpdated', handleTimeMultiplierUpdated);

  return {
    decksCatalog,
    decksCatalogMeta,
    selectedDecks,
    guessMyAnswerMode,
    timeMultiplier,
    onGuessMyAnswerModeChange,
    onTimeMultiplierChange,
    onSelectedDecksChange,
  };
}
