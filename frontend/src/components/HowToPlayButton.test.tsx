import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { LocaleProvider } from '../i18n';
import HowToPlayButton from './HowToPlayButton';

// En jsdom, animationstart ne tombe jamais : c'est le filet de 700ms qui marque la
// bulle "apparue". Les délais ci-dessous en tiennent compte.
const renderButton = (onClick = vi.fn()) =>
  render(<LocaleProvider><HowToPlayButton onClick={onClick} /></LocaleProvider>);

const bubble = () => screen.queryByRole('status');

describe('HowToPlayButton — bulle « nouveau joueur »', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('survives a distracted tap: stays at least 5s after appearing', () => {
    renderButton();
    expect(bubble()).not.toBeNull();

    // Tap n'importe où AVANT même l'apparition (le joueur tape son pseudo).
    // Un act() par étape : React n'exécute les effets qu'en fin de act.
    fireEvent.pointerDown(document.body);
    act(() => { vi.advanceTimersByTime(700); }); // apparition
    act(() => { vi.advanceTimersByTime(4000); });
    expect(bubble()).not.toBeNull();

    // 5s après l'apparition : sortie lancée, puis fin de l'animation de sortie.
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(bubble()).toBeNull();
  });

  it('stays as long as the player does not tap', () => {
    renderButton();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(bubble()).not.toBeNull();
  });

  it('leaves right away when the player opens the rules', () => {
    const onClick = vi.fn();
    renderButton(onClick);
    act(() => { vi.advanceTimersByTime(700); });

    const button = screen.getByRole('button');
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    act(() => { vi.advanceTimersByTime(300); });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(bubble()).toBeNull();
  });

  it('is shown only once in the player life', () => {
    renderButton();
    expect(bubble()).not.toBeNull();
    cleanup();
    renderButton();
    expect(bubble()).toBeNull();
  });
});
