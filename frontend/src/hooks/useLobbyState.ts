import { useCallback, useEffect, useRef, useState } from 'react';
import socket from '../utils/socket';
import {
  DecksCatalog,
  DecksCatalogWithMeta,
  SelectedDecks,
  GAME_CONSTANTS,
} from '@onskone/shared';
import type { GameMode, GameSpeed, Locale } from '@onskone/shared';
import type { ServerToClientEvents } from '@onskone/shared';
import { useSocketEvent } from './useSocketEvent';

interface UseLobbyStateResult {
  decksCatalog: DecksCatalog;
  decksCatalogMeta: DecksCatalogWithMeta;
  selectedDecks: SelectedDecks;
  gameMode: GameMode | null;
  guessMyAnswerMode: boolean;
  gameSpeed: GameSpeed;
  excludedLeaderIds: string[];
  /** Langue des questions du salon (choisie par l'hôte à la création). */
  contentLocale: Locale | null;
  onGuessMyAnswerModeChange: (next: boolean) => void;
  onGameSpeedChange: (next: GameSpeed) => void;
  onExcludedLeadersChange: (next: string[]) => void;
  onSelectedDecksChange: (next: SelectedDecks) => void;
  /** Envoie tout de suite les réglages encore en debounce (à appeler avant startGame). */
  flushPendingSettings: () => void;
}

/**
 * État des réglages du lobby (catalogue de thèmes, sélection, mode "Devine ma
 * réponse", rythme de jeu, joueurs exclus du rôle de pilier) et leur
 * synchronisation socket.
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
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [guessMyAnswerMode, setGuessMyAnswerMode] = useState<boolean>(false);
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>(GAME_CONSTANTS.GAME_SPEED_DEFAULT);
  const [excludedLeaderIds, setExcludedLeaderIds] = useState<string[]>([]);
  const [contentLocale, setContentLocale] = useState<Locale | null>(null);

  // Payloads typés via le contrat serveur (ServerToClientEvents) plutôt qu'inline :
  // ajouter/retirer un champ côté serveur force la mise à jour ici (sinon erreur de typecheck).
  const handleLobbyDecksState = useCallback((data: Parameters<ServerToClientEvents['lobbyDecksState']>[0]) => {
    setDecksCatalog(data.catalog);
    setDecksCatalogMeta(data.catalogWithMeta);
    setSelectedDecks(data.selected);
    setGameMode(data.gameMode);
    setGuessMyAnswerMode(data.guessMyAnswerMode);
    setGameSpeed(data.gameSpeed);
    // `?? []` : serveur d'avant l'exclusion de piliers.
    setExcludedLeaderIds(data.excludedLeaderIds ?? []);
    setContentLocale(data.locale);
  }, []);

  const handleGuessMyAnswerModeUpdated = useCallback((data: Parameters<ServerToClientEvents['guessMyAnswerModeUpdated']>[0]) => {
    setGuessMyAnswerMode(data.guessMyAnswerMode);
  }, []);

  const handleGameSpeedUpdated = useCallback((data: Parameters<ServerToClientEvents['gameSpeedUpdated']>[0]) => {
    setGameSpeed(data.gameSpeed);
  }, []);

  const settingsEmitTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Emit en attente par clé, pour pouvoir le déclencher sans attendre (flush).
  const settingsEmitFns = useRef<Record<string, () => void>>({});

  const queueSettingEmit = useCallback((key: string, fn: () => void, delay = 150) => {
    const timers = settingsEmitTimers.current;
    if (timers[key]) clearTimeout(timers[key]);
    settingsEmitFns.current[key] = fn;
    timers[key] = setTimeout(() => {
      delete timers[key];
      delete settingsEmitFns.current[key];
      fn();
    }, delay);
  }, []);

  // Un réglage touché juste avant "Démarrer" partirait APRÈS startGame (debounce),
  // voire jamais (timers vidés au démontage du lobby) : on l'envoie tout de suite.
  // Socket.IO garantit l'ordre des emits sur un même socket.
  const flushPendingSettings = useCallback(() => {
    const fns = settingsEmitFns.current;
    Object.values(settingsEmitTimers.current).forEach(clearTimeout);
    settingsEmitTimers.current = {};
    settingsEmitFns.current = {};
    Object.values(fns).forEach(fn => fn());
  }, []);

  // Vide les timers de debounce en attente au démontage ET à tout changement de
  // lobbyCode : sinon un emit debouncé en vol partirait avec l'ancien lobbyCode capturé.
  useEffect(() => {
    return () => {
      const timers = settingsEmitTimers.current;
      Object.values(timers).forEach(clearTimeout);
      settingsEmitTimers.current = {};
      settingsEmitFns.current = {};
    };
  }, [lobbyCode]);

  const onGuessMyAnswerModeChange = useCallback((next: boolean) => {
    setGuessMyAnswerMode(next);
    if (!lobbyCode) return;
    queueSettingEmit('guessMyAnswerMode', () => {
      socket.emit('updateGuessMyAnswerMode', { lobbyCode, guessMyAnswerMode: next });
    });
  }, [lobbyCode, queueSettingEmit]);

  const onGameSpeedChange = useCallback((next: GameSpeed) => {
    setGameSpeed(next);
    if (!lobbyCode) return;
    queueSettingEmit('gameSpeed', () => {
      socket.emit('updateGameSpeed', { lobbyCode, gameSpeed: next });
    });
  }, [lobbyCode, queueSettingEmit]);

  const onExcludedLeadersChange = useCallback((next: string[]) => {
    setExcludedLeaderIds(next);
    if (!lobbyCode) return;
    queueSettingEmit('excludedLeaderIds', () => {
      socket.emit('updateExcludedLeaders', { lobbyCode, excludedLeaderIds: next });
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
  useSocketEvent('gameSpeedUpdated', handleGameSpeedUpdated);

  return {
    decksCatalog,
    decksCatalogMeta,
    selectedDecks,
    gameMode,
    guessMyAnswerMode,
    gameSpeed,
    excludedLeaderIds,
    contentLocale,
    onGuessMyAnswerModeChange,
    onGameSpeedChange,
    onExcludedLeadersChange,
    onSelectedDecksChange,
    flushPendingSettings,
  };
}
