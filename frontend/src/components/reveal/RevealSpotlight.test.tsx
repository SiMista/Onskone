import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { RevealResult } from '@onskone/shared';
import { LocaleProvider } from '../../i18n';

// Fausse socket (le reveal s'abonne à ses évènements) ; rien n'est diffusé ici.
const { fakeSocket } = vi.hoisted(() => ({
  fakeSocket: { on: () => {}, off: () => {}, emit: vi.fn() },
}));
vi.mock('../../utils/socket', () => ({ default: fakeSocket }));

import RevealPhase from '../RevealPhase';

const card = (author: string, holder: string, answer: string): RevealResult => ({
  playerId: author,
  playerName: author,
  answer,
  guessedPlayerId: holder,
  guessedPlayerName: holder,
  correct: author === holder,
});

// Alice et Bob ont écrit pizza, Charlie hamburger ; cartes tournées d'un cran.
// Tour de table : Bob (0), Charlie (1), Alice (2).
const RESULTS = [card('alice', 'bob', 'Pizza'), card('bob', 'charlie', 'Pizzas'), card('charlie', 'alice', 'Hamburger')];
const LEADER = { id: 'pilier', name: 'Pilier', avatarId: 0 };
const NONE: readonly number[] = [];

/** Téléphone de `me` (joueur, mode local) pendant le reveal. */
const phoneOf = (me: string, state: { revealed: number[]; pending: number | null }) =>
  render(
    <LocaleProvider>
      <RevealPhase
        lobbyCode="ABCDEF"
        isLeader={false}
        leader={LEADER}
        currentPlayerId={me}
        isGameOver={false}
        results={RESULTS}
        revealOrder={[0, 1, 2]}
        serverRevealedIndices={state.revealed}
        pendingSimilarityIndex={state.pending}
        similarityCorrections={NONE}
        gameMode="local"
      />
    </LocaleProvider>,
  );

describe('projecteur sur les téléphones (REVEAL local)', () => {
  beforeAll(() => {
    // jsdom n'a pas ResizeObserver (auto-fit du texte des cartes).
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  beforeEach(() => { localStorage.setItem('onskone:locale', 'fr'); });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it('allume le téléphone du prochain joueur à révéler, et seulement lui', () => {
    phoneOf('bob', { revealed: [], pending: null });
    expect(screen.getByText('À toi ! Montre ton écran')).toBeTruthy();
    cleanup();
    phoneOf('charlie', { revealed: [], pending: null });
    expect(screen.queryByText('À toi ! Montre ton écran')).toBeNull();
  });

  it("pendant une similarité, allume l'écran de Charlie, où est posé ce que Bob a vraiment écrit", () => {
    phoneOf('charlie', { revealed: [0], pending: 0 });
    expect(screen.getByText('Le pilier compare avec ta carte !')).toBeTruthy();
    cleanup();
    // Bob reste « à révéler » tant que le pilier n'a pas tranché : son écran est allumé aussi.
    phoneOf('bob', { revealed: [0], pending: 0 });
    expect(screen.getByText('À toi ! Montre ton écran')).toBeTruthy();
    cleanup();
    phoneOf('alice', { revealed: [0], pending: 0 });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it("s'éteint chez Charlie dès que le pilier a tranché", () => {
    const { rerender } = phoneOf('charlie', { revealed: [0], pending: 0 });
    rerender(
      <LocaleProvider>
        <RevealPhase
          lobbyCode="ABCDEF"
          isLeader={false}
          leader={LEADER}
          currentPlayerId="charlie"
          isGameOver={false}
          results={RESULTS}
          revealOrder={[0, 1, 2]}
          serverRevealedIndices={[0]}
          pendingSimilarityIndex={null}
          similarityCorrections={NONE}
          gameMode="local"
        />
      </LocaleProvider>,
    );
    expect(screen.queryByText('Le pilier compare avec ta carte !')).toBeNull();
    // Charlie devient la prochaine carte à révéler.
    expect(screen.getByText('À toi ! Montre ton écran')).toBeTruthy();
  });
});
