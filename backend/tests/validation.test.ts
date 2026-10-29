import { describe, it, expect } from '@jest/globals';
import { GAME_CONSTANTS, NO_RESPONSE_PREFIX } from '@onskone/shared';
import {
    validatePlayerName,
    validateAnswer,
    validateLobbyCode,
    validatePlayerId,
    validateAvatarId,
    sanitizeInput,
} from '../src/utils/validation';

describe('validatePlayerName', () => {
    it('accepte un pseudo normal', () => {
        expect(validatePlayerName('Simeon').isValid).toBe(true);
    });

    it('refuse vide, espaces seuls et types invalides', () => {
        expect(validatePlayerName('').isValid).toBe(false);
        expect(validatePlayerName('   ').isValid).toBe(false);
        expect(validatePlayerName(undefined as unknown as string).isValid).toBe(false);
        expect(validatePlayerName(42 as unknown as string).isValid).toBe(false);
    });

    it('applique la limite de longueur APRÈS trim', () => {
        expect(validatePlayerName('a'.repeat(GAME_CONSTANTS.MAX_NAME_LENGTH)).isValid).toBe(true);
        expect(validatePlayerName('a'.repeat(GAME_CONSTANTS.MAX_NAME_LENGTH + 1)).isValid).toBe(false);
        expect(validatePlayerName(`  ${'a'.repeat(GAME_CONSTANTS.MAX_NAME_LENGTH)}  `).isValid).toBe(true);
    });

    it.each(['<b>x</b>', 'a>b', 'x&lt;y', 'SCRIPT', 'myScriptName'])('refuse le pseudo suspect %s', (name) => {
        expect(validatePlayerName(name).isValid).toBe(false);
    });
});

describe('validateAnswer', () => {
    it('accepte une réponse normale et refuse vide / espaces', () => {
        expect(validateAnswer('Une pizza').isValid).toBe(true);
        expect(validateAnswer('').isValid).toBe(false);
        expect(validateAnswer('   ').isValid).toBe(false);
    });

    it('applique la limite de longueur', () => {
        expect(validateAnswer('a'.repeat(GAME_CONSTANTS.MAX_ANSWER_LENGTH)).isValid).toBe(true);
        expect(validateAnswer('a'.repeat(GAME_CONSTANTS.MAX_ANSWER_LENGTH + 1)).isValid).toBe(false);
    });

    it('refuse le préfixe réservé du « n\'a pas répondu » (anti-usurpation d\'un joueur absent)', () => {
        expect(validateAnswer(`${NO_RESPONSE_PREFIX}Bob n'a pas répondu`).isValid).toBe(false);
        expect(validateAnswer(`  ${NO_RESPONSE_PREFIX}x`).isValid).toBe(false);
    });
});

describe('validateLobbyCode', () => {
    it('accepte 6 caractères alphanumériques, insensible à la casse et aux espaces autour', () => {
        expect(validateLobbyCode('ABC123').isValid).toBe(true);
        expect(validateLobbyCode(' abc123 ').isValid).toBe(true);
    });

    it.each(['', 'ABC12', 'ABC1234', 'ABC-12', 'ÀBC123'])('refuse %p', (code) => {
        expect(validateLobbyCode(code).isValid).toBe(false);
    });
});

describe('validatePlayerId', () => {
    it('accepte un UUID v4 et refuse le reste', () => {
        expect(validatePlayerId('123e4567-e89b-42d3-a456-426614174000').isValid).toBe(true);
        expect(validatePlayerId('123e4567-e89b-12d3-a456-426614174000').isValid).toBe(false); // v1
        expect(validatePlayerId('pas-un-uuid').isValid).toBe(false);
        expect(validatePlayerId('').isValid).toBe(false);
    });
});

describe('validateAvatarId', () => {
    it('garde un avatar valide (arrondi à l\'entier inférieur)', () => {
        expect(validateAvatarId(5)).toBe(5);
        expect(validateAvatarId(5.9)).toBe(5);
        expect(validateAvatarId(GAME_CONSTANTS.MAX_AVATAR_ID)).toBe(GAME_CONSTANTS.MAX_AVATAR_ID);
    });

    it('retombe sur l\'avatar par défaut si hors bornes ou pas un nombre', () => {
        const fallback = GAME_CONSTANTS.MIN_AVATAR_ID;
        for (const bad of [-1, GAME_CONSTANTS.MAX_AVATAR_ID + 1, '3', null, undefined, NaN]) {
            expect(validateAvatarId(bad)).toBe(fallback);
        }
    });
});

describe('sanitizeInput', () => {
    it('laisse le texte normal intact, sans ré-encoder « & » (React échappe déjà)', () => {
        expect(sanitizeInput('Tom & Jerry, 100% ok')).toBe('Tom & Jerry, 100% ok');
        expect(sanitizeInput('  salut  ')).toBe('salut');
    });

    it('renvoie une chaîne vide pour une entrée invalide', () => {
        expect(sanitizeInput('')).toBe('');
        expect(sanitizeInput(null as unknown as string)).toBe('');
    });

    it.each([
        ['balises HTML', '<script>alert(1)</script>x', /<|script>/],
        ['balise non fermée', '<img src=x onerror=alert(1)', /<|onerror/],
        ['protocole javascript:', 'javascript:alert(1)', /javascript:/i],
        ['javascript: espacé', 'j a v a s c r i p t :alert(1)', /j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i],
        ['entité encodée', '&#106;avascript', /&#/],
        ['gestionnaire on*', 'x onclick=alert(1)', /onclick\s*=/i],
        ['protocole data:', 'data:text/html,x', /data:/i],
        ['vbscript:', 'vbscript:msgbox', /vbscript:/i],
        ['expression()', 'width: expression(alert(1))', /expression\s*\(/i],
    ])('neutralise : %s', (_label, input, forbidden) => {
        expect(sanitizeInput(input)).not.toMatch(forbidden);
    });

    it('retire les octets nuls (contournement de filtre)', () => {
        expect(sanitizeInput('ja\0vascript:x')).not.toMatch(/javascript:/i);
        expect(sanitizeInput('a\0b')).toBe('ab');
    });
});
