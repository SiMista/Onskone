import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LocaleProvider, useLocale } from '../i18n';
import MentionsModal from './Footer/MentionsModal';

afterEach(cleanup);

/** Expose le dictionnaire courant pour ne pas dépendre de la langue du navigateur de test. */
let t!: ReturnType<typeof useLocale>['t'];
const Probe = () => { t = useLocale().t; return null; };

const renderModal = (initialTab?: 'cgu' | 'mentions' | 'privacy') =>
  render(
    <LocaleProvider>
      <Probe />
      <MentionsModal isOpen onClose={() => {}} initialTab={initialTab} />
    </LocaleProvider>,
  );

const tab = (label: string) => screen.getByRole('button', { name: label });

describe('MentionsModal', () => {
  it('s\'ouvre sur CGU par défaut, ou sur l\'onglet demandé (ex. depuis le paywall)', () => {
    renderModal();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(t.legal.cgu.title);
    cleanup();
    renderModal('privacy');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(t.legal.privacy.title);
  });

  it('enchaîne les 3 onglets dans tous les sens sans planter (régression crash React #185)', () => {
    renderModal();
    const order = ['privacy', 'mentions', 'cgu', 'privacy', 'cgu', 'mentions', 'mentions'] as const;
    for (const id of order) {
      fireEvent.click(tab(t.legal.tabs[id]));
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(t.legal[id].title);
    }
  });

  it('affiche TOUTES les sections de l\'onglet courant', () => {
    renderModal('privacy');
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(t.legal.privacy.sections.map((s) => s.title));
  });

  it('un lien interne du texte légal bascule d\'onglet au lieu de naviguer', () => {
    const PATHS: Record<string, 'cgu' | 'mentions' | 'privacy'> = { '/cgu': 'cgu', '/mentions': 'mentions', '/privacy': 'privacy' };
    let checked = 0;
    for (const start of ['cgu', 'mentions'] as const) {
      renderModal(start);
      const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .find((a) => PATHS[a.getAttribute('href') ?? ''] && PATHS[a.getAttribute('href') ?? ''] !== start);
      if (link) {
        const target = PATHS[link.getAttribute('href')!];
        expect(fireEvent.click(link)).toBe(false); // preventDefault : pas de navigation (WebView natif)
        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(t.legal[target].title);
        checked++;
      }
      cleanup();
    }
    // Si le texte légal perd ses renvois entre onglets, ce garde-fou le signale.
    expect(checked).toBeGreaterThan(0);
  });

  it('le corps scrollable casse les mots trop longs (régression scroll horizontal Confidentialité)', () => {
    renderModal('privacy');
    const scrollBody = Array.from(document.querySelectorAll('div')).find((d) => d.className.includes('overflow-y-auto'));
    expect(scrollBody?.className).toContain('break-words');
  });
});
