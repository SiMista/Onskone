import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LocaleProvider } from '../i18n';
import { WHITEBOARD_FRAME_Y, WHITEBOARD_SHADOW } from '../constants/whiteboard';

const { fakeSocket } = vi.hoisted(() => ({
  fakeSocket: { on: () => {}, off: () => {}, emit: vi.fn(), listeners: () => [] },
}));
vi.mock('../utils/socket', () => ({ default: fakeSocket, IS_SCREEN_PREVIEW: false, dispatchPreviewServerEvent: () => {} }));

import WhiteboardWaiting from './WhiteboardWaiting';

/**
 * Régression : quand l'écran laisse de la place pour le cadre du tableau mais pas pour
 * le cadre + le bandeau de l'idée, le tableau disparaissait (pas de place), emportant le
 * bandeau ; sa hauteur repartait à 0, le tableau revenait, le bandeau aussi… boucle de
 * rendu infinie (« Maximum update depth exceeded ») et écran de phase en erreur.
 */
const HEADER = 100;
const BANNER = 40;

describe('WhiteboardWaiting — place juste trop courte pour le bandeau', () => {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const stub = (prop: string, get: (this: HTMLElement) => number) => {
    originals.set(prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop));
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get });
  };

  beforeEach(() => {
    localStorage.setItem('onskone:locale', 'fr');
    vi.stubGlobal('ResizeObserver', undefined);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0', rowGap: '0',
    } as CSSStyleDeclaration);
    // Place verticale du tableau : celle du cadre + 20 px (moins que le bandeau).
    const height = HEADER + WHITEBOARD_SHADOW + WHITEBOARD_FRAME_Y + BANNER / 2;
    stub('clientWidth', () => 400);
    stub('clientHeight', () => height);
    stub('offsetHeight', function () { return this.tagName === 'P' ? BANNER : HEADER; });
    stub('offsetTop', () => 0);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    originals.forEach((desc, prop) => {
      if (desc) Object.defineProperty(HTMLElement.prototype, prop, desc);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
    });
    originals.clear();
  });

  it('se stabilise sans tableau au lieu de boucler', () => {
    const { container } = render(
      <LocaleProvider>
        <WhiteboardWaiting
          lobbyCode="ABCDEF"
          playerId="p2"
          roundNumber={1}
          drawingIdea={{ id: 'portrait', playerId: 'p1' }}
          leader={{ id: 'p1', name: 'Léa', avatarId: 0, isPremium: false }}
          players={[{ id: 'p1', name: 'Léa' }, { id: 'p2', name: 'Tom' }]}
        />
      </LocaleProvider>,
    );
    expect(container.querySelector('canvas')).toBeNull();
  });
});
