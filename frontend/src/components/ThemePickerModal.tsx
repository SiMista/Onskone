import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { LuX, LuLock, LuCrown } from 'react-icons/lu';
import type { DecksCatalogWithMeta, SelectedDecks, ThemeInfo } from '@onskone/shared';
import { useLocale } from '../i18n';
import { getCategoryColor, getCategoryIcon, getCategoryGradient, lightenHex } from '../constants/game';
import ScrollFade from './ScrollFade';
import { STICKER_FILTER_HERO } from '../constants/icons';
import { useModalChrome } from '../hooks/useModalChrome';
import { useModalTransition } from '../hooks/useModalTransition';
import { usePremium } from '../utils/premium';
import ConfirmModal from './ConfirmModal';
import PremiumModal from './PremiumModal';
import EmojiCard from './EmojiCard';
import Checkbox from './Checkbox';
import HostOnlyHint from './HostOnlyHint';

interface ThemePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: DecksCatalogWithMeta;
  selected: SelectedDecks;
  mode: 'edit' | 'readonly';
  hostName: string;
  onChange: (next: SelectedDecks) => void;
  /** Catégorie affichée (fiche touchée dans l'onglet Thèmes) ; inconnue : la première. */
  category: string | null;
}

const isThemeSelected = (selected: SelectedDecks, category: string, code: string): boolean =>
  selected[category]?.includes(code) ?? false;

const toggleTheme = (selected: SelectedDecks, category: string, code: string, catalog: DecksCatalogWithMeta): SelectedDecks => {
  const next: SelectedDecks = {};
  for (const cat of Object.keys(catalog)) {
    next[cat] = [...(selected[cat] || [])];
  }
  const list = next[category] || [];
  next[category] = list.includes(code) ? list.filter(c => c !== code) : [...list, code];
  return next;
};

/** Remplace d'un coup les thèmes choisis d'une catégorie (« Tout sélectionner »). */
const setCategoryThemes = (selected: SelectedDecks, category: string, codes: string[], catalog: DecksCatalogWithMeta): SelectedDecks => {
  const next: SelectedDecks = {};
  for (const cat of Object.keys(catalog)) {
    next[cat] = [...(selected[cat] || [])];
  }
  next[category] = codes;
  return next;
};

/** Papier peint : l'icône de la catégorie répétée en quinconce, penchée, très discrète (décor). */
const WALLPAPER_ROWS = 8;
const WALLPAPER_COLS = 14;
const IconWallpaper = ({ icon }: { icon: string }) => (
  <div aria-hidden className="absolute -inset-10 -rotate-12 flex flex-col gap-4 opacity-25 pointer-events-none select-none">
    {Array.from({ length: WALLPAPER_ROWS }, (_, row) => (
      <div key={row} className={`flex shrink-0 gap-5 w-max ${row % 2 ? 'ml-6' : ''}`}>
        {Array.from({ length: WALLPAPER_COLS }, (_, col) => (
          <Icon key={col} icon={icon} width={30} height={30} className="shrink-0" />
        ))}
      </div>
    ))}
  </div>
);

