import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { LocaleProvider } from '../../../i18n';

// Fausse socket : les écrans s'abonnent à ses évènements ; rien n'est diffusé ici.
const { fakeSocket } = vi.hoisted(() => ({
  fakeSocket: { on: () => {}, off: () => {}, emit: vi.fn(), listeners: () => [] },
}));
vi.mock('../../../utils/socket', () => ({ default: fakeSocket, dispatchPreviewServerEvent: () => {} }));

import RevealPhase from '../../../components/RevealPhase';
import { SCREEN_SCENARIOS, applyScreenEmit, getScenario, scenarioViewers } from './scenarios';

describe('aperçu d’écrans du Studio : chaque scénario s’affiche', () => {
  beforeAll(() => {
    // jsdom n'a pas ResizeObserver (auto-fit du texte des cartes).
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });
  beforeEach(() => { localStorage.setItem('onskone:locale', 'fr'); });
  afterEach(() => { cleanup(); localStorage.clear(); });

  // Garde-fou : un écran de cas limite qui plante se voit ici, pas en pleine partie.
  for (const scenario of SCREEN_SCENARIOS) {
    for (const viewer of scenarioViewers(scenario)) {
      for (const mode of ['local', 'remote'] as const) {
        it(`${scenario.title} · vu par ${viewer.name} · ${mode}`, () => {
          const { container } = render(
            <LocaleProvider>
              <RevealPhase
                lobbyCode="APERCU"
                isLeader={viewer.id === scenario.leader.id}
                leader={scenario.leader}
                currentPlayerId={viewer.id}
                isGameOver={false}
                results={scenario.initial.results}
                revealOrder={scenario.initial.revealOrder}
                serverRevealedIndices={scenario.initial.revealed}
                pendingSimilarityIndex={scenario.initial.pending}
                similarityCorrections={scenario.initial.corrections}
                gameMode={mode}
              />
            </LocaleProvider>,
          );
          expect(container.textContent).not.toBe('');
        });
      }
    }
  }
});

describe('faux serveur de l’aperçu (applyScreenEmit)', () => {
  const scenario = getScenario('sim-full-round');
  const start = scenario.initial;

  it('révéler la carte similaire ouvre l’arbitrage et diffuse la révélation', () => {
    const { state, events } = applyScreenEmit(scenario, start, 'revealAnswer', { answerIndex: 0 });
    expect(state.pending).toBe(0);
    expect(state.revealed).toEqual([0]);
    expect(events).toEqual([{ event: 'answerRevealed', data: { revealedIndex: 0, revealedIndices: [0], roundNumber: 1 } }]);
  });

  it('Oui valide la carte, Non la laisse fausse, une décision sans attente est ignorée', () => {
    const opened = applyScreenEmit(scenario, start, 'revealAnswer', { answerIndex: 0 }).state;
    expect(applyScreenEmit(scenario, opened, 'confirmSimilarity', { answerIndex: 0 }).state).toMatchObject({ pending: null, corrections: [0] });
    expect(applyScreenEmit(scenario, opened, 'dismissSimilarity', { answerIndex: 0 }).state).toMatchObject({ pending: null, corrections: [] });
    expect(applyScreenEmit(scenario, opened, 'confirmSimilarity', { answerIndex: 1 }).state).toBe(opened);
  });

  it('révéler une autre carte sans trancher vaut « Non » (comme le vrai serveur)', () => {
    const opened = applyScreenEmit(scenario, start, 'revealAnswer', { answerIndex: 0 }).state;
    const { state, log } = applyScreenEmit(scenario, opened, 'revealAnswer', { answerIndex: 1 });
    expect(state).toMatchObject({ pending: null, corrections: [], revealed: [0, 1] });
    expect(log).toContain('abandonnée');
  });

  it('relaie le curseur à distance et ignore une carte déjà révélée', () => {
    expect(applyScreenEmit(scenario, start, 'advanceRevealCursor', { nextIndex: 2 }).events)
      .toEqual([{ event: 'revealCursorAdvanced', data: { nextIndex: 2 } }]);
    const revealed = applyScreenEmit(scenario, start, 'revealAnswer', { answerIndex: 1 }).state;
    expect(applyScreenEmit(scenario, revealed, 'revealAnswer', { answerIndex: 1 }).state).toBe(revealed);
  });
});
