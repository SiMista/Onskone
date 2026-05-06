/**
 * Input validation utilities for server-side security
 */

import xss from 'xss';
import { GAME_CONSTANTS } from '@onskone/shared';

const { MIN_NAME_LENGTH, MAX_NAME_LENGTH, MAX_ANSWER_LENGTH } = GAME_CONSTANTS;

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

  // Check for XSS attempts by comparing sanitized output with original
  const sanitized = xss(trimmedName);
  if (sanitized !== trimmedName) {
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

  // Block reserved prefix used for system-generated "no response" messages
  if (trimmedAnswer.startsWith('__NO_RESPONSE__')) {
    return { isValid: false, error: 'La réponse contient un préfixe réservé' };
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
 * Validate player ID format (UUID v4)
 */
export function validatePlayerId(playerId: string): ValidationResult {
  if (!playerId || typeof playerId !== 'string') {
    return { isValid: false, error: 'ID joueur invalide' };
  }

  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(playerId)) {
    return { isValid: false, error: 'Format ID joueur invalide' };
  }

  return { isValid: true };
}

/**
 * Validate and normalize avatar ID
 * Returns a valid avatar ID within bounds, or the default if invalid
 */
export function validateAvatarId(avatarId: unknown): number {
  if (
    typeof avatarId === 'number' &&
    avatarId >= GAME_CONSTANTS.MIN_AVATAR_ID &&
    avatarId <= GAME_CONSTANTS.MAX_AVATAR_ID
  ) {
    return Math.floor(avatarId);
  }
  return GAME_CONSTANTS.MIN_AVATAR_ID;
}

/**
 * Sanitize user input (XSS protection)
 * Uses the xss library for comprehensive protection against XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes first (can be used to bypass filters)
  const cleaned = input.trim().replace(/\0/g, '');

  // Use xss library with stripIgnoreTag to remove all HTML tags
  return xss(cleaned, {
    whiteList: {}, // No tags allowed
    stripIgnoreTag: true, // Strip all tags not in whitelist
    stripIgnoreTagBody: ['script', 'style'], // Remove script/style content entirely
  });
}
