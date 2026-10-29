import { useLocation } from 'react-router-dom';
import { useLocale } from '../i18n';
import { useVersionBlock, openUpdate, isNativeUpdate } from '../utils/versionGate';
import { getTestVersionOverride, setTestVersionOverride } from '../utils/socket';
import { UpdateRequiredCard } from './UpdateRequiredCard';

// Écran bloquant non-fermable affiché quand le serveur a refusé la connexion
// parce que l'app est trop vieille (maj forcée). Couvre toute l'UI : tant que le
// joueur n'a pas mis à jour, il ne peut rien faire d'autre.
const UpdateRequiredModal = () => {
  const { t } = useLocale();
  const block = useVersionBlock();
  const { pathname } = useLocation();

  if (!block) return null;

  // Le back-office (et le studio dev) doivent rester accessibles MÊME quand le
  // gate bloque le jeu : c'est depuis /admin qu'on lève la maj forcée. Sinon,
  // poser un plancher trop haut se verrouillerait soi-même hors de l'admin.
  if (pathname.startsWith('/admin') || pathname.startsWith('/studio')) return null;

  // Échappatoire DEV : si le blocage vient d'un override de TEST (cf. socket.ts),
  // l'écran couvre aussi /admin -> on offre un bouton pour le retirer et recharger.
  const testOverride = import.meta.env.DEV ? getTestVersionOverride() : null;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 p-6 bg-brand-backdrop">
      <UpdateRequiredCard
        title={t.update.title}
        message={t.update.message}
        ctaLabel={isNativeUpdate() ? t.update.cta : t.update.ctaWeb}
        onAction={() => { void openUpdate(); }}
      />
      {testOverride && (
        <button
          type="button"
          onClick={() => { setTestVersionOverride(null); window.location.reload(); }}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/70 hover:text-white border border-white/30 hover:border-white/60 rounded-md px-3 py-1.5 transition-colors"
        >
          ⟲ Retirer l'override de test ({testOverride})
        </button>
      )}
    </div>
  );
};

export default UpdateRequiredModal;
