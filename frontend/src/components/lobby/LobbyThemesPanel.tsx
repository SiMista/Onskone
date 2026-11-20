import { Icon } from '../Icon';
import { LuChevronRight, LuCrown } from 'react-icons/lu';
import type { DecksCatalogWithMeta, SelectedDecks, ThemeInfo } from '@onskone/shared';
import {
  getCategoryColor,
  getCategoryIcon,
  getSoftCategoryColor,
  lightenHex,
} from '../../constants/game';
import { STICKER_FILTER } from '../../constants/icons';
import CategoriesHelp from '../CategoriesHelp';
import CategoryAudience from '../CategoryAudience';
import type { Dictionary } from '../../i18n/dictionary';

interface LobbyThemesPanelProps {
  isHost: boolean;
  hostName: string;
  selectedDecks: SelectedDecks;
  decksCatalogMeta: DecksCatalogWithMeta;
  /** Ouvre le sélecteur directement sur cette catégorie. */
  onOpenCategory: (category: string) => void;
  t: Dictionary;
}

/**
 * Onglet "Thèmes" du salon : une fiche par catégorie (Icebreakers, Fun, Deep),
 * teintée à sa couleur avec un grand « ? » en filigrane. Les thèmes choisis y
 * figurent en pastilles (Premium : couronne dorée) ; les autres ne se voient que
 * dans le sélecteur, avec la description de la catégorie. Toute la fiche ouvre le
 * sélecteur sur sa catégorie (lecture seule pour les non-hôtes).
 */
const LobbyThemesPanel = ({ isHost, hostName, selectedDecks, decksCatalogMeta, onOpenCategory, t }: LobbyThemesPanelProps) => {
  const categories = Object.keys(decksCatalogMeta);

  return (
    <div className={`relative flex flex-col gap-6 ${isHost ? '' : 'pt-7'}`}>
      {isHost ? (
        // Hôte : la consigne au-dessus des fiches, le « ? » au bout de sa ligne. pl-3.5 =
        // le retrait du contenu des fiches (étiquette left-3.5, texte px-3 + bordure).
        // Consigne secondaire (petite, grise) et courte : elle doit tenir sur une ligne
        // dès 360px de large. mr-3 : le « i » s'aligne sur les chevrons des fiches (px-3 +
        // bordure) au lieu de coller au bord du panneau.
        <div className="flex items-center gap-2">
          <p className="!my-0 flex-1 min-w-0 pl-3.5 font-display font-semibold text-xs leading-snug text-gray-600">{t.lobby.themesHostHint}</p>
          <CategoriesHelp categories={categories} className="mr-3" />
        </div>
      ) : (
        // Dans le coin haut-droit du panneau, au-dessus des fiches (celle d'Icebreakers
        // porte son étiquette à gauche : le coin droit est libre). right-3 : aligné sur les
        // chevrons des fiches, comme côté hôte.
        <CategoriesHelp categories={categories} className="absolute top-0 right-3" />
      )}
      {!isHost && (
        <div className="flex justify-center pt-2">
          <div className="relative rotate-[-1.2deg] hover:rotate-0 transition-transform duration-300 ease-out">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cream-kraft card-paper rounded-lg stack-shadow-sm">
              <span className="font-display text-[13px] tracking-tight text-black leading-snug whitespace-nowrap">
                {t.lobby.themesHostOnlyPrefix}{' '}
                <span className="relative inline-block font-bold uppercase bg-black text-warning-500 px-1.5 py-0.5 rounded-md">
                  <Icon
                    icon="fluent-emoji-flat:crown"
                    width={20}
                    height={20}
                    aria-hidden
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2"
                    style={{ filter: STICKER_FILTER }}
                  />
                  {hostName && hostName.length > 10 ? `${hostName.slice(0, 10)}…` : hostName}
                </span>{' '}
                {t.lobby.themesHostOnlySuffix}
              </span>
            </div>
            {/* ruban adhésif par dessus */}
            <span
              aria-hidden
              className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-12 h-3.5 bg-warning-500/80 border-[1.5px] border-black/60 rounded-[2px] rotate-[-3deg] [box-shadow:1px_1px_0_0_rgba(0,0,0,0.3)]"
            />
          </div>
        </div>
      )}

      {categories.map((cat, i) => (
        <CategoryCard
          key={cat}
          category={cat}
          themes={decksCatalogMeta[cat] ?? []}
          selected={selectedDecks[cat] ?? []}
          isHost={isHost}
          onOpen={() => onOpenCategory(cat)}
          delayMs={i * 60}
          t={t}
        />
      ))}
    </div>
  );
};

