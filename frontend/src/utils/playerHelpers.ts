import { IPlayer } from '@onskone/shared';
import { studioStorage } from './studioStorage';

/**
 * Validates that an object has the required IPlayer fields
 * Returns the player if valid, null otherwise
 */
function parseStoredPlayer(jsonString: string | null): IPlayer | null {
  if (!jsonString) return null;

  try {
    const parsed = JSON.parse(jsonString);

    // Validate required fields.
    // socketId n'est PLUS exigé : le serveur l'omet désormais des payloads joueurs
    // (info-hygiène). On ne le stocke ni ne le lit plus.
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.isHost !== 'boolean' ||
      typeof parsed.isActive !== 'boolean' ||
      typeof parsed.avatarId !== 'number'
    ) {
      return null;
    }

    // Return validated player
    return {
      id: parsed.id,
      name: parsed.name,
      isHost: parsed.isHost,
      isActive: parsed.isActive,
      avatarId: parsed.avatarId,
      score: typeof parsed.score === 'number' ? parsed.score : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves and validates the current player from localStorage
 * Cleans up invalid data automatically
 */
export function getCurrentPlayerFromStorage(): IPlayer | null {
  try {
    const stored = studioStorage.getItem('currentPlayer');
    const player = parseStoredPlayer(stored);

    if (!player && stored) {
      // Invalid data - clean it up
      studioStorage.removeItem('currentPlayer');
    }

    return player;
  } catch {
    return null;
  }
}

/**
 * Clé de stockage du secret de reconnexion. Namespacée par lobby (comme
 * `playerName_${lobbyCode}`) pour qu'ouvrir un autre salon dans le même onglet
 * n'écrase pas le token du salon précédent — sinon le retour au 1er salon casserait
 * la reconnexion. Persistée via studioStorage (namespacée par slot Studio).
 * Le token n'est PAS un champ d'IPlayer : à ne pas confondre avec les données joueur diffusées.
 */
const reconnectTokenKey = (lobbyCode: string) => `reconnectToken_${lobbyCode}`;

/**
 * Persiste le secret de reconnexion reçu via lobbyCreated/joinedLobby (émis au seul
 * propriétaire). Renvoyé ensuite lors des reconnexions (joinLobby / getGameState).
 */
export function storeReconnectToken(lobbyCode: string | undefined, token: string | null | undefined): void {
  try {
    if (lobbyCode && token) {
      studioStorage.setItem(reconnectTokenKey(lobbyCode), token);
    }
  } catch {
    /* stockage indisponible : la reconnexion retombera sur la garde de liveness */
  }
}

/**
 * Lit le secret de reconnexion stocké pour ce lobby (ou undefined). À joindre aux
 * emits de reconnexion pour prouver l'identité sans dépendre du nom/UUID publics.
 */
export function getReconnectToken(lobbyCode: string | undefined): string | undefined {
  try {
    if (!lobbyCode) return undefined;
    return studioStorage.getItem(reconnectTokenKey(lobbyCode)) ?? undefined;
  } catch {
    return undefined;
  }
}

// --- Partie en cours (reprise après fermeture de l'app) ------------------------
// Quand l'OS tue l'app en arrière-plan, la WebView redémarre sur `/` et la route
// `/game/:code` est perdue. On mémorise donc la partie en cours pour proposer d'y
// revenir depuis l'accueil (cf. Home). Effacée en fin de partie, à l'expulsion ou
// à la fermeture du salon, et périmée après LAST_GAME_TTL_MS sans rafraîchissement
// (le serveur ne garde de toute façon pas un salon plus de 2 h sans activité).
const LAST_GAME_KEY = 'onskone_last_game';
const LAST_GAME_TTL_MS = 2 * 60 * 60 * 1000;

export interface LastGame {
  lobbyCode: string;
  playerId: string;
  /** Date du dernier rafraîchissement (ms epoch). */
  at: number;
}

export function storeLastGame(lobbyCode: string, playerId: string): void {
  try {
    const entry: LastGame = { lobbyCode, playerId, at: Date.now() };
    studioStorage.setItem(LAST_GAME_KEY, JSON.stringify(entry));
  } catch {
    /* silent */
  }
}

/** Partie mémorisée encore fraîche, ou null (une entrée périmée est purgée). */
export function getLastGame(): LastGame | null {
  try {
    const raw = studioStorage.getItem(LAST_GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastGame>;
    if (
      typeof parsed.lobbyCode !== 'string'
      || typeof parsed.playerId !== 'string'
      || typeof parsed.at !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.at > LAST_GAME_TTL_MS) {
      studioStorage.removeItem(LAST_GAME_KEY);
      return null;
    }
    return parsed as LastGame;
  } catch {
    return null;
  }
}

/**
 * Oublie la partie mémorisée. Avec `lobbyCode`, n'efface que si c'est bien celle-là :
 * un écran de fin d'un ANCIEN salon ne doit pas effacer la mémoire d'un autre.
 */
export function clearLastGame(lobbyCode?: string): void {
  try {
    if (lobbyCode) {
      const current = getLastGame();
      if (current && current.lobbyCode !== lobbyCode) return;
    }
    studioStorage.removeItem(LAST_GAME_KEY);
  } catch {
    /* silent */
  }
}
