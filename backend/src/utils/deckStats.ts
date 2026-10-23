import db from '../db/database.js';
import logger from './logger.js';
import type { GameCard, Locale, AdminDeckStatRow, AdminDeckStats } from '@onskone/shared';

type Kind = 'theme' | 'question';

const bump = db.prepare(`
  INSERT INTO deck_stats (kind, locale, category, theme, question, shown, picked, updated_at)
  VALUES (@kind, @locale, @category, @theme, @question, @shown, @picked, @now)
  ON CONFLICT(kind, locale, theme, question) DO UPDATE SET
    shown = shown + @shown,
    picked = picked + @picked,
    updated_at = @now
`);

interface Hit { kind: Kind; category: string; theme: string; question: string; shown: number; picked: number }

const apply = db.transaction((locale: Locale, hits: Hit[]) => {
  const now = Date.now();
  for (const h of hits) bump.run({ ...h, locale, now });
});

/** Stats best-effort : ne doit JAMAIS faire planter une partie. */
function safely(label: string, fn: () => void): void {
  try { fn(); } catch (err) {
    logger.warn(`deckStats: ${label} a échoué`, { error: err instanceof Error ? err.message : String(err) });
  }
}

/** Les cartes tirées pour le pilier : +1 "proposé" pour chaque thème et chaque question affichés. */
export function recordCardsShown(locale: Locale, cards: GameCard[]): void {
  safely('shown', () => {
    const hits: Hit[] = [];
    // Un thème présent sur 2 cartes du même tirage compte pour une seule proposition.
    const themes = new Set<string>();
    for (const card of cards) {
      if (!themes.has(card.theme)) {
        themes.add(card.theme);
        hits.push({ kind: 'theme', category: card.category, theme: card.theme, question: '', shown: 1, picked: 0 });
      }
      for (const q of card.questions) {
        hits.push({ kind: 'question', category: card.category, theme: card.theme, question: q, shown: 1, picked: 0 });
      }
    }
    apply(locale, hits);
  });
}

/** Le pilier a choisi `question` dans `card`. */
export function recordQuestionPicked(locale: Locale, card: GameCard, question: string): void {
  safely('picked', () => {
    apply(locale, [
      { kind: 'theme', category: card.category, theme: card.theme, question: '', shown: 0, picked: 1 },
      { kind: 'question', category: card.category, theme: card.theme, question, shown: 0, picked: 1 },
    ]);
  });
}

interface DbRow { category: string; theme: string; question: string; shown: number; picked: number }

export function getDeckStats(locale: Locale): AdminDeckStats {
  const load = (kind: Kind) => db.prepare(
    'SELECT category, theme, question, shown, picked FROM deck_stats WHERE kind = ? AND locale = ?',
  ).all(kind, locale) as DbRow[];

  const toRows = (rows: DbRow[], withQuestion: boolean): AdminDeckStatRow[] => {
    const total = rows.reduce((acc, r) => acc + r.picked, 0);
    return rows.map((r) => ({
      category: r.category,
      theme: r.theme,
      ...(withQuestion ? { question: r.question } : {}),
      shown: r.shown,
      picked: r.picked,
      pickRate: r.shown > 0 ? (r.picked / r.shown) * 100 : 0,
      pickShare: total > 0 ? (r.picked / total) * 100 : 0,
    }));
  };

  const themeRows = load('theme');
  return {
    totalPicks: themeRows.reduce((acc, r) => acc + r.picked, 0),
    totalShown: themeRows.reduce((acc, r) => acc + r.shown, 0),
    themes: toRows(themeRows, false),
    questions: toRows(load('question'), true),
  };
}