const CategoryCard = ({ category, themes, selected, isHost, onOpen, delayMs, t }: {
  category: string;
  themes: ThemeInfo[];
  selected: string[];
  isHost: boolean;
  onOpen: () => void;
  delayMs: number;
  t: Dictionary;
}) => {
  const color = getCategoryColor(category);
  const action = isHost ? t.themePicker.modify : t.themePicker.view;
  // Seuls les thèmes choisis, dans l'ordre du catalogue (le sélecteur montre les autres).
  const chips = themes.filter(info => selected.includes(info.code));

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${action} : ${category}`}
      className="group relative isolate w-full flex flex-col gap-2 px-3 pt-5 pb-3 rounded-2xl border-[2.5px] border-black stack-shadow-sm text-left cursor-pointer animate-card-deal-in transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-[1px]"
      style={{ backgroundColor: lightenHex(color, 0.86), animationDelay: `${delayMs}ms` }}
    >
      {/* Grande icône du thème en filigrane, sous le contenu (isolate + -z-10). */}
      <Icon
        icon={getCategoryIcon(category)}
        aria-hidden
        width={120}
        height={120}
        className="pointer-events-none absolute -z-10 right-1 -bottom-3 rotate-12 opacity-[0.22] select-none"
      />

      {/* Étiquette de catégorie penchée, à cheval sur le bord haut. */}
      <span
        className="absolute -top-3.5 left-3.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[9px] border-2 border-black stack-shadow-sm -rotate-[2.5deg] font-display font-bold text-[13px] tracking-[0.05em] text-black"
        style={{ backgroundColor: color }}
      >
        <Icon icon={getCategoryIcon(category)} width={16} height={16} aria-hidden style={{ filter: STICKER_FILTER }} />
        {category}
      </span>

      {/* « Idéal pour » + flèche (toute la fiche ouvre le sélecteur, où sont la
          description de la catégorie et les thèmes non choisis). */}
      <span className="flex items-center gap-2">
        <CategoryAudience category={category} className="flex-1 min-w-0" />
        <LuChevronRight
          size={18}
          strokeWidth={2.5}
          aria-hidden
          className="ml-auto shrink-0 text-black/60 group-hover:text-black transition-[color,transform] duration-200 group-hover:translate-x-0.5"
        />
      </span>

      <span aria-hidden className="w-full border-t-[1.5px] border-dashed border-black/20" />

      <span className="flex flex-wrap items-center gap-1.5 min-h-[1.5rem]">
        {chips.length === 0 ? (
          <span className="font-display text-xs italic text-gray-500 px-1">{t.themePicker.emptyState}</span>
        ) : (
          chips.map(info => (
            <span
              key={info.code}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border-2 border-black font-display text-xs font-bold tracking-tight text-black [box-shadow:1.5px_1.5px_0_0_black]"
              style={{ backgroundColor: getSoftCategoryColor(category) }}
            >
              <Icon icon={info.emoji} width={14} height={14} aria-hidden style={{ filter: STICKER_FILTER }} />
              <span>{info.name}</span>
              {info.premium && (
                <span
                  aria-label={t.themePicker.premiumBadge}
                  className="w-4 h-4 flex items-center justify-center rounded-full border-[1.5px] border-black text-black bg-premium-gold"
                >
                  <LuCrown size={9} strokeWidth={3} aria-hidden />
                </span>
              )}
            </span>
          ))
        )}
      </span>
    </button>
  );
};

export default LobbyThemesPanel;
