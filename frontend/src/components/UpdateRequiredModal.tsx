import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useLocale } from '../i18n';
import { useVersionBlock, openUpdate, isNativeUpdate } from '../utils/versionGate';
import { getTestVersionOverride, setTestVersionOverride } from '../utils/socket';
import { UpdateRequiredCard } from './UpdateRequiredCard';
import ReportModal from './ReportModal';

// Écran bloquant non-fermable affiché quand le serveur a refusé la connexion
// parce que l'app est trop vieille (maj forcée). Couvre toute l'UI : tant que le
// joueur n'a pas mis à jour, il ne peut rien faire d'autre.
const UpdateRequiredModal = () => {
  const { t } = useLocale();
  const block = useVersionBlock();
  const { pathname } = useLocation();
  const [reporting, setReporting] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  if (!block) return null;

  // Le back-office (et le studio dev) doivent rester accessibles MÊME quand le
  // gate bloque le jeu : c'est depuis /admin qu'on lève la maj forcée. Sinon,
  // poser un plancher trop haut se verrouillerait soi-même hors de l'admin.
  if (pathname.startsWith('/admin') || pathname.startsWith('/studio')) return null;

  // Échappatoire DEV : si le blocage vient d'un override de TEST (cf. socket.ts),
  // l'écran couvre aussi /admin -> on offre un bouton pour le retirer et recharger.
  const testOverride = import.meta.env.DEV ? getTestVersionOverride() : null;

  // Signalement depuis l'écran bloquant (joueur coincé : store qui ne propose pas
  // la maj, boucle de blocage…), en modale PAR-DESSUS l'écran. Les modales (z-50),
  // leurs listes déroulantes et les toasts (z-100) vivent sous z-[1000] : le temps
  // du signalement, l'écran descend donc juste sous la couche des modales (z-[45])
  // au lieu de disparaître, ce qui laisse passer la modale, sa liste et un toast
  // d'erreur sans toucher aux z-index du reste de l'app. À la fermeture, il
  // remonte à z-[1000] et recouvre le toast de succès : la confirmation s'affiche
  // donc aussi ici.
  return (
    <div className={`fixed inset-0 ${reporting ? 'z-[45]' : 'z-[1000]'} flex flex-col items-center justify-center gap-4 p-6 bg-brand-backdrop`}>
      <UpdateRequiredCard
        title={t.update.title}
        message={t.update.message}
        ctaLabel={isNativeUpdate() ? t.update.cta : t.update.ctaWeb}
        onAction={() => { void openUpdate(); }}
      />
      {reportSent ? (
        <p className="font-sans text-sm text-white/80 text-center">{t.update.reportSent}</p>
      ) : (
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex items-center gap-1.5 font-sans text-sm text-white/75 hover:text-white underline underline-offset-2 cursor-pointer transition-colors"
        >
          <Icon icon="ph:warning-bold" className="w-3.5 h-3.5" aria-hidden />
          {t.update.report}
        </button>
      )}
      {testOverride && (
        <button
          type="button"
          onClick={() => { setTestVersionOverride(null); window.location.reload(); }}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/70 hover:text-white border border-white/30 hover:border-white/60 rounded-md px-3 py-1.5 transition-colors"
        >
          ⟲ Retirer l'override de test ({testOverride})
        </button>
      )}
      {reporting && (
        <ReportModal
          isOpen
          onClose={() => setReporting(false)}
          onSent={() => setReportSent(true)}
          defaultType="bug"
          extraContext="Depuis l'écran « Mise à jour requise »"
        />
      )}
    </div>
  );
};

export default UpdateRequiredModal;
