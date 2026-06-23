import { useLocale } from '../i18n';
import { useVersionBlock, openUpdate, isNativeUpdate } from '../utils/versionGate';
import { getTestVersionOverride, setTestVersionOverride } from '../utils/socket';
import { UpdateRequiredCard } from './UpdateRequiredCard';
import interrogationBg from '../assets/images/interrogation_bg_transparent.png';

// Reprend le fond signature du site (cf. body dans index.css) : texture "points
// d'interrogation" tuilée + dégradé bleu -> cyan. L'overlay étant bloquant, on
// ajoute par-dessus un léger voile sombre (1re couche) pour donner de la
// profondeur et signaler que l'écran est "fermé" sans casser l'identité bleue.
const BRAND_BACKDROP: React.CSSProperties = {
  background: [
    'linear-gradient(rgba(8,26,46,0.34), rgba(8,26,46,0.34))',
    `url(${interrogationBg}) repeat`,
    'linear-gradient(to bottom, rgba(31,93,144,1), rgba(24,187,237,1))',
  ].join(', '),
  backgroundSize: 'auto, 280px 340px, auto',
};

// Écran bloquant non-fermable affiché quand le serveur a refusé la connexion
// parce que l'app est trop vieille (maj forcée). Couvre toute l'UI : tant que le
// joueur n'a pas mis à jour, il ne peut rien faire d'autre.
const UpdateRequiredModal = () => {
  const { t } = useLocale();
  const block = useVersionBlock();

  if (!block) return null;

  // Échappatoire DEV : si le blocage vient d'un override de TEST (cf. socket.ts),
  // l'écran couvre aussi /admin -> on offre un bouton pour le retirer et recharger.
  const testOverride = import.meta.env.DEV ? getTestVersionOverride() : null;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 p-6" style={BRAND_BACKDROP}>
      <UpdateRequiredCard
        title={t.update.title}
        message={t.update.message}
        ctaLabel={isNativeUpdate() ? t.update.cta : t.update.ctaWeb}
        onAction={openUpdate}
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
