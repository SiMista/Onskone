import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useToast } from '../../components/Toast';
import { SectionHeader } from './content/SectionHeader';
import { ConfirmDialog } from './ConfirmDialog';
import {
  fetchVersionGate,
  setVersionGate,
  type VersionGateState,
} from '../../utils/adminDataApi';
import socket, {
  ACTUAL_APP_VERSION,
  getTestVersionOverride,
  setTestVersionOverride,
} from '../../utils/socket';

export const VersionGatePanel = ({
  onStateChange, onConfirmingChange,
}: {
  onStateChange?: (s: VersionGateState) => void;
  onConfirmingChange?: (confirming: boolean) => void;
}) => {
  const showToast = useToast();
  const [state, setState] = useState<VersionGateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'force' | 'disable' | null>(null);
  // Action à confirmer via la popup partagée (forcer ET désactiver).
  const [confirm, setConfirm] = useState<'force' | 'disable' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchVersionGate();
      setState(s);
      onStateChange?.(s);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, onStateChange]);

  useEffect(() => { load(); }, [load]);

  // Le parent (popover) masque son contenu pendant qu'une confirmation est ouverte.
  useEffect(() => { onConfirmingChange?.(confirm !== null); }, [confirm, onConfirmingChange]);

  const apply = useCallback(async (action: 'force_latest' | 'disable') => {
    setBusy(action === 'force_latest' ? 'force' : 'disable');
    try {
      const next = await setVersionGate(action);
      setState(next);
      onStateChange?.(next);
      showToast(
        action === 'force_latest'
          ? `Maj forcée : clients < ${next.minVersion} bloqués.`
          : 'Blocage levé.',
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setBusy(null);
    }
  }, [showToast, onStateChange]);

  const blocking = state?.blocking ?? false;
  const deployed = state?.deployedVersion || '?';

  return (
    <div>
      <SectionHeader title="Mise à jour forcée" />
      <p className="text-[13px] text-white/55 mb-4 max-w-2xl">
        Bloque au handshake les clients dont la version est inférieure au plancher.
        Ils voient l'écran « Mise à jour requise » jusqu'à ce qu'ils se mettent à jour.
        Le plancher est appliqué en direct (aucun redéploiement requis) et survit aux restarts.
      </p>

      {loading ? (
        <div className="rounded-lg surface-glass py-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">
          chargement…
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {/* État courant */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-lg surface-glass p-3">
              <p className="text-[12px] text-white/55">Version déployée</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums text-white">{deployed}</p>
            </div>
            <div className="rounded-lg surface-glass p-3">
              <p className="text-[12px] text-white/55">Statut</p>
              <p className={`mt-1 text-[16px] font-semibold flex items-center gap-2 ${blocking ? 'text-amber-300' : 'text-emerald-300'}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${blocking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                {blocking ? `Blocage actif (< ${state?.minVersion})` : 'Aucun blocage'}
              </p>
            </div>
          </div>

          {/* Actions 1-clic : le serveur décide le numéro (= version déployée) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setConfirm('force')}
              disabled={busy !== null || !state?.deployedVersion}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border font-mono text-[12px] tracking-wider transition-colors
                border-amber-400/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 hover:border-amber-400/60
                disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Icon icon={busy === 'force' ? 'mdi:loading' : 'mdi:shield-alert-outline'} className={`w-4 h-4 ${busy === 'force' ? 'animate-spin' : ''}`} />
              Forcer la maj vers {deployed}
            </button>

            <button
              type="button"
              onClick={() => setConfirm('disable')}
              disabled={busy !== null || !blocking}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border font-mono text-[12px] tracking-wider transition-colors
                border-white/[0.08] bg-transparent text-white/60 hover:text-white/90 hover:border-white/20
                disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <Icon icon={busy === 'disable' ? 'mdi:loading' : 'mdi:lock-open-variant-outline'} className={`w-4 h-4 ${busy === 'disable' ? 'animate-spin' : ''}`} />
              Désactiver le blocage
            </button>
          </div>

          <p className="text-[11px] text-white/35">
            « Forcer » pose le plancher = version déployée : action volontaire et à fort impact (tous
            les clients antérieurs sont coupés). Vérifie que la nouvelle version est bien publiée sur
            les stores avant de bloquer les versions mobiles.
          </p>

          {import.meta.env.DEV && <TestZone deployed={deployed} />}
        </div>
      )}

      {/* Portal vers <body> : la confirmation échappe au sous-arbre de la popover
          (qui est masquée pendant ce temps) et se centre sur tout l'écran. */}
      {confirm === 'force' && createPortal(
        <ConfirmDialog
          title={`Forcer la maj vers ${deployed} ?`}
          message={`Tous les joueurs sur une version inférieure à ${deployed} seront immédiatement bloqués jusqu'à ce qu'ils mettent à jour.`}
          confirmLabel="Forcer la maj"
          onConfirm={() => { setConfirm(null); apply('force_latest'); }}
          onCancel={() => setConfirm(null)}
        />,
        document.body,
      )}
      {confirm === 'disable' && createPortal(
        <ConfirmDialog
          title="Lever le blocage ?"
          message="Tous les joueurs pourront à nouveau se connecter, quelle que soit leur version."
          confirmLabel="Désactiver"
          onConfirm={() => { setConfirm(null); apply('disable'); }}
          onCancel={() => setConfirm(null)}
        />,
        document.body,
      )}
    </div>
  );
};

// Outil de test DEV-only : fait annoncer à CE navigateur une fausse version pour
// voir l'écran "Mise à jour requise". N'affecte que ce navigateur (localStorage).
const TestZone = ({ deployed }: { deployed: string }) => {
  const [override, setOverride] = useState<string | null>(() => getTestVersionOverride());
  const [draft, setDraft] = useState('1.0.0');

  const applyOverride = () => {
    const v = draft.trim();
    if (!v) return;
    setTestVersionOverride(v);
    setOverride(v);
    // Reconnexion du socket : il réannonce la fausse version (auth réévalué), ce qui
    // déclenche le gate sans changer de page.
    socket.disconnect();
    socket.connect();
  };

  const reset = () => {
    setTestVersionOverride(null);
    setOverride(null);
    socket.disconnect();
    socket.connect();
  };

  return (
    <div className="rounded-lg border border-dashed border-fuchsia-400/30 bg-fuchsia-500/[0.04] p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon="mdi:flask-outline" className="w-4 h-4 text-fuchsia-300" />
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-fuchsia-200">zone de test · dev</p>
      </div>
      <p className="text-[12px] text-white/55">
        Simule une version client (ce navigateur uniquement) pour voir l'écran de blocage.
        Version réelle du build : <span className="font-mono text-white/75">{ACTUAL_APP_VERSION}</span>.
        Pour être bloqué, mets une valeur &lt; au plancher (déployé : {deployed}).
      </p>

      {override && (
        <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-400/30 px-2.5 py-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[12px] text-amber-100">
            Override actif : ce navigateur annonce <span className="font-mono font-bold">{override}</span>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="1.0.0"
          className="bg-[#0f1117] text-white/85 border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] font-mono w-28
            focus:outline-none focus:border-fuchsia-400/60 hover:border-white/20 transition-colors placeholder:text-white/25"
        />
        <button
          type="button"
          onClick={applyOverride}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border font-mono text-[12px] tracking-wider transition-colors
            border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20 hover:border-fuchsia-400/60 cursor-pointer"
        >
          <Icon icon="mdi:play" className="w-4 h-4" />
          Appliquer
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!override}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border font-mono text-[12px] tracking-wider transition-colors
            border-white/[0.08] bg-transparent text-white/60 hover:text-white/90 hover:border-white/20
            disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Icon icon="mdi:backup-restore" className="w-4 h-4" />
          Réinitialiser
        </button>
      </div>
    </div>
  );
};
