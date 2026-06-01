import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { LuX, LuLock } from 'react-icons/lu';
import type { DecksCatalogWithMeta, SelectedDecks, ThemeInfo } from '@onskone/shared';
import { useLocale } from '../i18n';
import { getCategoryColor, lightenHex, darkenHex } from '../constants/game';
import { STICKER_FILTER, STICKER_FILTER_STRONG } from '../constants/icons';
import ConfirmModal from './ConfirmModal';

interface ThemePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: DecksCatalogWithMeta;
  selected: SelectedDecks;
  mode: 'edit' | 'readonly';
  hostName: string;
  onChange: (next: SelectedDecks) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  ICEBREAKERS: 'fluent-emoji-flat:ice',
  FUN: 'fluent-emoji-flat:party-popper',
  DEEP: 'fluent-emoji-flat:fire',
};
const DEFAULT_CATEGORY_ICON = 'fluent-emoji-flat:flower-playing-cards';

const CATEGORY_PATTERNS: Record<string, string> = {
  ICEBREAKERS: 'bg-pattern-dots',
  FUN: 'bg-pattern-zigzag',
  DEEP: 'bg-pattern-diagonal',
};

const buildEmojiGradient = (hex: string): string =>
  `linear-gradient(135deg, ${lightenHex(hex, 0.4)} 0%, ${hex} 55%, ${darkenHex(hex, 0.12)} 100%)`;

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

