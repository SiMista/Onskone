import { randomInt } from 'crypto';

/**
 * Extrait un message d'erreur lisible depuis n'importe quel `catch (e)` (où `e: unknown`).
 * Évite de répéter `(error as Error).message` partout (qui crash si l'erreur est un string
 * ou un objet quelconque). À utiliser dans tous les `logger.error` et `socket.emit('error')`.
 *
 * NOTE: ce qu'on extrait ici est destiné aux **logs serveur**, pas au client. Pour les
 * messages envoyés au client via socket.emit('error'), préférer un libellé fixe générique
 * pour ne pas leak du détail d'implémentation.
 */
export function errMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Generate a cryptographically secure lobby code.
 * 6 characters long, uppercase, alphanumeric.
 * Uses randomInt to avoid modulo bias (256 % 36 != 0)
 */
export function generateLobbyCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[randomInt(0, chars.length)];
  }
  return code;
}

/**
 * Fisher-Yates shuffle algorithm for unbiased random array shuffling.
 * Creates a new shuffled copy of the array.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}