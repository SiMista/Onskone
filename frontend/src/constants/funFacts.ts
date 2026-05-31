/**
 * Helpers de sélection aléatoire de fun fact. Le tableau lui-même vit dans le
 * dictionnaire i18n (t.funFacts) - l'appelant passe le tableau au moment de
 * l'utilisation.
 */

export const getRandomFunFact = (facts: readonly string[]): string => {
  if (facts.length === 0) return '';
  return facts[Math.floor(Math.random() * facts.length)];
};

export const getNextFunFact = (facts: readonly string[], currentFact: string): string => {
  if (facts.length <= 1) return facts[0] || '';
  let next = currentFact;
  while (next === currentFact) {
    next = facts[Math.floor(Math.random() * facts.length)];
  }
  return next;
};
