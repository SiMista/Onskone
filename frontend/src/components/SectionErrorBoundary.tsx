import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocale } from '../i18n';
import { reportClientLog, describeError } from '../utils/clientLog';
import Button from './Button';
import Spinner from './Spinner';

// Boundary local : une exception de rendu dans une zone (phase de jeu, overlay…)
// ne démonte que cette zone, pas toute l'app (header, socket, score restent en
// place ; AppErrorBoundary reste le dernier filet). Le joueur n'a RIEN à faire :
//   1. 1er crash : remontage immédiat et silencieux (état transitoire).
//   2. crash qui se répète : écran d'attente (« on recolle les morceaux ») pendant
//      que le boundary réessaie seul, avec délais croissants et `onRetry` à chaque
//      tentative (ex. resync serveur, qui guérit un état client incohérent).
//   3. toutes les tentatives échouées : seulement là, boutons Réessayer / Accueil.
//   `silent` (décor, overlay) : la zone disparaît, sans écran ni tentative.
// `resetKeys` change (nouvelle manche/phase…) : on repart de zéro. Les erreurs de
// chunk périmé sont relayées au boundary parent : seul un rechargement les répare.

const MAX_AUTO_RETRIES = 1;
/** Délais (ms) avant chaque tentative automatique, une fois l'écran d'attente affiché. */
const BACKOFF_MS = [1500, 4000, 8000] as const;
const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i;

const isChunkError = (error: Error): boolean => CHUNK_ERROR.test(`${error.name} ${error.message}`);

const sameKeys = (a: readonly unknown[] = [], b: readonly unknown[] = []): boolean =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

const goHome = (): void => {
  // Rechargement complet (même logique qu'AppErrorBoundary).
  window.location.href = '/';
};

const RecoveringFallback = () => {
  const { t } = useLocale();
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-center px-4 py-6" role="status">
      <Spinner className="h-8 w-8 text-brand-500" />
      <p className="text-display-md text-gray-800">{t.app.sectionRecovering}</p>
    </div>
  );
};

const GaveUpFallback = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useLocale();
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-center px-4 py-6">
      <p className="text-display-md text-gray-800">{t.app.sectionCrashTitle}</p>
      <p className="text-sm text-gray-600">{t.app.sectionCrashBody}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button text={t.app.sectionCrashRetry} variant="primary" size="md" onClick={onRetry} />
        <Button text={t.app.crashHome} variant="ghost" size="md" onClick={goHome} />
      </div>
    </div>
  );
};

interface Props {
  children: ReactNode;
  /** Nom de la zone, ajouté aux logs (« game.phase », « game.guessingIntro »…). */
  name: string;
  /** `silent` : la zone disparaît (décor, overlay) ; `card` : écran d'attente + réessais automatiques. */
  fallback?: 'silent' | 'card';
  /** Quand l'un d'eux change, le boundary se réinitialise (ex. manche + phase). */
  resetKeys?: readonly unknown[];
  /** Appelé avant chaque remontage non immédiat, auto ou manuel (ex. resynchronisation serveur). */
  onRetry?: () => void;
}

interface State { error: Error | null; autoRetries: number; recoveries: number }

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null, autoRetries: 0, recoveries: 0 };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private logged = false;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Chunk périmé : le parent s'en charge (cf. render), inutile de le logger deux fois.
    if (isChunkError(error)) return;
    const { autoRetries, recoveries } = this.state;
    const instant = autoRetries < MAX_AUTO_RETRIES;
    const exhausted = !instant && recoveries >= BACKOFF_MS.length;
    // Un log au 1er crash, un au renoncement : pas un par tentative (plafond d'envois).
    if (!this.logged || exhausted) {
      this.logged = true;
      reportClientLog(
        'render.section',
        error.message || 'Erreur de rendu',
        { ...describeError(error), section: this.props.name, gaveUp: exhausted, componentStack: info.componentStack?.slice(0, 600) },
        exhausted ? 'error' : 'warn',
      );
    }
    if (instant) {
      this.setState({ error: null, autoRetries: autoRetries + 1 });
    } else if (!exhausted && this.props.fallback !== 'silent') {
      this.clearTimer();
      this.timer = setTimeout(() => {
        this.timer = null;
        this.props.onRetry?.();
        this.setState((s) => ({ error: null, recoveries: s.recoveries + 1 }));
      }, BACKOFF_MS[recoveries]);
    }
  }

  componentDidUpdate(prev: Props): void {
    if (!sameKeys(prev.resetKeys, this.props.resetKeys)) this.reset();
  }

  componentWillUnmount(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private reset(): void {
    this.clearTimer();
    this.logged = false;
    this.setState({ error: null, autoRetries: 0, recoveries: 0 });
  }

  private manualRetry = (): void => {
    this.props.onRetry?.();
    this.reset();
  };

  render(): ReactNode {
    const { error, recoveries } = this.state;
    if (!error) return this.props.children;
    if (isChunkError(error)) throw error;
    if (this.props.fallback === 'silent') return null;
    return recoveries < BACKOFF_MS.length ? <RecoveringFallback /> : <GaveUpFallback onRetry={this.manualRetry} />;
  }
}
