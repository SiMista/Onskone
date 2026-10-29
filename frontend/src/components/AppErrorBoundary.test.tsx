import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../i18n';
import { ToastProvider } from './Toast';
import { AppErrorBoundary } from './AppErrorBoundary';

const reportClientLog = vi.fn();
vi.mock('../utils/clientLog', () => ({
  reportClientLog: (...args: unknown[]) => reportClientLog(...args),
  describeError: (e: unknown) => ({ name: (e as Error).name, message: (e as Error).message }),
}));

const Bomb = ({ explode }: { explode: boolean }) => {
  if (explode) throw new Error('Minified React error #185');
  return <p>tout va bien</p>;
};

// Même arbre que App.tsx : le Router est AU-DESSUS du boundary (ReportModal lit la route).
const renderApp = (explode: boolean) =>
  render(
    <ToastProvider>
      <LocaleProvider>
        <MemoryRouter>
          <AppErrorBoundary>
            <Bomb explode={explode} />
          </AppErrorBoundary>
        </MemoryRouter>
      </LocaleProvider>
    </ToastProvider>,
  );

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    reportClientLog.mockClear();
    // React logge l'erreur interceptée : on évite le bruit dans la sortie des tests.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('laisse passer les enfants quand tout va bien', () => {
    renderApp(false);
    expect(screen.getByText('tout va bien')).toBeTruthy();
  });

  it('affiche l\'écran de secours au lieu d\'une page blanche', () => {
    renderApp(true);
    expect(screen.queryByText('tout va bien')).toBeNull();
    // Retour accueil + signalement : au moins 2 actions possibles pour le joueur.
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
  });

  it('propose de signaler le problème, et ouvre la modale de signalement', () => {
    renderApp(true);
    const report = screen.getAllByRole('button').find((b) => /signaler|report/i.test(b.textContent ?? ''));
    expect(report).toBeTruthy();
    fireEvent.click(report!);
    // La modale (portal) contient le champ de message du ticket.
    expect(document.body.querySelector('textarea')).not.toBeNull();
  });

  it('remonte le crash au serveur (onglet Logs de l\'admin)', () => {
    renderApp(true);
    expect(reportClientLog).toHaveBeenCalledWith(
      'render',
      'Minified React error #185',
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });
});
