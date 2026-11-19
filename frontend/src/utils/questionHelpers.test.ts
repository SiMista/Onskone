import { describe, it, expect } from 'vitest';
import type { GameCard } from '@onskone/shared';
import { getQuestionTip } from './questionHelpers';

const QUESTION = 'Quel est ton moyen de communication préféré ?';
const TIP = 'SMS, WhatsApp, appels, Insta…';
const card: GameCard = {
  category: 'ICEBREAKERS',
  theme: 'QUOTIDIEN',
  subject: 'Téléphone',
  questions: [QUESTION, 'Une autre question ?'],
  tips: { [QUESTION]: TIP },
};

describe('getQuestionTip', () => {
  it("renvoie l'astuce de la question exacte, rien pour les autres", () => {
    expect(getQuestionTip(card, QUESTION)).toBe(TIP);
    expect(getQuestionTip(card, 'Une autre question ?')).toBeUndefined();
    expect(getQuestionTip(undefined, QUESTION)).toBeUndefined();
    expect(getQuestionTip({ ...card, tips: undefined }, QUESTION)).toBeUndefined();
  });

  it("ne confond pas une clé héritée de l'objet avec une astuce", () => {
    expect(getQuestionTip(card, 'constructor')).toBeUndefined();
  });
});
