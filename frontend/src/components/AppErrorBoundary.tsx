import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocale } from '../i18n';
import { reportClientLog, describeError } from '../utils/clientLog';
import Button from './Button';
import ReportTrigger from './ReportTrigger';

// Filet global : une exception au rendu (chunk lazy introuvable après une mise à
// jour, donnée inattendue…) démontait tout l'arbre React -> page blanche sans
// aucune action possible. Ici on affiche un écran de secours avec un retour à
// l'accueil (rechargement complet : repart sur le dernier bundle déployé).

const Fallback = ({ onHome, details }: { onHome: () => void; details: string }) => {
  const { t } = useLocale();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="bg-white rounded-xl card-paper stack-shadow px-6 py-8 max-w-md w-full space-y-4">
        <p className="text-display-lg text-gray-900">{t.app.crashTitle}</p>
        <p className="text-sm text-gray-600">{t.app.crashBody}</p>
        <Button text={t.app.crashHome} variant="primary" size="md" onClick={onHome} />
        {/* Le crash est exactement le moment où l'on veut un signalement : le contexte
            (message + composants) arrive pré-rempli dans le ticket. */}
        <ReportTrigger variant="discreet" label={t.report.title} defaultType="bug" extraContext={details} />
      </div>
    </div>
  );
};

interface State { crashed: boolean; details: string }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { crashed: false, details: '' };

  static getDerivedStateFromError(error: Error): State {
    return { crashed: true, details: `Crash: ${error.message || 'Erreur de rendu'}` };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // La stack de composants n'existe qu'ici : on l'ajoute au contexte du signalement.
    this.setState((s) => ({ details: `${s.details}\nComposants:${info.componentStack?.slice(0, 600) ?? ''}` }));
    reportClientLog('render', error.message || 'Erreur de rendu', { ...describeError(error), componentStack: info.componentStack });
  }

  private goHome = (): void => {
    // Rechargement complet plutôt qu'une navigation : l'arbre est dans un état
    // inconnu, et un bundle périmé (chunk manquant) ne se répare qu'en rechargeant.
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.crashed) return <Fallback onHome={this.goHome} details={this.state.details} />;
    return this.props.children;
  }
}
