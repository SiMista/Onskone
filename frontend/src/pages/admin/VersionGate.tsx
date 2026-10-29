import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useToast } from '../../components/Toast';
import { DangerCard, DangerButton } from './DangerCard';
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
import { IOS_RELEASE_GRACE_MS } from '../../utils/versionPolicy';
import { formatDate } from './shared';

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
          ? `Maj forcée : plancher ${next.minVersion}, appliqué à la prochaine (re)connexion de chaque joueur.`
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
  // Déjà forcé à CETTE version : « Forcer » ne ferait rien, seul « Désactiver » reste actif.
  const alreadyForced = blocking && state?.minVersion === state?.deployedVersion;
  const appStore = state?.appStore ?? null;
  const appStoreReleasedAt = appStore ? Date.parse(appStore.releasedAt) : NaN;
  // Même délai que les iPhone (versionPolicy.ts) : avant, ils ne sont pas invités à mettre à jour.
  const appStoreInGrace = Number.isFinite(appStoreReleasedAt) && Date.now() - appStoreReleasedAt < IOS_RELEASE_GRACE_MS;

  return (
    <div>
      <DangerCard
        tone="violet"
        icon="mdi:cellphone-arrow-down"
        title="Mise à jour forcée"
        summary="Oblige les joueurs sous la dernière version à se mettre à jour, seulement s'ils le peuvent."
        status={state ? { tone: blocking ? 'alert' : 'ok', label: blocking ? `Active (< ${state.minVersion})` : 'Aucun blocage' } : null}
        loading={loading}
        details={(
          <>
            <p>
              Un joueur sous le plancher voit l'écran « Mise à jour requise » seulement si une version plus récente
              lui est réellement disponible : son store sur mobile, un rechargement sur le web. Celui qui a déjà la
              dernière version qu'il peut obtenir n'est jamais bloqué.
            </p>
            <p>
              Appliqué à la prochaine connexion <strong className="text-white/70">ou reconnexion</strong> de chaque
              joueur, y compris une reconnexion automatique en pleine partie (téléphone verrouillé, réseau) : à faire
              quand personne ne joue. Survit aux restarts.
            </p>
            <p>
              « Forcer » pose le plancher = version déployée. Chaque appareil vérifie lui-même son store : si le store
              est en retard (review Apple, rollout progressif, hotfix d'une seule plateforme), ses joueurs ne sont pas
              bloqués. Les anciennes apps mobiles, sans cette vérification, ne sont jamais bloquées. « Désactiver »
              libère tout le monde en direct.
            </p>
            <p>Play Store : chaque téléphone Android interroge Google lui-même (pas de version publique côté Google).</p>
          </>
        )}
      >
        <dl className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl surface-glass p-3">
            <dt className="text-[12px] text-white/55">Version déployée</dt>
            <dd className="mt-1 text-[20px] font-semibold tabular-nums text-white">{deployed}</dd>
          </div>
          <div className="rounded-xl surface-glass p-3">
            <dt className="text-[12px] text-white/55">App Store</dt>
            <dd className="mt-1 text-[20px] font-semibold tabular-nums text-white">{appStore?.version || '?'}</dd>
            {appStore && Number.isFinite(appStoreReleasedAt) && (
              <p className="mt-0.5 text-[11px] text-white/40">depuis le {formatDate(appStoreReleasedAt)}</p>
            )}
          </div>
        </dl>
        {appStoreInGrace && (
          <p className="text-[12px] text-amber-200/80">
            Sortie il y a moins de 24 h : les iPhone ne seront invités à la prendre qu'après ce délai.
          </p>
        )}

        {/* Actions 1-clic : le serveur décide le numéro (= version déployée).
            Bloqué => « Désactiver » devient l'action principale. */}
        <div className="flex flex-col sm:flex-row gap-3">
          {blocking && (
            <DangerButton variant="safe" icon="mdi:lock-open-variant-outline" busy={busy === 'disable'} disabled={busy !== null} onClick={() => setConfirm('disable')}>
              Désactiver le blocage
            </DangerButton>
          )}
          <DangerButton
            variant={blocking ? 'ghost' : 'warning'}
            icon="mdi:shield-alert-outline"
            busy={busy === 'force'}
            disabled={busy !== null || !state?.deployedVersion || alreadyForced}
            onClick={() => setConfirm('force')}
          >
            {alreadyForced ? `Maj forcée vers ${deployed}` : `Forcer la maj vers ${deployed}`}
          </DangerButton>
        </div>

        {import.meta.env.DEV && <TestZone deployed={deployed} />}
      </DangerCard>

      {/* Portal vers <body> : la confirmation échappe au sous-arbre de la popover
          (qui est masquée pendant ce temps) et se centre sur tout l'écran. */}
      {confirm === 'force' && createPortal(
        <ConfirmDialog
          title={`Forcer la maj vers ${deployed} ?`}
          message={`À leur prochaine connexion, les joueurs sous ${deployed} devront mettre à jour, seulement si une version plus récente leur est disponible. Personne n'est bloqué sans pouvoir se mettre à jour.`}
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
