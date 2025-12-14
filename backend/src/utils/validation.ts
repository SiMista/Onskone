/**
 * Input validation utilities for server-side security
 */

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 20;
const MAX_ANSWER_LENGTH = 70; // Synced with frontend GAME_CONFIG.MAX_ANSWER_LENGTH

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate player name
 */
export function validatePlayerName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Le nom est requis' };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < MIN_NAME_LENGTH) {
    return { isValid: false, error: `Le nom doit contenir au moins ${MIN_NAME_LENGTH} caractères` };
  }

  if (trimmedName.length > MAX_NAME_LENGTH) {
    return { isValid: false, error: `Le nom ne peut pas dépasser ${MAX_NAME_LENGTH} caractères` };
  }

  // Check for forbidden characters (basic XSS prevention)
  const forbiddenChars = /<|>|&lt;|&gt;|script/i;
  if (forbiddenChars.test(trimmedName)) {
    return { isValid: false, error: 'Le nom contient des caractères interdits' };
  }

  return { isValid: true };
}

/**
 * Validate answer text
 */
export function validateAnswer(answer: string): ValidationResult {
  if (!answer || typeof answer !== 'string') {
    return { isValid: false, error: 'La réponse est requise' };
  }

  const trimmedAnswer = answer.trim();

  if (trimmedAnswer.length === 0) {
    return { isValid: false, error: 'La réponse ne peut pas être vide' };
  }

  if (trimmedAnswer.length > MAX_ANSWER_LENGTH) {
    return { isValid: false, error: `La réponse ne peut pas dépasser ${MAX_ANSWER_LENGTH} caractères` };
  }

  return { isValid: true };
}

/**
 * Validate lobby code format
 */
export function validateLobbyCode(code: string): ValidationResult {
  if (!code || typeof code !== 'string') {
    return { isValid: false, error: 'Code de salon invalide' };
  }

  const trimmedCode = code.trim().toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(trimmedCode)) {
    return { isValid: false, error: 'Le code doit contenir 6 caractères alphanumériques' };
  }

  return { isValid: true };
}

/**
 * Sanitize user input (basic protection)
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
