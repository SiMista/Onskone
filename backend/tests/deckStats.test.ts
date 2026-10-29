import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { GameCard } from '@onskone/shared';
import { recordCardsShown, recordQuestionPicked, getDeckStats } from '../src/utils/deckStats';
import db from '../src/db/database';

// database.ts utilise import.meta.url (ESM natif), illisible par le Jest CJS : on le
// remplace par une base en mémoire. Le DDL de deck_stats est recopié de database.ts.
jest.mock('../src/db/database', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    const memory = new Database(':memory:');
    memory.exec(`
        CREATE TABLE deck_stats (
            kind TEXT NOT NULL CHECK(kind IN ('theme', 'question')),
            locale TEXT NOT NULL,
            category TEXT NOT NULL,
            theme TEXT NOT NULL,
            question TEXT NOT NULL DEFAULT '',
            shown INTEGER NOT NULL DEFAULT 0,
            picked INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (kind, locale, theme, question)
        );
    `);
    return { __esModule: true, default: memory };
});

const stats = { recordCardsShown, recordQuestionPicked, getDeckStats };

const card = (category: string, theme: string, ...questions: string[]): GameCard => ({
    category, theme, subject: theme, questions,
});

beforeEach(() => {
    db.exec('DELETE FROM deck_stats');
});

describe('deckStats', () => {
    it('vide : tout à zéro', () => {
        const s = stats.getDeckStats('fr');
        expect(s).toMatchObject({ totalPicks: 0, totalShown: 0, themes: [], questions: [] });
    });

    it('compte un thème une seule fois par tirage, même sur 2 cartes du même thème', () => {
        stats.recordCardsShown('fr', [card('FUN', 'Cinéma', 'q1', 'q2'), card('FUN', 'Cinéma', 'q3')]);
        const s = stats.getDeckStats('fr');
        expect(s.themes).toHaveLength(1);
        expect(s.themes[0]).toMatchObject({ theme: 'Cinéma', shown: 1, picked: 0 });
        expect(s.questions).toHaveLength(3);
        expect(s.totalShown).toBe(1);
    });

    it('cumule les tirages et calcule taux de choix et part des choix', () => {
        const a = card('FUN', 'A', 'a1', 'a2');
        const b = card('FUN', 'B', 'b1');
        for (let i = 0; i < 4; i++) stats.recordCardsShown('fr', [a, b]);
        stats.recordQuestionPicked('fr', a, 'a1');
        stats.recordQuestionPicked('fr', a, 'a1');
        stats.recordQuestionPicked('fr', b, 'b1');

        const s = stats.getDeckStats('fr');
        const themeA = s.themes.find((t) => t.theme === 'A')!;
        const themeB = s.themes.find((t) => t.theme === 'B')!;
        expect(themeA).toMatchObject({ shown: 4, picked: 2, pickRate: 50 });
        expect(themeB).toMatchObject({ shown: 4, picked: 1, pickRate: 25 });
        expect(themeA.pickShare).toBeCloseTo(66.67, 1);
        expect(s.totalPicks).toBe(3);

        const q = s.questions.find((r) => r.question === 'a1')!;
        expect(q).toMatchObject({ shown: 4, picked: 2, theme: 'A' });
        const never = s.questions.find((r) => r.question === 'a2')!;
        expect(never).toMatchObject({ picked: 0, pickRate: 0 });
    });

    it('sépare les stats par locale', () => {
        const a = card('FUN', 'A', 'a1');
        stats.recordCardsShown('fr', [a]);
        stats.recordCardsShown('en', [a]);
        stats.recordCardsShown('en', [a]);
        expect(stats.getDeckStats('fr').themes[0].shown).toBe(1);
        expect(stats.getDeckStats('en').themes[0].shown).toBe(2);
    });

    it('ne fait jamais planter la partie si la base échoue (best-effort)', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        db.exec('ALTER TABLE deck_stats RENAME TO deck_stats_off');
        try {
            expect(() => stats.recordCardsShown('fr', [card('FUN', 'A', 'a1')])).not.toThrow();
            expect(() => stats.recordQuestionPicked('fr', card('FUN', 'A', 'a1'), 'a1')).not.toThrow();
            expect(warn).toHaveBeenCalled();
        } finally {
            warn.mockRestore();
            db.exec('ALTER TABLE deck_stats_off RENAME TO deck_stats');
        }
    });
});
