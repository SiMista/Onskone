import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useRef } from 'react';
import ScrollFade from './ScrollFade';

afterEach(cleanup);

const Harness = ({ metrics }: { metrics: () => { scrollTop: number; scrollHeight: number; clientHeight: number } }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={(el) => {
          ref.current = el;
          if (!el) return;
          for (const key of ['scrollTop', 'scrollHeight', 'clientHeight'] as const) {
            Object.defineProperty(el, key, { configurable: true, get: () => metrics()[key] });
          }
        }}
      />
      <ScrollFade scrollRef={ref} />
    </div>
  );
};

const fades = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('[aria-hidden]'));

describe('ScrollFade', () => {
  it('affiche le fade du bas seulement quand il reste du contenu dessous', () => {
    const { container } = render(<Harness metrics={() => ({ scrollTop: 0, scrollHeight: 500, clientHeight: 200 })} />);
    const [top, bottom] = fades(container);
    expect(top.style.opacity).toBe('0');
    expect(bottom.style.opacity).toBe('1');
  });

  it('affiche le fade du haut une fois scrollé, et plus celui du bas en fin de course', () => {
    const { container } = render(<Harness metrics={() => ({ scrollTop: 300, scrollHeight: 500, clientHeight: 200 })} />);
    const [top, bottom] = fades(container);
    expect(top.style.opacity).toBe('1');
    expect(bottom.style.opacity).toBe('0');
  });

  it('ne plante pas (React #185) quand les mesures oscillent à chaque lecture', () => {
    let n = 0;
    const flipFlop = () => ({ scrollTop: 0, scrollHeight: n++ % 2 ? 500 : 100, clientHeight: 200 });
    expect(() => render(<Harness metrics={flipFlop} />)).not.toThrow();
  });
});
