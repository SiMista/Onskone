import { useLocation } from 'react-router-dom';
import { useLocale } from '../i18n';
import { useMaintenance } from '../utils/maintenance';
import { MaintenanceCard } from './MaintenanceCard';

// Pages qui restent accessibles pendant une maintenance : l'admin (c'est de là qu'on la
// lève), le studio dev et les pages légales (obligatoires, sans rapport avec le jeu).
const EXEMPT_PREFIXES = ['/admin', '/studio', '/privacy', '/mentions', '/cgu', '/support'];

// Écran bloquant non-fermable. 'new_games' laisse les parties en cours finir (la route
// /game/ et la popup de reprise de l'accueil sont épargnées) ; 'all', la panne
// serveur et le serveur injoignable (réseau du joueur) couvrent tout le monde.
const MaintenanceOverlay = () => {
  const { t } = useLocale();
  const { state, serverDown, unreachable, resumeOffered } = useMaintenance();
  const { pathname } = useLocation();

  if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const inGame = pathname.startsWith('/game/');
  const blockedByAdmin = state.active && (state.mode === 'all' || !(inGame || resumeOffered));
  if (!serverDown && !unreachable && !blockedByAdmin) return null;

  // Panne serveur certaine > serveur injoignable (réseau) > maintenance posée par l'admin.
  const copy = serverDown
    ? { title: t.maintenance.downTitle, message: t.maintenance.downMessage }
    : unreachable
      ? { title: t.maintenance.unreachableTitle, message: t.maintenance.unreachableMessage }
      : { title: t.maintenance.title, message: t.maintenance.message };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-brand-backdrop">
      <MaintenanceCard
        title={copy.title}
        message={copy.message}
        note={inGame ? `${t.maintenance.gameKept} ${t.maintenance.autoResume}` : t.maintenance.autoResume}
      />
    </div>
  );
};

export default MaintenanceOverlay;
