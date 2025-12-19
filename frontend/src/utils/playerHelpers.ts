import { IPlayer } from '@onskone/shared';

/**
 * Validates that an object has the required IPlayer fields
 * Returns the player if valid, null otherwise
 */
export function parseStoredPlayer(jsonString: string | null): IPlayer | null {
  if (!jsonString) return null;

  try {
    const parsed = JSON.parse(jsonString);

    // Validate required fields
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.socketId !== 'string' ||
      typeof parsed.isHost !== 'boolean' ||
      typeof parsed.isActive !== 'boolean' ||
      typeof parsed.avatarId !== 'number'
    ) {
      return null;
    }

    // Return validated player
    return {
      id: parsed.id,
      socketId: parsed.socketId,
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
    const stored = localStorage.getItem('currentPlayer');
    const player = parseStoredPlayer(stored);

    if (!player && stored) {
      // Invalid data - clean it up
      localStorage.removeItem('currentPlayer');
    }

    return player;
  } catch {
    return null;
  }
}
