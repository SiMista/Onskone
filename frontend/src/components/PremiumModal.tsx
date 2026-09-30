import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
// LuBellOff : à réimporter avec le bloc ZÉRO PUB (commenté plus bas).
import { LuX, LuCrown, LuMessagesSquare, LuLayers, LuInfinity } from 'react-icons/lu';
import StoreBadge from './StoreBadge';
import Avatar from './Avatar';
import { useLocale } from '../i18n';
import { useToast } from './Toast';
import { useModalChrome } from '../hooks/useModalChrome';
import { useModalTransition } from '../hooks/useModalTransition';
import MentionsModal from './Footer/MentionsModal';
import { canPurchase, getPremiumPrice, purchasePremium, restorePurchases } from '../utils/premium';
import { getStats } from '../utils/playerStats';
import { APP_STORE_WEB, PLAY_WEB } from '../utils/storeLinks';
import { hapticSuccess } from '../utils/haptics';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Verrouille la fermeture pendant la première seconde. À n'activer QUE pour une
   * ouverture non sollicitée (paywall promo automatique) : la feuille surgit alors
   * sous le doigt de l'utilisateur, et un tap déjà engagé la refermait aussitôt.
   * Une ouverture demandée (bouton Premium) ne doit jamais être verrouillée : il
   * sait ce qu'il a ouvert, l'empêcher de sortir serait juste pénible.
   */
  lockOnOpen?: boolean;
  /**
   * Pseudo à afficher dans l'aperçu doré. Fourni par l'écran appelant quand il
   * en tient un plus frais que le stockage (l'input d'accueil, typiquement) :
   * l'identité n'est persistée qu'à la création/jointure d'un salon, donc lire
   * le stockage ici affichait l'ANCIEN pseudo pendant toute la saisie.
   */
  previewName?: string;
  /**
   * Studio uniquement : ouvre directement sur l'écran de victoire (achat ou
   * restauration), impossible à atteindre sur web où l'achat n'existe pas.
   */
  previewCelebration?: 'purchase' | 'restore';
}

// Dégradé doré du bouton Premium (fond de la feuille).
const GOLD_BG = 'linear-gradient(160deg, #FFE066 0%, #FFC23D 45%, #FF8A3D 100%)';
// Délai pendant lequel la feuille ignore toute demande de fermeture après son
// ouverture : évite qu'un tap déjà en cours la referme aussitôt apparue.
const OPEN_LOCK_MS = 1000;
// Distance de glissement (px) au-delà de laquelle on referme la feuille.
const DISMISS_THRESHOLD = 110;
// Liens discrets du pied (restaurer, CGU, confidentialité). py-2.5 : zone
// tactile ~36px sans grossir le texte (les liens serrés se touchaient au doigt).
const FOOTER_LINK = 'py-2.5 px-2 underline underline-offset-2 hover:text-black disabled:opacity-50 cursor-pointer';

/**
 * Paywall premium - bottom sheet doré, composant DÉDIÉ (pas de ModalShell).
 * Slide depuis le bas (animate-bottomsheet), fond dégradé jaune→orange comme le
 * bouton Premium, DA carton conservée (bordure noire, rondeurs, stack-shadow).
 * Glissable vers le bas au doigt pour fermer. Aucun scroll interne : tient d'un bloc.
 */
