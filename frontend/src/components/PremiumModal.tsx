import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LuX, LuCrown, LuBellOff, LuMessagesSquare, LuLayers, LuInfinity } from 'react-icons/lu';
import StoreBadge from './StoreBadge';
import Avatar from './Avatar';
import { useLocale } from '../i18n';
import { useModalChrome } from '../hooks/useModalChrome';
import { useModalTransition } from '../hooks/useModalTransition';
import { canPurchase, purchasePremium, restorePurchases } from '../utils/premium';
import { getStats } from '../utils/playerStats';
import { APP_STORE_WEB, PLAY_WEB } from '../utils/storeLinks';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Dégradé doré du bouton Premium (fond de la feuille).
const GOLD_BG = 'linear-gradient(160deg, #FFE066 0%, #FFC23D 45%, #FF8A3D 100%)';
// Distance de glissement (px) au-delà de laquelle on referme la feuille.
const DISMISS_THRESHOLD = 110;

/**
 * Paywall premium - bottom sheet doré, composant DÉDIÉ (pas de ModalShell).
 * Slide depuis le bas (animate-bottomsheet), fond dégradé jaune→orange comme le
 * bouton Premium, DA carton conservée (bordure noire, rondeurs, stack-shadow).
 * Glissable vers le bas au doigt pour fermer. Aucun scroll interne : tient d'un bloc.
 */
