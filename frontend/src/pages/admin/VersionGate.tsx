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
          ? `Mise à jour obligatoire activée : version minimum ${next.minVersion}, appliquée à la prochaine connexion de chaque joueur.`
          : 'Mise à jour obligatoire désactivée : toutes les versions peuvent jouer.',
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
        title="Mise à jour obligatoire"
        summary="Oblige les joueurs qui ont une vieille version à mettre à jour l'app, seulement si la nouvelle est dispo pour eux."
        status={state ? { tone: blocking ? 'alert' : 'ok', label: blocking ? `Active : sous la ${state.minVersion}` : 'Désactivée' } : null}
        meta={state && (
          <>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-baseline gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-1.5">
                <span className="text-[12px] text-white/60">En ligne</span>
                <span className="text-[16px] font-semibold tabular-nums text-white">{deployed}</span>
              </span>
              <span className="inline-flex items-baseline gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-1.5">
                <span className="text-[12px] text-white/60">App Store</span>
                <span className="text-[16px] font-semibold tabular-nums text-white">{appStore?.version || '?'}</span>
                {appStore && Number.isFinite(appStoreReleasedAt) && (
                  <span className="text-[12px] text-white/50">depuis le {formatDate(appStoreReleasedAt)}</span>
                )}
              </span>
            </div>
            {appStoreInGrace && (
              <p className="text-amber-200/90">
                Sortie il y a moins de 24 h : les iPhone ne seront invités à la mettre à jour qu'après ce délai.
              </p>
            )}
          </>
        )}
        loading={loading}
        details={(
          <ul className="list-disc pl-4 space-y-1">
            <li>Un joueur n'est bloqué que si la nouvelle version est dispo sur son store (ou en rechargeant, sur le web).</li>
            <li>S'applique à la prochaine connexion, même en pleine partie : à faire quand personne ne joue.</li>
            <li>Pas de Play Store affiché : Google ne publie pas sa version, chaque Android vérifie lui-même.</li>
          </ul>
        )}
      >
        {/* Actions 1-clic : le serveur décide le numéro (= version déployée). Bloqué => « Désactiver »
            devient l'action principale ; « Forcer » ne reste que s'il ferait quelque chose (nouvelle version en ligne). */}
        {blocking && (
          <DangerButton variant="safe" icon="mdi:lock-open-variant-outline" busy={busy === 'disable'} disabled={busy !== null} onClick={() => setConfirm('disable')}>
            Désactiver
          </DangerButton>
        )}
        {!alreadyForced && (
          <DangerButton
            variant={blocking ? 'ghost' : 'warning'}
            icon="mdi:shield-alert-outline"
            busy={busy === 'force'}
            disabled={busy !== null || !state?.deployedVersion}
            onClick={() => setConfirm('force')}
          >
            {blocking ? `Passer à la ${deployed}` : `Rendre la ${deployed} obligatoire`}
          </DangerButton>
        )}

        {import.meta.env.DEV && <TestZone deployed={deployed} />}
      </DangerCard>

      {/* Portal vers <body> : la confirmation échappe au sous-arbre de la popover
          (qui est masquée pendant ce temps) et se centre sur tout l'écran. */}
      {confirm === 'force' && createPortal(
        <ConfirmDialog
          title={`Rendre la ${deployed} obligatoire ?`}
          message={`À leur prochaine connexion, les joueurs avec une version plus ancienne que la ${deployed} devront mettre à jour, seulement si la nouvelle leur est disponible. Personne n'est bloqué sans pouvoir se mettre à jour.`}
          confirmLabel="Rendre obligatoire"
          onConfirm={() => { setConfirm(null); apply('force_latest'); }}
          onCancel={() => setConfirm(null)}
        />,
        document.body,
      )}
      {confirm === 'disable' && createPortal(
        <ConfirmDialog
          title="Désactiver la mise à jour obligatoire ?"
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
    // Repliée par défaut (outil dev), ouverte d'office tant qu'un override est actif.
    <details open={!!override} className="group rounded-lg border border-dashed border-fuchsia-400/30 bg-fuchsia-500/[0.04]">
      <summary className="cursor-pointer list-none flex items-center gap-2 px-3 min-h-[40px] text-[13px] font-medium text-fuchsia-200 [&::-webkit-details-marker]:hidden">
        <Icon icon="mdi:flask-outline" className="w-4 h-4 text-fuchsia-300" />
        Tester l'écran de blocage (dev)
        <Icon icon="mdi:chevron-down" className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3 space-y-3">
        <p className="text-[12px] text-white/60">
          Fait annoncer une fausse version à ce navigateur uniquement. Version réelle du build :{' '}
          <span className="font-mono text-white/80">{ACTUAL_APP_VERSION}</span>. Pour être bloqué, mets une version
          plus ancienne que la version minimum (en ligne : {deployed}).
        </p>

        {override && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-400/30 px-2.5 py-1.5">
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
            className="bg-black/25 text-white/85 border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] font-mono w-28
              focus:outline-none focus:border-fuchsia-400/60 hover:border-white/20 transition-colors placeholder:text-white/25"
          />
          <button
            type="button"
            onClick={applyOverride}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors
              border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20 hover:border-fuchsia-400/60 cursor-pointer"
          >
            <Icon icon="mdi:play" className="w-4 h-4" />
            Appliquer
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!override}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors
              border-white/[0.08] bg-transparent text-white/60 hover:text-white/90 hover:border-white/20
              disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <Icon icon="mdi:backup-restore" className="w-4 h-4" />
            Réinitialiser
          </button>
        </div>
      </div>
    </details>
  );
};
