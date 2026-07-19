import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import {
  fetchPremiumPromo,
  setPremiumPromo,
  type PremiumPromoState,
} from '../../utils/adminDataApi';

/**
 * Contrôle admin de la promo premium : quand active, le premium est offert à
 * tous (le gating serveur des thèmes premium considère tout host comme premium).
 * Auto-contenu (charge son état, toggle 1-clic). Calqué sur VersionGate.
 */
export const PremiumPromoPanel = () => {
  const showToast = useToast();
  const [state, setState] = useState<PremiumPromoState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await fetchPremiumPromo());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async () => {
    const next = state?.active ? 'disable' : 'enable';
    setBusy(true);
    try {
      const s = await setPremiumPromo(next);
      setState(s);
      showToast(s.active ? 'Promo premium ACTIVE : premium offert à tous.' : 'Promo premium désactivée.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setBusy(false);
    }
  }, [state, showToast]);

  const active = state?.active ?? false;

  return (
    <div className="rounded-lg surface-glass p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Promo premium</p>
        <p className="mt-1 text-sm text-white/85 leading-tight">
          {active ? 'Premium offert à tous 🎁' : 'Premium payant (normal)'}
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy || state === null}
        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          active
            ? 'bg-amber-400/20 border border-amber-300/60 text-amber-100 hover:bg-amber-400/30'
            : 'bg-white/10 border border-white/20 text-white/80 hover:bg-white/15'
        }`}
      >
        {busy ? '…' : active ? 'Désactiver' : 'Offrir à tous'}
      </button>
    </div>
  );
};

export default PremiumPromoPanel;
