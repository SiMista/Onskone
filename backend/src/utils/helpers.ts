import { randomInt } from 'crypto';

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