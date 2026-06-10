import { Game } from '../models/Game.js';
import type { ILobby } from '@onskone/shared';
import { resolveLobbyPool } from '../data/questionsRepository.js';

/**
 * Instancie et démarre une partie pour un lobby donné, à partir du pool de cartes
 * résolu par le dépôt de questions (langue + sélection de decks du lobby).
 */
export const createGame = (lobby: ILobby): Game => {
    const filtered = resolveLobbyPool(lobby);
    const game = new Game(lobby, filtered);
    game.start();
    return game;
};
