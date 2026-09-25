import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { useState } from 'react';
import { useModalChrome } from './useModalChrome';

/** Modale minimale : se démonte quand elle se ferme, comme en vrai. */
const Modal = ({ keepOnResume = false, onClosed }: { keepOnResume?: boolean; onClosed: () => void }) => {
  const [open, setOpen] = useState(true);
  useModalChrome(open, () => { setOpen(false); onClosed(); }, { keepOnResume });
  return open ? <div /> : null;
};

/** Simule le retour de l'app au premier plan. */
const resume = () => act(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});

describe('useModalChrome — retour au premier plan', () => {
  it('ferme TOUTES les modales empilées, pas seulement celle du sommet', () => {
    const closed: string[] = [];
    render(
      <>
        <Modal onClosed={() => closed.push('a')} />
        <Modal onClosed={() => closed.push('b')} />
        <Modal onClosed={() => closed.push('c')} />
      </>,
    );
    resume();
    expect(closed.sort()).toEqual(['a', 'b', 'c']);
  });

  it('épargne les modales bloquantes (keepOnResume)', () => {
    const closed: string[] = [];
    render(
      <>
        <Modal onClosed={() => closed.push('normale')} />
        <Modal keepOnResume onClosed={() => closed.push('bloquante')} />
      </>,
    );
    resume();
    expect(closed).toEqual(['normale']);
  });

  it('ne ferme rien quand l\'app passe en arrière-plan', () => {
    const closed: string[] = [];
    render(<Modal onClosed={() => closed.push('a')} />);
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(closed).toEqual([]);
  });
});
