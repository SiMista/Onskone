import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { GameCard } from '@onskone/shared';
import { LocaleProvider } from '../i18n';
import QuestionCard from './QuestionCard';
import { getQuestionTip } from '../utils/questionHelpers';

const QUESTION = 'Quel est ton moyen de communication préféré ?';
const TIP = 'SMS, WhatsApp, appels, Insta…';
const card: GameCard = {
  category: 'ICEBREAKERS',
  theme: 'QUOTIDIEN',
  subject: 'Téléphone',
  questions: [QUESTION, 'Une autre question ?'],
  tips: { [QUESTION]: TIP },
};

const renderCard = (props: Partial<Parameters<typeof QuestionCard>[0]> = {}) =>
  render(
    <LocaleProvider>
      <QuestionCard question={QUESTION} card={card} variant="compact" {...props} />
    </LocaleProvider>,
  );

const tipButton = () => screen.queryByRole('button', { name: "Voir l'astuce" });
const teaser = () => screen.queryByRole('status');

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

describe('QuestionCard — astuce de la question', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('onskone:locale', 'fr');
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('sans astuce : pas de pastille', () => {
    renderCard();
    expect(tipButton()).toBeNull();
  });

  it('joueur qui répond : la pastille pulse et le teaser passe, puis le tap ouvre l’astuce et coupe tout', () => {
    renderCard({ tip: TIP, tipAttention: true });
    const btn = tipButton()!;
    expect(btn.className).toContain('animate-tip-pulse');

    // Teaser « Besoin d'aide ? » après le délai d'entrée.
    expect(teaser()).toBeNull();
    act(() => { vi.advanceTimersByTime(900); });
    expect(teaser()?.textContent).toBe("Besoin d'aide ?");

    fireEvent.click(btn);
    expect(screen.getByRole('dialog').textContent).toBe(TIP);
    expect(btn.className).not.toContain('animate-tip-pulse');
    act(() => { vi.advanceTimersByTime(200); }); // sortie animée du teaser
    expect(teaser()).toBeNull();
  });

  it('le teaser repart tout seul et ne revient pas', () => {
    renderCard({ tip: TIP, tipAttention: true });
    act(() => { vi.advanceTimersByTime(900); });
    expect(teaser()).not.toBeNull();
    act(() => { vi.advanceTimersByTime(4500); });
    act(() => { vi.advanceTimersByTime(200); });
    expect(teaser()).toBeNull();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(teaser()).toBeNull();
    // La pastille, elle, pulse jusqu'au tap.
    expect(tipButton()!.className).toContain('animate-tip-pulse');
  });

  it('réponse envoyée (attention coupée) : plus de pulse ni de teaser', () => {
    const { rerender } = renderCard({ tip: TIP, tipAttention: true });
    rerender(
      <LocaleProvider>
        <QuestionCard question={QUESTION} card={card} variant="compact" tip={TIP} tipAttention={false} />
      </LocaleProvider>,
    );
    act(() => { vi.advanceTimersByTime(2000); });
    expect(teaser()).toBeNull();
    expect(tipButton()!.className).not.toContain('animate-tip-pulse');
  });

  it('pilier (sans attention) : pastille sobre, pas de teaser', () => {
    renderCard({ tip: TIP });
    expect(tipButton()!.className).not.toContain('animate-tip-pulse');
    act(() => { vi.advanceTimersByTime(2000); });
    expect(teaser()).toBeNull();
  });

  it('le tap ne vole pas le focus du champ de réponse (clavier mobile)', () => {
    renderCard({ tip: TIP, tipAttention: true });
    // fireEvent renvoie false quand le handler a fait preventDefault (pas de prise de focus).
    expect(fireEvent.pointerDown(tipButton()!)).toBe(false);
    expect(fireEvent.mouseDown(tipButton()!)).toBe(false);
  });
});
