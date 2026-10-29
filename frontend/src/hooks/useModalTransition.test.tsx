import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalTransition } from './useModalTransition';

const EXIT_MS = 220;

describe('useModalTransition', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('reste monté pendant l\'animation de sortie puis démonte et appelle onClose', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useModalTransition(true, onClose));
    expect(result.current).toMatchObject({ render: true, closing: false });

    act(() => result.current.requestClose());
    expect(result.current).toMatchObject({ render: true, closing: true });
    expect(onClose).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(EXIT_MS); });
    expect(result.current).toMatchObject({ render: false, closing: false });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('un double clic sur fermer n\'appelle onClose qu\'une fois', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useModalTransition(true, onClose));
    act(() => { result.current.requestClose(); });
    act(() => { result.current.requestClose(); });
    act(() => { vi.advanceTimersByTime(EXIT_MS * 2); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fermeture pilotée par le parent (isOpen -> false) : animation puis démontage, sans onClose', () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHook(({ open }) => useModalTransition(open, onClose), { initialProps: { open: true } });
    rerender({ open: false });
    expect(result.current.closing).toBe(true);
    act(() => { vi.advanceTimersByTime(EXIT_MS); });
    expect(result.current.render).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('une réouverture pendant la sortie annule le démontage', () => {
    const { result, rerender } = renderHook(({ open }) => useModalTransition(open, () => {}), { initialProps: { open: true } });
    rerender({ open: false });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ open: true });
    act(() => { vi.advanceTimersByTime(EXIT_MS * 2); });
    expect(result.current).toMatchObject({ render: true, closing: false });
  });
});