const ThemePickerModal = ({ isOpen, onClose, catalog, selected, mode, hostName, onChange, category }: ThemePickerModalProps) => {
  const { t } = useLocale();
  const isPremium = usePremium();
  // Dernière catégorie ouverte : quand le parent ferme la modale lui-même (`category`
  // repasse à null), elle reste montée le temps du fondu de sortie et ne doit pas
  // basculer sur la première catégorie pendant ce temps.
  const lastCategoryRef = useRef(category);
  if (category && catalog[category]) lastCategoryRef.current = category;
  const shownCategory = lastCategoryRef.current;
  const activeCategory = shownCategory && catalog[shownCategory] ? shownCategory : (Object.keys(catalog)[0] ?? '');
  const isEditable = mode === 'edit';
  const listRef = useRef<HTMLDivElement>(null);

  // Petit shake du hint quand un non-pilier tente de toucher un thème : rappel visuel "c'est pas toi qui choisis".
  // On bump un compteur (via key) pour relancer l'anim même sur taps rapprochés.
  const [hintShake, setHintShake] = useState(0);
  const triggerHintShake = () => setHintShake(n => n + 1);

  // Mirror selected localement pour éviter le lag sur les taps rapides.
  const [localSelected, setLocalSelected] = useState<SelectedDecks>(selected);
  const localRef = useRef<SelectedDecks>(localSelected);
  useEffect(() => {
    setLocalSelected(selected);
    localRef.current = selected;
  }, [selected]);

  // Animation de sortie (fondu) : requestClose joue l'anim puis démonte.
  const { render, closing, requestClose } = useModalTransition(isOpen, onClose);
  // Scroll-lock body + fermeture Escape, partagés avec ModalShell.
  const { onBackdropClick } = useModalChrome(render, requestClose);

  // Reset le scroll vertical au changement de catégorie.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = 0;
  }, [activeCategory]);

  // Pending: thème mature dont l'activation est en attente de confirmation.
  const [pendingMature, setPendingMature] = useState<{ cat: string; code: string } | null>(null);
  // Ouverture du paywall quand on tente d'activer un thème premium non débloqué.
  const [showPaywall, setShowPaywall] = useState(false);

  const commit = (next: SelectedDecks) => {
    localRef.current = next;
    setLocalSelected(next);
    onChange(next);
  };

  const applyToggle = (cat: string, code: string) => {
    commit(toggleTheme(localRef.current, cat, code, catalog));
  };

  const handleToggle = (cat: string, code: string, info: ThemeInfo) => {
    if (!isEditable) {
      triggerHintShake();
      return;
    }
    const alreadySelected = isThemeSelected(localRef.current, cat, code);
    // Thème premium non débloqué : on ouvre le paywall au lieu de toggler.
    // (La désactivation reste directe, et un thème déjà débloqué suit le flux normal.)
    if (info.premium && !isPremium && !alreadySelected) {
      setShowPaywall(true);
      return;
    }
    // Pour les thèmes mature : on confirme à chaque activation. La désactivation est directe.
    if (info.mature && !alreadySelected) {
      setPendingMature({ cat, code });
      return;
    }
    applyToggle(cat, code);
  };

  if (!render) return null;

  const activeColor = getCategoryColor(activeCategory);
  const activeDescription = t.decks.categoryDescriptions[activeCategory] ?? '';
  const activeThemes = catalog[activeCategory] ?? [];

  // « Tout sélectionner » : seulement les thèmes cochables d'un geste. Les 18+ gardent leur
  // confirmation une par une, les premium verrouillés passent par le paywall.
  const bulkCodes = activeThemes
    .filter(info => !info.mature && !(info.premium && !isPremium))
    .map(info => info.code);
  const allBulkSelected = bulkCodes.length > 0
    && bulkCodes.every(code => isThemeSelected(localSelected, activeCategory, code));
  const handleSelectAll = (checked: boolean) => {
    const current = localRef.current[activeCategory] ?? [];
    // Décocher vide toute la catégorie (18+ et premium compris) ; cocher ajoute les
    // cochables sans toucher aux 18+ déjà confirmés. Ordre du catalogue.
    const keep = new Set(checked ? [...current, ...bulkCodes] : []);
    const codes = activeThemes.map(info => info.code).filter(code => keep.has(code));
    commit(setCategoryThemes(localRef.current, activeCategory, codes, catalog));
  };

  // Portal vers <body> : échappe à tout stacking context parent (cf. ModalShell).
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center bg-black/70 backdrop-blur-md ${closing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop'}`}
      onClick={onBackdropClick}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Wrapper : sur PC on cap la largeur pour ne pas que la modale s'étale ;
          sur mobile on prend toute la largeur. */}
      <div className="w-full max-w-2xl flex flex-col flex-1 min-h-0">
        {/* Header minimal : rappel « seul l'hôte » pour les non-hôtes + fermeture.
            Le titre et le compteur vivent dans le bandeau de la catégorie. */}
        <div
          className="relative shrink-0 flex items-center justify-between gap-3 px-5 pt-2 pb-3"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex-1 min-w-0 flex items-center gap-2.5">
            {!isEditable && (
              <HostOnlyHint text={t.themePicker.readOnlyHint(hostName)} shakeKey={hintShake} className="text-white/75" />
            )}
          </div>
          <button
            onClick={requestClose}
            aria-label={t.common.close}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white active:scale-90 transition-all duration-200 cursor-pointer border-2 border-white/30"
          >
            <LuX size={22} strokeWidth={2.5} />
          </button>
        </div>

        {/* Zone de contenu : grande carte cartonnée pleine largeur, scroll vertical interne */}
        <div
          className="relative flex-1 min-h-0 mx-3 md:mx-6 mb-2 animate-modal-content"
          onClick={e => e.stopPropagation()}
        >
          <div className="relative h-full border-[2.5px] border-black rounded-2xl bg-white overflow-hidden stack-shadow-lg flex flex-col">
            {/* Bandeau de la catégorie : dégradé à sa couleur, emoji sticker penché, nom en
                blanc contouré, et son sous-titre. */}
            <div
              className="relative shrink-0 overflow-hidden px-4 py-4 border-b-[2.5px] border-black"
              style={{ backgroundImage: getCategoryGradient(activeCategory) }}
            >
              <IconWallpaper icon={getCategoryIcon(activeCategory)} />
              <div className="relative flex items-center gap-3.5">
                <Icon
                  icon={getCategoryIcon(activeCategory)}
                  width={56}
                  height={56}
                  aria-hidden
                  className="shrink-0 -rotate-6"
                  style={{ filter: STICKER_FILTER_HERO }}
                />
                <span className="min-w-0 flex flex-col gap-1.5">
                  <span className="text-display-lg leading-none tracking-[0.04em] text-white text-outline [filter:drop-shadow(0_3px_0_black)]">
                    {activeCategory}
                  </span>
                  {/* Sous-titre : la description, blanc contouré comme le titre (sticker),
                      lisible sur toutes les couleurs sans boîte. */}
                  {activeDescription && (
                    <span className="font-display text-[15px] font-semibold leading-snug text-white text-outline [--outline-width:3px] [filter:drop-shadow(0_2px_0_black)]">
                      {activeDescription}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Liste verticale scrollable des cartes-thèmes. Wrapper relatif : les fades
                se calent sur la liste (le fade du haut sous la description). */}
            <div className="relative flex-1 min-h-0 flex flex-col">
              <div
                ref={listRef}
                className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 flex flex-col gap-2.5"
                style={{ backgroundColor: `${activeColor}25`, scrollbarWidth: 'none' }}
              >
                {isEditable && bulkCodes.length > 0 && (
                  // À droite, case collée au texte et centrée sur lui (boxSide right = items-center).
                  <div className="flex justify-end px-1 pt-0.5">
                    <Checkbox
                      checked={allBulkSelected}
                      onChange={handleSelectAll}
                      label={t.themePicker.selectAll}
                      boxSide="right"
                      fit
                      // Cochée = même dégradé que les blocs emoji des thèmes choisis.
                      checkedBackground={getCategoryGradient(activeCategory)}
                    />
                  </div>
                )}
                {activeThemes.map((info: ThemeInfo) => {
                  const active = isThemeSelected(localSelected, activeCategory, info.code);
                  // Verrouillé = premium ET pas débloqué. Reste toujours grisé + cadenas.
                  const locked = !!info.premium && !isPremium;
                  // Premium débloqué : cadre doré (rappelle que le thème fait partie du pack).
                  const goldFrame = !!info.premium && !locked;
                  return (
                    <button
                      key={info.code}
                      type="button"
                      onClick={() => handleToggle(activeCategory, info.code, info)}
                      className={`group relative flex items-stretch w-full text-left border-[2.5px] rounded-2xl overflow-hidden bg-white min-h-[96px] md:min-h-[112px] transition-all duration-200 ${goldFrame ? 'border-premium-600' : 'border-black'} ${isEditable ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                        } ${active
                          ? 'stack-shadow-sm opacity-100'
                          : 'opacity-45 grayscale'
                        }`}
                    >
                      {/* Bloc illustration emoji - dégradé diagonal pour le relief */}
                      <EmojiCard
                        icon={info.emoji}
                        bgImage={getCategoryGradient(activeCategory)}
                        filterStrength="strong"
                      />
                      {/* Texte */}
                      <div className="flex-1 min-w-0 px-3.5 py-3 md:px-4 md:py-3.5 flex flex-col justify-center gap-1">
                        <div className="font-display font-bold text-display-md text-gray-900 leading-tight line-clamp-1 flex items-center gap-1.5">
                          <span className="truncate">{info.name}</span>
                          {info.mature && (
                            <span className="shrink-0 inline-flex items-center justify-center h-5 px-2 rounded-full bg-red-600 text-white text-[12px] font-display font-bold leading-none border-[2.5px] border-black stack-shadow-sm">
                              {t.themePicker.matureBadge}
                            </span>
                          )}
                        </div>
                        {info.description && (
                          <div className="font-sans text-xs md:text-sm leading-snug text-gray-600 line-clamp-2">
                            {info.description}
                          </div>
                        )}
                      </div>
                      {/* Indicateur premium en haut à droite - deux états :
                          - verrouillé (non-premium) : pastille noire + cadenas ("faut payer")
                          - débloqué (premium) : cadre doré (ci-dessus) + petite couronne
                            d'angle (rappelle que le thème vient du pack, sans encombrer). */}
                      {locked && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 h-7 px-2 rounded-full bg-black/70 text-white border-2 border-white/70">
                          <LuLock size={13} strokeWidth={2.75} aria-hidden />
                          <span className="text-[11px] font-display font-bold leading-none tracking-wide">
                            {t.themePicker.premiumBadge}
                          </span>
                        </span>
                      )}
                      {goldFrame && (
                        <span
                          aria-label={t.themePicker.premiumBadge}
                          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full border-2 border-black text-black stack-shadow-sm bg-premium-gold"
                        >
                          <LuCrown size={13} strokeWidth={2.75} aria-hidden />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Fond de la liste = teinte de la catégorie à ~15 % sur blanc (`${color}25`) :
                  le fade reprend cette teinte, rendue opaque. Flèche : sans elle, on ne
                  devinait pas qu'il restait des thèmes sous la ligne de flottaison. */}
              <ScrollFade scrollRef={listRef} color={lightenHex(activeColor, 1 - 0x25 / 0xff)} arrow />
            </div>
          </div>
        </div>
      </div>

      {/* Popup d'avertissement pour les thèmes mature - apparaît à chaque tentative d'activation */}
      <ConfirmModal
        isOpen={pendingMature !== null}
        onClose={() => setPendingMature(null)}
        onConfirm={() => {
          if (pendingMature) {
            applyToggle(pendingMature.cat, pendingMature.code);
          }
        }}
        title={t.themePicker.matureConfirm.title}
        message={t.themePicker.matureConfirm.message}
        confirmText={t.themePicker.matureConfirm.confirm}
        cancelText={t.themePicker.matureConfirm.cancel}
        confirmVariant="danger"
      />

      {/* Paywall premium - ouvert au clic sur un thème verrouillé */}
      <PremiumModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>,
    document.body,
  );
};

export default ThemePickerModal;
