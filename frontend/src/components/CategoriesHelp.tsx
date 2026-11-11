import { Icon } from './Icon';
import { useLocale } from '../i18n';
import { getCategoryIcon } from '../constants/game';
import { STICKER_FILTER } from '../constants/icons';
import HelpBubble from './HelpBubble';

/**
 * Bouton « ? » + bulle expliquant les catégories de thèmes (Icebreakers, Fun, Deep) :
 * une liste sobre (icône, nom, explication), séparée par des filets pointillés, sans blocs.
 */
const CategoriesHelp = ({ categories, className }: { categories: string[]; className?: string }) => {
  const { t } = useLocale();
  return (
    <HelpBubble className={className}>
      <p className="!mt-0 !mb-3 font-sans text-[13px] font-semibold leading-snug text-black">{t.decks.categoryHelpIntro}</p>
      <ul className="flex flex-col !m-0 !p-0 list-none">
        {categories.map((cat, i) => (
          <li
            key={cat}
            className={`flex items-start gap-2.5 ${i > 0 ? 'mt-2.5 pt-2.5 border-t-[1.5px] border-dashed border-brand-700/20' : ''}`}
          >
            <Icon icon={getCategoryIcon(cat)} width={28} height={28} aria-hidden className="shrink-0" style={{ filter: STICKER_FILTER }} />
            <span className="min-w-0 flex flex-col gap-0.5">
              <b className="font-display text-sm tracking-[0.04em] leading-none">{cat}</b>
              <span className="font-sans text-[13px] leading-snug text-gray-700">{t.decks.categoryHelp[cat] ?? ''}</span>
            </span>
          </li>
        ))}
      </ul>
    </HelpBubble>
  );
};

export default CategoriesHelp;
