import { describe, it, expect } from '@jest/globals';
import * as QuestionsRepo from '../src/data/questionsRepository';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@onskone/shared';
import type { SelectedDecks } from '@onskone/shared';

describe('tips des questions (questions_<locale>.json)', () => {
    // Garde-fou si quelqu'un retouche le JSON à la main au lieu de l'Excel : un tip
    // dont la clé ne correspond à aucune question de la carte ne s'affichera jamais.
    it.each(SUPPORTED_LOCALES)('%s : chaque tip est indexé par une question de sa carte', (locale) => {
        const pool = QuestionsRepo.getRandomQuestions(Number.MAX_SAFE_INTEGER, [], undefined, locale);
        expect(pool.length).toBeGreaterThan(0);
        for (const card of pool) {
            for (const [question, tip] of Object.entries(card.tips ?? {})) {
                expect(card.questions).toContain(question);
                expect(tip.trim()).not.toBe('');
            }
        }
    });

    it('les cartes sans tip ne portent pas de champ tips vide', () => {
        const pool = QuestionsRepo.getRandomQuestions(Number.MAX_SAFE_INTEGER, [], undefined, DEFAULT_LOCALE);
        expect(pool.some((card) => card.tips)).toBe(true);
        for (const card of pool) {
            if (card.tips) expect(Object.keys(card.tips).length).toBeGreaterThan(0);
        }
    });
});

describe('sanitizeSelectedDecks - gating premium', () => {
    const catalog = QuestionsRepo.getDecksCatalog(DEFAULT_LOCALE);
    const premiumCodes = new Set(QuestionsRepo.getPremiumCodes());

    // Construit une sélection = TOUS les codes du catalogue (premium inclus).
    const everything: SelectedDecks = {};
    for (const [category, codes] of Object.entries(catalog)) {
        everything[category] = [...codes];
    }

    it('supprime les codes inconnus', () => {
        const clean = QuestionsRepo.sanitizeSelectedDecks(
            { ICEBREAKERS: ['__nope__'] },
            DEFAULT_LOCALE,
        );
        expect(clean.ICEBREAKERS ?? []).not.toContain('__nope__');
    });

    it('sans allowPremium : aucun code premium ne survit', () => {
        const clean = QuestionsRepo.sanitizeSelectedDecks(everything, DEFAULT_LOCALE, false);
        const survivors = Object.values(clean).flat();
        for (const code of survivors) {
            expect(premiumCodes.has(code)).toBe(false);
        }
    });

    it('avec allowPremium : les codes premium sont conservés', () => {
        const clean = QuestionsRepo.sanitizeSelectedDecks(everything, DEFAULT_LOCALE, true);
        const survivors = new Set(Object.values(clean).flat());
        // Chaque code premium présent au catalogue doit être conservé.
        for (const code of premiumCodes) {
            const inCatalog = Object.values(catalog).some((codes) => codes.includes(code));
            if (inCatalog) expect(survivors.has(code)).toBe(true);
        }
    });

    it('allowPremium par défaut (false) filtre comme le mode restreint', () => {
        const withDefault = QuestionsRepo.sanitizeSelectedDecks(everything, DEFAULT_LOCALE);
        const withFalse = QuestionsRepo.sanitizeSelectedDecks(everything, DEFAULT_LOCALE, false);
        expect(withDefault).toEqual(withFalse);
    });
});
