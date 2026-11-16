import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { SimilarityComparison } from '@onskone/shared';
import { LocaleProvider } from '../i18n';
import SimilarityPopover from './SimilarityPopover';

// Carte de Bob révélée (écrite par Alice) ; ce que Bob a vraiment écrit est posé devant Charlie.
const toCharlie: SimilarityComparison = { comparedIndex: 1, comparedAnswer: 'Pizzas', holderId: 'charlie', holderName: 'Charlie' };

const renderPopover = (props: Partial<Parameters<typeof SimilarityPopover>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onDismiss = vi.fn();
  render(
    <LocaleProvider>
      <SimilarityPopover
        comparison={toCharlie}
        leaderId="pilier"
        remote={false}
        isLeader
        onConfirm={onConfirm}
        onDismiss={onDismiss}
        {...props}
      />
    </LocaleProvider>,
  );
  return { onConfirm, onDismiss };
};

describe('SimilarityPopover', () => {
  beforeEach(() => { localStorage.setItem('onskone:locale', 'fr'); });
  afterEach(() => { cleanup(); localStorage.clear(); });

  it("cite le téléphone où est posée la réponse comparée, avec son texte (pas la vraie autrice de la carte)", () => {
    renderPopover();
    expect(screen.getByText(/Même réponse que sur l'écran de/).textContent).toBe("Même réponse que sur l'écran de Charlie\u00a0?");
    expect(screen.getByText('« Pizzas »')).toBeTruthy();
  });

  it("élide devant une voyelle : « l'écran d'Alice »", () => {
    renderPopover({ comparison: { ...toCharlie, holderId: 'alice', holderName: 'Alice' } });
    expect(screen.getByText(/Même réponse que sur l'écran/).textContent).toBe("Même réponse que sur l'écran d'Alice\u00a0?");
  });

  it('recopie la carte jugée quand l’écran du pilier ne la montre pas', () => {
    renderPopover({ cardAnswer: 'Pizza' });
    expect(screen.getByText('« Pizza »')).toBeTruthy();
    expect(screen.getByText('« Pizzas »')).toBeTruthy();
  });

  it('à distance : « la carte donnée à »', () => {
    renderPopover({ remote: true });
    expect(screen.getByText(/la carte donnée à/).textContent).toBe('Même réponse que la carte donnée à Charlie\u00a0?');
  });

  it('carte gardée par le pilier, ou donnée à personne', () => {
    renderPopover({ comparison: { ...toCharlie, holderId: 'pilier', holderName: 'Pilier' } });
    // getByText normalise les espaces (l'insécable devient une espace) : textContent garde la vraie.
    expect(screen.getByText(/tu t'es donnée/).textContent).toBe("Même réponse que la carte que tu t'es donnée\u00a0?");
    cleanup();
    renderPopover({ comparison: { ...toCharlie, holderId: '', holderName: 'Aucun' } });
    expect(screen.getByText(/celle-ci/).textContent).toBe('Même réponse que celle-ci\u00a0?');
    expect(screen.getByText('« Pizzas »')).toBeTruthy();
  });

  it('Oui / Non appellent la bonne décision', () => {
    const { onConfirm, onDismiss } = renderPopover();
    fireEvent.click(screen.getByText('Oui'));
    fireEvent.click(screen.getByText('Non'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