const PremiumModal = ({ isOpen, onClose, lockOnOpen = false, previewName: previewNameProp, previewCelebration }: PremiumModalProps) => {
  const { t } = useLocale();
  const showToast = useToast();
  const [busy, setBusy] = useState(false);
  const native = canPurchase();
  // Écran de victoire après un achat / une restauration réussis : la feuille
  // reste ouverte et bascule dessus au lieu de se fermer sans un mot (sur iOS,
  // la popup Apple « achat effectué » s'affiche par-dessus, on le voit après).
  const [celebration, setCelebration] = useState<'purchase' | 'restore' | null>(null);
  // Prix localisé servi par le store (devise du compte). null = pas encore lu ou
  // indisponible : le CTA garde alors son libellé sans prix.
  const [price, setPrice] = useState<string | null>(null);
  // Onglet légal ouvert par-dessus le paywall (Apple veut CGU + confidentialité
  // accessibles depuis le parcours d'achat, cf. guideline 3.1.2).
  const [legalTab, setLegalTab] = useState<'cgu' | 'privacy' | null>(null);

  // Animation de sortie : requestClose lance le fondu puis démonte via onClose.
  const { render, closing, requestClose } = useModalTransition(isOpen, onClose);

  // Réouverture = paywall normal : la célébration ne survit pas à la fermeture
  // (sauf preview Studio, qui ouvre directement dessus).
  useEffect(() => {
    setCelebration(render ? previewCelebration ?? null : null);
  }, [render, previewCelebration]);

  // Lecture du prix à l'ouverture (natif uniquement, mis en cache par premium.ts).
  useEffect(() => {
    if (!render || !native) return;
    let cancelled = false;
    getPremiumPrice().then((p) => { if (!cancelled) setPrice(p); });
    return () => { cancelled = true; };
  }, [render, native]);

  // Fermer le paywall referme aussi la page légale ouverte par-dessus, et remet
  // le glissement à zéro (dragY est conservé pendant la sortie, cf. --sheet-drag).
  useEffect(() => {
    if (!render) {
      setLegalTab(null);
      setDragY(0);
    }
  }, [render]);

  // Verrou d'ouverture, uniquement quand la feuille s'ouvre d'elle-même (cf.
  // `lockOnOpen`) : elle surgit sous le doigt, et un tap déjà engagé la refermait
  // instantanément — l'utilisateur voyait une fenêtre apparaître et disparaître.
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (!render || !lockOnOpen) { setLocked(false); return; }
    setLocked(true);
    const timer = setTimeout(() => setLocked(false), OPEN_LOCK_MS);
    return () => clearTimeout(timer);
  }, [render, lockOnOpen]);

  // Point de passage UNIQUE de toutes les fermetures (croix, backdrop, Escape,
  // glissement) : le verrou ne peut pas être contourné par l'une d'elles.
  const tryClose = useCallback(() => {
    if (locked) return;
    requestClose();
  }, [locked, requestClose]);

  const { onBackdropClick } = useModalChrome(render, tryClose);

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
    // Pendant le verrou d'ouverture, tryClose est ignoré : on rebondit en place
    // au lieu de laisser la feuille figée à mi-hauteur.
    if (finalY > DISMISS_THRESHOLD && !locked) {
      tryClose(); // sortie depuis la position du doigt (cf. --sheet-drag)
    } else {
      setDragY(0); // rebond en place
    }
  };

  // Aperçu "nom brillant" : avatar + pseudo réels du joueur (fallback exemple).
  const stats = (() => { try { return getStats(); } catch { return null; } })();
  const previewName = previewNameProp?.trim() || stats?.lastPseudo?.trim() || t.premium.perkNameSample;
  const previewAvatarId = stats?.lastAvatarId ?? 0;

  const handlePurchase = async () => {
    setBusy(true);
    try {
      const res = await purchasePremium();
      if (res.ok) {
        hapticSuccess();
        setCelebration('purchase');
      } else if (res.failure === 'unavailable') {
        // Produit pas encore servi par le store (validation Apple/Google en cours) :
        // ce n'est pas une panne, ton achat n'a pas "raté" — ton de l'attente.
        showToast(t.premium.purchaseUnavailable, 'info');
      } else if (res.failure !== 'cancelled') {
        // Échec réel (réseau, SDK non configuré…) : on prévient au lieu de rester muet.
        showToast(t.premium.purchaseError, 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      const res = await restorePurchases();
      if (res.ok) {
        hapticSuccess();
        setCelebration('restore');
      } else if (res.failure === 'empty') {
        // Le SDK a répondu : ce compte n'a rien acheté. Cas normal, ton neutre.
        showToast(t.premium.restoreEmpty, 'info');
      } else if (res.failure !== 'cancelled') {
        // Échec réel : surtout PAS "aucun achat", l'user a peut-être payé.
        showToast(t.premium.restoreError, 'error');
      }
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
  // MentionsModal est SŒUR du portal (pas dans la feuille) : elle n'hérite ni du
  // drag ni du stopPropagation. La pile de useModalChrome garantit qu'Escape et
  // le backdrop ne ferment que la modale du dessus.
  return (
    <>
    {createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-black/60 backdrop-blur-sm ${closing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop'}`}
      onClick={onBackdropClick}
    >
      {/* Téléphone : bottom sheet plein largeur ancré en bas. Tablette+ : la feuille
          grandit (max-w-lg), se centre et ferme ses 4 coins (vraie modale) au lieu
          de rester une petite languette perdue en bas de l'iPad. */}
      <div
        ref={sheetRef}
        className={`relative w-full max-w-md sm:max-w-2xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh] select-none border-[3px] border-b-0 sm:border-b-[3px] border-black rounded-t-[30px] sm:rounded-[30px] overflow-hidden stack-shadow-lg safe-pb sm:pb-0 texture-paper ${closing ? 'animate-bottomsheet-out' : dragging ? '' : 'animate-bottomsheet'}`}
        style={{
          background: GOLD_BG,
          transform: !closing && dragY ? `translateY(${dragY}px)` : undefined,
          // Fermeture après glissement : l'animation de sortie part de la position
          // du doigt (--sheet-drag, cf. bottomsheet-out). Pas de transition pendant
          // la sortie : une transition prime sur une animation CSS, et le retrait
          // du transform faisait remonter la feuille avant qu'elle ne descende.
          ['--sheet-drag' as string]: `${dragY}px`,
          transition: dragging || closing ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Effet brillant qui balaie la feuille une fois */}
        <span aria-hidden className="premium-sweep pointer-events-none absolute inset-0" />

        {/* Bouton fermer : HORS de la zone de drag (sinon le pointer-capture du
            drag avale son click et la croix ne ferme plus). */}
        <button
          type="button"
          onClick={tryClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={t.common.close}
          className="absolute top-2 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full text-black/60 hover:text-black active:scale-90 transition-all cursor-pointer"
        >
          <LuX size={20} strokeWidth={2.75} />
        </button>

        {celebration ? (
          // Écran de victoire. Glissable comme le paywall (poignée incluse) ;
          // un seul accent idle : le pseudo doré (la couronne pop une fois).
          <div
            className="relative flex flex-col items-center text-center px-6 pb-5 sm:pb-8 gap-3 sm:gap-4 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <div className="self-stretch pt-2.5 pb-3 sm:pb-5">
              <span aria-hidden className="block mx-auto w-11 h-1.5 rounded-full bg-black/25" />
            </div>
            <span className="animate-player-pop w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-3xl bg-black border-[3px] border-black stack-shadow">
              <LuCrown size={44} strokeWidth={2.25} className="text-warning-orange" />
            </span>
            <h2 className="relative mt-1 mb-0 font-display font-extrabold text-[28px] sm:text-[36px] leading-none text-black tracking-tight">
              {celebration === 'restore' ? t.premium.welcomeRestoredTitle : t.premium.welcomeTitle}
            </h2>
            <div
              className="animate-player-pop flex items-center gap-3 max-w-full rounded-xl border-2 border-black bg-black px-4 py-2.5"
              style={{ animationDelay: '150ms' }}
            >
              <Avatar avatarId={previewAvatarId} name={previewName} size="md" premium />
              <span className="font-display font-extrabold text-xl text-gold-shine truncate">
                {previewName}
              </span>
            </div>
            <p className="relative m-0 max-w-xs whitespace-pre-line font-display font-bold text-[13px] sm:text-base text-black/70">
              {t.premium.welcomeDesc}
            </p>
            <button
              type="button"
              onClick={tryClose}
              onPointerDown={(e) => e.stopPropagation()}
              className="relative mt-1 w-full h-13 sm:h-15 flex items-center justify-center rounded-2xl border-[3px] border-black bg-black font-display font-extrabold text-base sm:text-lg text-warning-orange stack-shadow active:scale-[0.98] transition-transform cursor-pointer"
            >
              {t.premium.welcomeCta}
            </button>
          </div>
        ) : (
        <>
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

          {/* HERO : couronne + titre (agrandis sur tablette pour remplir l'espace) */}
          <div className="flex flex-col items-center text-center px-5 pt-1 pb-2.5 sm:pt-3 sm:pb-4">
            <span className="w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center rounded-2xl sm:rounded-3xl bg-black border-[3px] border-black stack-shadow">
              <LuCrown size={28} strokeWidth={2.25} className="text-warning-orange sm:hidden" />
              <LuCrown size={40} strokeWidth={2.25} className="text-warning-orange hidden sm:block" />
            </span>
            <h2 className="relative mt-2 sm:mt-3.5 mb-0 font-display font-extrabold text-[26px] sm:text-[34px] leading-none text-black tracking-tight">
              {t.premium.title}
            </h2>
            <p className="relative mt-1.5 sm:mt-2 mb-0 font-display font-bold text-[13px] sm:text-base text-black/70">
              {t.premium.subtitle}
            </p>
          </div>
        </div>

        {/* Corps : tient d'un bloc sur écran normal ; scroll de secours uniquement
            si l'écran est vraiment trop court (évite le débordement). */}
        <div className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-8 pb-2 sm:pb-4 flex flex-col gap-2 sm:gap-3">
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

          {/* ZÉRO PUB : désactivé tant que l'app n'affiche aucune pub (promettre
              un avantage inexistant = rejet App Review). À décommenter (+ l'import
              LuBellOff et la mention dans welcomeDesc) quand AdMob sera branché.
              Mis en avant mais CLAIR. Le noir est réservé à l'aperçu
              pseudo (le doré a besoin d'un fond sombre) et au CTA, qui doit rester
              le pavé le plus lourd de la feuille.
          <div className="flex items-center gap-3 rounded-xl border-2 border-black bg-white/75 px-3.5 py-2.5">
            <span className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-black border-2 border-black">
              <LuBellOff size={18} strokeWidth={2.75} className="text-warning-orange" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-display font-extrabold text-base text-black tracking-tight">
                {t.premium.perkAdsTitle}
              </span>
              <span className="font-sans text-[11px] text-black/60">{t.premium.perkAdsDesc}</span>
            </div>
          </div>
          */}

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
        <div className="relative shrink-0 px-4 sm:px-8 pt-2 sm:pt-3 pb-2 sm:pb-4 border-t-2 border-black/20">
          {native ? (
            <div className="flex flex-col items-center gap-2.5">
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={busy}
                  className="relative w-full h-13 sm:h-15 flex items-center justify-center gap-2 rounded-2xl border-[3px] border-black bg-black font-display font-extrabold text-base sm:text-lg text-warning-orange stack-shadow active:scale-[0.98] transition-transform disabled:opacity-60 cursor-pointer"
                >
                  <LuCrown size={20} strokeWidth={2.5} />
                  <span>{busy ? t.premium.purchasing : price ? `${t.premium.unlock} · ${price}` : t.premium.unlock}</span>
                </button>
                {/* Sticker « À vie ! » collé sur le coin du CTA. Deux spans : la
                    rotation sur l'externe, le pop (qui anime transform) sur
                    l'interne, sinon l'animation écrasait la rotation. One-shot :
                    l'idle de l'écran reste le reflet doré. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-3 -right-1.5 rotate-[8deg]"
                >
                  <span
                    className="animate-player-pop block px-2 py-0.5 rounded-md border-2 border-black bg-warning-100 stack-shadow-sm font-display font-extrabold text-[11px] sm:text-xs uppercase tracking-wide text-black whitespace-nowrap"
                    style={{ animationDelay: '350ms' }}
                  >
                    {t.premium.lifetimeSticker}
                  </span>
                </span>
              </div>
              <p className="m-0 -mt-1 font-sans font-semibold text-[11px] text-black/60 text-center">
                {t.premium.kebab}
              </p>
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
          {/* Liens secondaires sur UNE ligne : Restaurer (natif) · CGU · Confidentialité.
              Zones tactiles py-1.5 : ne pas coller au CTA (le doigt touchait les deux). */}
          <div className="flex flex-wrap items-center justify-center -my-1 font-sans text-[11px] text-black/55">
            {native && (
              <>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={busy}
                  className={FOOTER_LINK}
                >
                  {t.premium.restore}
                </button>
                <span aria-hidden="true">·</span>
              </>
            )}
            <button type="button" onClick={() => setLegalTab('cgu')} className={FOOTER_LINK}>
              {t.premium.termsLink}
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => setLegalTab('privacy')} className={FOOTER_LINK}>
              {t.premium.privacyLink}
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </div>,
    document.body,
    )}
    {legalTab && (
      <MentionsModal isOpen initialTab={legalTab} onClose={() => setLegalTab(null)} />
    )}
    </>
  );
};

export default PremiumModal;
