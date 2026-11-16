import { Icon } from './Icon';
import { useLocale } from '../i18n';
import { getCategoryColor, getCategoryIcon } from '../constants/game';
import { STICKER_FILTER } from '../constants/icons';
import HelpBubble from './HelpBubble';

/**
 * Bouton « ? » + bulle expliquant les catégories de thèmes (Icebreakers, Fun, Deep) :
 * une liste sobre (icône, nom, explication), séparée par des filets pointillés, sans blocs.
 * Le nom est dans une mini-étiquette (droite) à la couleur de sa catégorie, celle des
 * fiches de l'onglet Thèmes : on fait le lien d'un coup d'œil entre la bulle et la fiche.
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
            <span className="min-w-0 flex flex-col gap-1.5">
              <b
                className="self-start px-2 py-0.5 rounded-[7px] border-2 border-black stack-shadow-sm font-display font-bold text-xs tracking-[0.05em] leading-none text-black"
                style={{ backgroundColor: getCategoryColor(cat) }}
              >
                {cat}
              </b>
              <span className="font-sans text-[13px] leading-snug text-gray-700">{t.decks.categoryHelp[cat] ?? ''}</span>
            </span>
          </li>
        ))}
      </ul>
    </HelpBubble>
  );
};

export default CategoriesHelp;