const ThemePickerModal = ({ isOpen, onClose, catalog, selected, mode, hostName, onChange }: ThemePickerModalProps) => {
  const { t } = useLocale();
  const categories = useMemo(() => Object.keys(catalog), [catalog]);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] ?? '');
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

  const totals = useMemo(() => {
    const total = Object.values(catalog).reduce((acc, arr) => acc + arr.length, 0);
    const sel = Object.values(localSelected).reduce((acc, arr) => acc + arr.length, 0);
    return { total, sel };
  }, [catalog, localSelected]);

  // À l'ouverture : bloquer le scroll body, revenir sur la première catégorie.
  // Important : le reset de la catégorie ne doit se faire QU'À la transition fermé→ouvert,
  // sinon chaque toggle de thème (qui renvoie un nouveau catalog depuis le serveur, donc
  // une nouvelle ref `categories`) ramènerait l'utilisateur sur ICEBREAKERS.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!wasOpenRef.current) {
      setActiveCategory(categories[0] ?? '');
      wasOpenRef.current = true;
    }
    return () => { document.body.style.overflow = prev; };
  }, [isOpen, categories]);

  // Garde-fou : si l'activeCategory courante disparaît du catalogue, retombe sur la première.
  useEffect(() => {
    if (activeCategory && !categories.includes(activeCategory) && categories.length > 0) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  // Reset le scroll vertical au changement d'onglet.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = 0;
  }, [activeCategory]);

  // Pending: thème mature dont l'activation est en attente de confirmation.
  const [pendingMature, setPendingMature] = useState<{ cat: string; code: string } | null>(null);

  const applyToggle = (cat: string, code: string) => {
    const next = toggleTheme(localRef.current, cat, code, catalog);
    localRef.current = next;
    setLocalSelected(next);
    onChange(next);
  };

  const handleToggle = (cat: string, code: string, info: ThemeInfo) => {
    if (!isEditable) {
      triggerHintShake();
      return;
    }
    const alreadySelected = isThemeSelected(localRef.current, cat, code);
    // Pour les thèmes mature : on confirme à chaque activation. La désactivation est directe.
    if (info.mature && !alreadySelected) {
      setPendingMature({ cat, code });
      return;
    }
    applyToggle(cat, code);
  };

  if (!isOpen) return null;

  const activeColor = getCategoryColor(activeCategory);
  const activePattern = CATEGORY_PATTERNS[activeCategory];
  const activeDescription = t.decks.categoryDescriptions[activeCategory] ?? '';
  const activeThemes = catalog[activeCategory] ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center bg-black/70 backdrop-blur-md animate-modal-backdrop"
      onClick={onClose}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* Wrapper : sur PC on cap la largeur pour ne pas que la modale s'étale ;
          sur mobile on prend toute la largeur. */}
      <div className="w-full max-w-2xl flex flex-col flex-1 min-h-0">
      {/* Header flottant : titre + compteur (à droite du titre) + sous-texte contextuel + close */}
      <div
          className="relative shrink-0 flex items-center justify-between gap-3 px-5 pt-2 pb-3"
        onClick={e => e.stopPropagation()}
      >
          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg md:text-xl font-display font-bold text-white !my-0 leading-none tracking-tight drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]">
              {t.themePicker.title}
            </h2>
              <span className="inline-flex items-center leading-none text-xs font-display font-bold text-white/90 bg-black/30 border border-white/25 rounded-full px-2 py-0.5 self-center">
              {t.themePicker.counter(totals.sel, totals.total)}
            </span>
          </div>
            <p
              key={hintShake}
              className={`!my-0 inline-flex items-center gap-1.5 text-xs font-sans italic text-white/75 leading-tight origin-left ${hintShake ? 'animate-paper-shake-slow' : ''}`}
            >
            {!isEditable && <LuLock size={12} strokeWidth={2.5} aria-hidden />}
            <span>{isEditable ? t.themePicker.hostHint : t.themePicker.readOnlyHint(hostName)}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={t.common.close}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white active:scale-90 transition-all duration-200 cursor-pointer border-2 border-white/30"
        >
          <LuX size={22} strokeWidth={2.5} />
        </button>
      </div>

      {/* Tabs catégorie - chips colorés flottants sur backdrop */}
      <div
        className="relative shrink-0 px-4 pb-2 flex items-center gap-1.5 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        {categories.map(cat => {
          const active = cat === activeCategory;
          const color = getCategoryColor(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              aria-pressed={active}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[2.5px] border-black font-display font-bold text-xs uppercase tracking-tight transition-all duration-200 ${active ? 'scale-[1.04] stack-shadow-sm' : 'opacity-70 hover:opacity-90'
                }`}
              style={{ backgroundColor: active ? color : 'white', color: '#000' }}
            >
              <Icon
                icon={CATEGORY_ICONS[cat] ?? DEFAULT_CATEGORY_ICON}
                width={16}
                height={16}
                aria-hidden
                style={{ filter: STICKER_FILTER }}
              />
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Zone de contenu : grande carte cartonnée pleine largeur, scroll vertical interne */}
      <div
        className="relative flex-1 min-h-0 mx-3 md:mx-6 mb-2 animate-modal-content"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-full border-[2.5px] border-black rounded-2xl bg-white overflow-hidden stack-shadow-lg flex flex-col">
          {/* Description de la catégorie (subtile) */}
          {activeDescription && (
            <div
              className="relative shrink-0 px-3.5 py-2 border-b-[2px] border-dashed border-black/25"
              style={{ backgroundColor: `${activeColor}1a` }}
            >
              {activePattern && (
                <span aria-hidden className={`pointer-events-none absolute inset-0 ${activePattern} opacity-20`} />
              )}
                <span className="relative font-sans text-sm text-gray-800 leading-snug">
                {activeDescription}
              </span>
            </div>
          )}

          {/* Liste verticale scrollable des cartes-thèmes */}
          <div
            ref={listRef}
            className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 flex flex-col gap-2.5"
            style={{ backgroundColor: `${activeColor}10`, scrollbarWidth: 'none' }}
          >
            {activePattern && (
              <span aria-hidden className={`pointer-events-none absolute inset-0 ${activePattern} opacity-15`} />
            )}
            {activeThemes.map((info: ThemeInfo) => {
              const active = isThemeSelected(localSelected, activeCategory, info.code);
              return (
                <button
                  key={info.code}
                  type="button"
                  onClick={() => handleToggle(activeCategory, info.code, info)}
                  className={`group relative flex items-stretch w-full text-left border-[2.5px] border-black rounded-2xl overflow-hidden bg-white min-h-[96px] md:min-h-[112px] transition-all duration-200 ${isEditable ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                    } ${active
                      ? 'stack-shadow-sm opacity-100'
                      : 'opacity-55 grayscale-[60%]'
                    }`}
                >
                  {/* Bloc illustration emoji - dégradé diagonal pour le relief */}
                  <div
                    className="relative flex items-center justify-center shrink-0 w-20 md:w-24 texture-paper border-r-[2.5px] border-black"
                    style={{ backgroundImage: buildEmojiGradient(activeColor) }}
                  >
                    {activePattern && (
                      <span aria-hidden className={`absolute inset-0 ${activePattern} opacity-30`} />
                    )}
                    <Icon
                      icon={info.emoji}
                      width={44}
                      height={44}
                      aria-hidden
                      className="relative transition-transform duration-300 ease-out group-hover:rotate-[-6deg] group-hover:scale-110"
                      style={{ filter: STICKER_FILTER_STRONG }}
                    />
                  </div>
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
                </button>
              );
            })}
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
    </div>
  );
};

export default ThemePickerModal;
