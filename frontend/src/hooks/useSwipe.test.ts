import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSwipe } from './useSwipe';

/** Build a minimal synthetic MouseEvent carrying just the coords the hook reads. */
function mouseEvent(clientX: number, clientY: number) {
  return { clientX, clientY } as React.MouseEvent;
}

/** Build a minimal synthetic TouchEvent for touchstart (uses `touches`). */
function touchStart(clientX: number, clientY: number) {
  return { touches: [{ clientX, clientY }] } as unknown as React.TouchEvent;
}

/** Build a minimal synthetic TouchEvent for touchend (uses `changedTouches`). */
function touchEnd(clientX: number, clientY: number) {
  return { changedTouches: [{ clientX, clientY }] } as unknown as React.TouchEvent;
}

describe('useSwipe', () => {
  let onNext: ReturnType<typeof vi.fn>;
  let onPrev: ReturnType<typeof vi.fn>;
  let onInteract: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onNext = vi.fn();
    onPrev = vi.fn();
    onInteract = vi.fn();
  });

  function setup(threshold?: number) {
    return renderHook(() =>
      useSwipe({ onNext, onPrev, onInteract, threshold }),
    ).result.current;
  }

  it('triggers onNext on a leftward swipe past the threshold (dx < 0)', () => {
    const { mouseHandlers } = setup();
    mouseHandlers.onMouseDown(mouseEvent(200, 0));
    mouseHandlers.onMouseUp(mouseEvent(100, 0)); // dx = -100
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('triggers onPrev on a rightward swipe past the threshold (dx > 0)', () => {
    const { mouseHandlers } = setup();
    mouseHandlers.onMouseDown(mouseEvent(100, 0));
    mouseHandlers.onMouseUp(mouseEvent(200, 0)); // dx = +100
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('ignores a horizontal move below the threshold', () => {
    const { mouseHandlers } = setup(); // default threshold 50
    mouseHandlers.onMouseDown(mouseEvent(100, 0));
    mouseHandlers.onMouseUp(mouseEvent(140, 0)); // dx = 40 < 50
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('fires exactly at the threshold boundary (abs(dx) === threshold)', () => {
    const { mouseHandlers } = setup(); // threshold 50
    mouseHandlers.onMouseDown(mouseEvent(0, 0));
    mouseHandlers.onMouseUp(mouseEvent(-50, 0)); // dx = -50, not < 50
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('ignores a vertical-dominant gesture (abs(dx) < abs(dy))', () => {
    const { mouseHandlers } = setup();
    mouseHandlers.onMouseDown(mouseEvent(0, 0));
    mouseHandlers.onMouseUp(mouseEvent(60, 200)); // dx 60 >= threshold but < dy 200
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('respects a custom threshold', () => {
    const { mouseHandlers } = setup(100);
    mouseHandlers.onMouseDown(mouseEvent(0, 0));
    mouseHandlers.onMouseUp(mouseEvent(-80, 0)); // 80 < 100 -> ignored
    expect(onNext).not.toHaveBeenCalled();
    mouseHandlers.onMouseDown(mouseEvent(0, 0));
    mouseHandlers.onMouseUp(mouseEvent(-120, 0)); // 120 >= 100 -> fires
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('calls onInteract at the start of a gesture', () => {
    const { mouseHandlers } = setup();
    mouseHandlers.onMouseDown(mouseEvent(0, 0));
    expect(onInteract).toHaveBeenCalledTimes(1);
  });

  it('does nothing on mouseup without a preceding mousedown', () => {
    const { mouseHandlers } = setup();
    mouseHandlers.onMouseUp(mouseEvent(0, 0)); // no start recorded
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('resets the gesture on mouseleave so a subsequent mouseup is ignored', () => {
    const { mouseHandlers } = setup();
    mouseHandlers.onMouseDown(mouseEvent(200, 0));
    mouseHandlers.onMouseLeave();
    mouseHandlers.onMouseUp(mouseEvent(0, 0)); // start was cleared
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('handles touch swipes the same way (leftward -> onNext)', () => {
    const { touchHandlers } = setup();
    touchHandlers.onTouchStart(touchStart(200, 10));
    touchHandlers.onTouchEnd(touchEnd(100, 20)); // dx = -100, dy = 10
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
