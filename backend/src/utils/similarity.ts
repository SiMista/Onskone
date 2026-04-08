/**
 * Fonctions de détection de similarité entre réponses
 */

const FRENCH_STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'de', 'du', 'des',
  'a', 'au', 'aux', 'en', 'et', 'ou', 'mais', 'pour',
  'par', 'sur', 'avec', 'dans', 'que', 'qui', 'son',
  'sa', 'ses', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'ce', 'cette', 'ces', 'ca', 'est', 'l', 'd', 'n',
  's', 'j', 'qu', 'ne', 'pas', 'plus', 'se', 'si',
]);

export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retirer accents
    .replace(/[^a-z0-9\s]/g, ' ')   // ponctuation → espace
    .split(/\s+/)
    .filter(word => word.length > 0 && !FRENCH_STOP_WORDS.has(word))
    .join(' ')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Optimisation single-row
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // suppression
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

export function areAnswersSimilar(a: string, b: string, threshold = 0.75): boolean {
  const normA = normalizeAnswer(a);
  const normB = normalizeAnswer(b);

  if (normA.length === 0 || normB.length === 0) return false;
  if (normA === normB) return true;

  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  const similarity = 1 - distance / maxLen;

  return similarity >= threshold;
}