const PremiumModal = ({ isOpen, onClose }: PremiumModalProps) => {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const native = canPurchase();

  // Animation de sortie : requestClose lance le fondu puis démonte via onClose.
  const { render, closing, requestClose } = useModalTransition(isOpen, onClose);
  useModalChrome(render, requestClose);

  // Drag-to-dismiss : on suit le doigt en translateY sur la feuille.
  // dragY vit en ref (pas de re-render à chaque frame + lecture fiable à la fin).
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragYRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onDragStart = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    dragYRef.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    // On ne suit que vers le bas (delta positif).
    const delta = Math.max(0, e.clientY - dragStartY.current);
    dragYRef.current = delta;
    // On ne passe en "dragging" qu'au-delà d'un petit seuil (sinon un simple
    // clic/tap est traité comme un drag et pouvait fermer la feuille).
    if (!dragging && delta > 6) setDragging(true);
    if (delta > 6) setDragY(delta);
  };
  const onDragEnd = () => {
    if (dragStartY.current === null) return;
    const finalY = dragYRef.current;
    dragStartY.current = null;
    dragYRef.current = 0;
    setDragging(false);
    if (finalY > DISMISS_THRESHOLD) {
      requestClose(); // fondu de sortie propre
    } else {
      setDragY(0); // rebond en place
    }
  };

  // Aperçu "nom brillant" : avatar + pseudo réels du joueur (fallback exemple).
  const stats = (() => { try { return getStats(); } catch { return null; } })();
  const previewName = stats?.lastPseudo?.trim() || t.premium.perkNameSample;
  const previewAvatarId = stats?.lastAvatarId ?? 0;

  const handlePurchase = async () => {
    setBusy(true);
    try {
      const ok = await purchasePremium();
      if (ok) requestClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      const ok = await restorePurchases();
      if (ok) requestClose();
    } finally {
      setBusy(false);
    }
  };

  if (!render) return null;

  // Ligne d'avantage : pastille noire + icône dorée + libellé sombre.
  const Perk = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <li className="flex items-center gap-2.5 rounded-xl border-2 border-black bg-white/45 px-2.5 py-2">
      <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-black">
        {icon}
      </span>
      <span className="font-sans font-semibold text-sm text-black leading-tight">{children}</span>
    </li>
  );

  // Portal vers <body> : la modale est ouverte DEPUIS le ThemePickerModal
  // (lui-même en z-50) ; sans portal elle resterait piégée dans son stacking
  // context. Cf. ModalShell.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm ${closing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop'}`}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div
        ref={sheetRef}
        className={`relative w-full max-w-md flex flex-col max-h-[92dvh] select-none border-[3px] border-b-0 border-black rounded-t-[30px] overflow-hidden stack-shadow-lg safe-pb texture-paper ${closing ? 'animate-bottomsheet-out' : dragging ? '' : 'animate-bottomsheet'}`}
        style={{
          background: GOLD_BG,
          transform: !closing && dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Effet brillant qui balaie la feuille une fois */}
        <span aria-hidden className="premium-sweep pointer-events-none absolute inset-0" />

        {/* Bouton fermer : HORS de la zone de drag (sinon le pointer-capture du
            drag avale son click et la croix ne ferme plus). */}
        <button
          type="button"
          onClick={requestClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={t.common.close}
          className="absolute top-2 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full text-black/60 hover:text-black active:scale-90 transition-all cursor-pointer"
        >
          <LuX size={20} strokeWidth={2.75} />
        </button>

        {/* Zone de drag = tout le haut figé (poignée + hero). On peut agripper la
            feuille depuis la couronne / le titre, pas seulement le petit trait.
            Le corps scrollable en dessous garde son scroll normal. */}
        <div
          className="relative shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          {/* Poignée */}
          <div className="pt-2.5 pb-1 px-4">
            <span aria-hidden className="block mx-auto w-11 h-1.5 rounded-full bg-black/25" />
          </div>

          {/* HERO : couronne + titre */}
          <div className="flex flex-col items-center text-center px-5 pt-1 pb-2.5">
            <span className="premium-halo w-14 h-14 flex items-center justify-center rounded-2xl bg-black border-[3px] border-black stack-shadow">
              <LuCrown size={28} strokeWidth={2.25} className="text-warning-orange" />
            </span>
            <h2 className="relative mt-2 mb-0 font-display font-extrabold text-[26px] leading-none text-black tracking-tight">
              {t.premium.title}
            </h2>
            <p className="relative mt-1.5 mb-0 font-display font-bold text-[13px] text-black/70">
              {t.premium.subtitle}
            </p>
          </div>
        </div>

        {/* Corps : tient d'un bloc sur écran normal ; scroll de secours uniquement
            si l'écran est vraiment trop court (évite le débordement). */}
        <div className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-2 flex flex-col gap-2">
          {/* Aperçu joueur premium (avatar cadré or + pseudo doré) - mis en avant */}
          <div className="flex items-center gap-3 rounded-xl border-2 border-black bg-black px-3 py-2">
            <Avatar avatarId={previewAvatarId} name={previewName} size="md" premium />
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-display font-extrabold text-lg text-gold-shine truncate">
                {previewName}
              </span>
              <span className="font-sans text-[11px] text-white/50">{t.premium.perkName}</span>
            </div>
          </div>

          {/* ZÉRO PUB : bloc sombre contrasté - mis en avant */}
          <div className="flex items-center gap-3 rounded-xl border-2 border-black bg-black px-3.5 py-2.5">
            <span className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-warning-orange border-2 border-black">
              <LuBellOff size={18} strokeWidth={2.75} className="text-black" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-display font-extrabold text-base text-warning-orange tracking-tight">
                {t.premium.perkAdsTitle}
              </span>
              <span className="font-sans text-[11px] text-white/70">{t.premium.perkAdsDesc}</span>
            </div>
          </div>

          <ul className="flex flex-col gap-2 m-0 p-0 list-none">
            <Perk icon={<LuMessagesSquare size={16} strokeWidth={2.5} className="text-warning-orange" />}>
              {t.premium.perkQuestions}
            </Perk>
            <Perk icon={<LuLayers size={16} strokeWidth={2.5} className="text-warning-orange" />}>
              {t.premium.perkThemes}
            </Perk>
            <Perk icon={<LuInfinity size={16} strokeWidth={2.5} className="text-warning-orange" />}>
              {t.premium.perkFuture}
            </Perk>
          </ul>
        </div>

        {/* Pied : CTA */}
        <div className="relative shrink-0 px-4 pt-2 pb-2 border-t-2 border-black/20">
          {native ? (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={handlePurchase}
                disabled={busy}
                className="relative w-full h-13 flex items-center justify-center gap-2 rounded-2xl border-[3px] border-black bg-black font-display font-extrabold text-base text-warning-orange stack-shadow active:scale-[0.98] transition-transform disabled:opacity-60 cursor-pointer"
              >
                <LuCrown size={20} strokeWidth={2.5} />
                <span>{busy ? t.premium.purchasing : t.premium.unlock}</span>
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={busy}
                className="font-sans text-xs text-black/55 underline underline-offset-2 hover:text-black disabled:opacity-50 cursor-pointer"
              >
                {t.premium.restore}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="font-sans font-semibold text-xs text-black/70 text-center m-0">
                {t.premium.webOnly}
              </p>
              <div className="flex items-center justify-center gap-2">
                <StoreBadge store="apple" href={APP_STORE_WEB} ariaLabel={t.premium.getOnAppStore} className="flex-1 min-w-0 max-w-[170px]" />
                <StoreBadge store="google" href={PLAY_WEB} ariaLabel={t.premium.getOnPlayStore} className="flex-1 min-w-0 max-w-[170px]" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PremiumModal;
