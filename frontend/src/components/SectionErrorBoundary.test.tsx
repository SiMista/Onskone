import { Component } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { LocaleProvider } from '../i18n';
import { SectionErrorBoundary } from './SectionErrorBoundary';

const reportClientLog = vi.fn();
vi.mock('../utils/clientLog', () => ({
  reportClientLog: (...args: unknown[]) => reportClientLog(...args),
  describeError: (e: unknown) => ({ name: (e as Error).name, message: (e as Error).message }),
}));

// Interrupteur explicite : React 18 re-rend un composant qui throw (retry
// synchrone), un compteur de rendus ne serait donc pas fiable.
let broken = true;
const Flaky = ({ message = 'boom' }: { message?: string }) => {
  if (broken) throw new Error(message);
  return <p>contenu ok</p>;
};

const wrap = (ui: React.ReactNode) => <LocaleProvider>{ui}</LocaleProvider>;

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('SectionErrorBoundary', () => {
  beforeEach(() => {
    broken = true;
    reportClientLog.mockReset();
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('se remonte tout seul après un crash transitoire, sans rien afficher au joueur', () => {
    // La panne cesse au moment où le boundary logge : le remontage immédiat passe.
    reportClientLog.mockImplementationOnce(() => { broken = false; });
    render(wrap(<SectionErrorBoundary name="t"><Flaky /></SectionErrorBoundary>));
    expect(screen.getByText('contenu ok')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(reportClientLog).toHaveBeenCalledWith('render.section', 'boom', expect.objectContaining({ section: 't', gaveUp: false }), 'warn');
  });

  it('crash qui persiste : écran d\'attente SANS bouton, puis réessai auto (avec onRetry) qui récupère', () => {
    const onRetry = vi.fn(() => { broken = false; }); // ex. resync serveur qui guérit l'état
    render(wrap(<SectionErrorBoundary name="t" fallback="card" onRetry={onRetry}><Flaky /></SectionErrorBoundary>));
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(onRetry).not.toHaveBeenCalled();
    advance(1500);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText('contenu ok')).toBeTruthy();
  });

  it('réessaie plusieurs fois avec un délai croissant, puis renonce et propose les boutons', () => {
    const onRetry = vi.fn();
    render(wrap(<SectionErrorBoundary name="t" fallback="card" onRetry={onRetry}><Flaky /></SectionErrorBoundary>));
    advance(1500);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    advance(4000);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    advance(8000);
    expect(onRetry).toHaveBeenCalledTimes(3);
    // Plus de tentative auto : boutons Réessayer + Accueil, et un log « gaveUp ».
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(reportClientLog).toHaveBeenLastCalledWith('render.section', 'boom', expect.objectContaining({ gaveUp: true }), 'error');
    advance(60000);
    expect(onRetry).toHaveBeenCalledTimes(3);
    // Réessayer à la main relance tout.
    broken = false;
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onRetry).toHaveBeenCalledTimes(4);
    expect(screen.getByText('contenu ok')).toBeTruthy();
  });

  it('fallback silent : la zone disparaît, sans bouton ni tentative', () => {
    const onRetry = vi.fn();
    const { container } = render(wrap(<SectionErrorBoundary name="t" fallback="silent" onRetry={onRetry}><Flaky /></SectionErrorBoundary>));
    expect(container.textContent).toBe('');
    advance(60000);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('se réinitialise quand resetKeys change', () => {
    const { rerender } = render(wrap(<SectionErrorBoundary name="t" fallback="card" resetKeys={[1]}><Flaky /></SectionErrorBoundary>));
    expect(screen.queryByText('contenu ok')).toBeNull();
    broken = false;
    rerender(wrap(<SectionErrorBoundary name="t" fallback="card" resetKeys={[2]}><Flaky /></SectionErrorBoundary>));
    expect(screen.getByText('contenu ok')).toBeTruthy();
  });

  it('relaie une erreur de chunk périmé au boundary parent', () => {
    const parent = vi.fn();
    class Parent extends Component<{ children: React.ReactNode }, { e: boolean }> {
      state = { e: false };
      static getDerivedStateFromError() { return { e: true }; }
      componentDidCatch(err: Error) { parent(err.message); }
      render() { return this.state.e ? <p>parent a pris</p> : this.props.children; }
    }
    render(wrap(
      <Parent>
        <SectionErrorBoundary name="t" fallback="card">
          <Flaky message="Failed to fetch dynamically imported module: /x.js" />
        </SectionErrorBoundary>
      </Parent>,
    ));
    expect(screen.getByText('parent a pris')).toBeTruthy();
    expect(parent).toHaveBeenCalled();
  });
});
