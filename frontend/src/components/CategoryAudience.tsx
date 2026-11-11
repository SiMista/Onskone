import { Fragment } from 'react';
import { CATEGORY_AUDIENCES } from '../constants/game';
import { useLocale } from '../i18n';

/**
 * « Idéal pour » d'une catégorie de thèmes : petit libellé puis les types de groupe
 * conseillés, en simple ligne de texte séparée par des « · ». Pas
 * de pastilles : sur la fiche, les seules pastilles sont les thèmes choisis (deux
 * rangées de pastilles au sens différent se confondaient). Posé sur les fiches de
 * l'onglet Thèmes et dans le bandeau du sélecteur. En `span` : il vit aussi dans un
 * <button> (fiche cliquable).
 */
const CategoryAudience = ({ category, className = '' }: { category: string; className?: string }) => {
  const { t } = useLocale();
  const audiences = CATEGORY_AUDIENCES[category];
  if (!audiences?.length) return null;

  return (
    // items-baseline : le libellé (11 px, majuscules) et les groupes (12 px) n'ont pas la
    // même taille ; centrés par leur boîte, leurs textes paraissaient décalés.
    <span className={`flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${className}`}>
      <span className="text-display-xs text-black/50">{t.decks.idealFor}</span>
      {audiences.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && <span aria-hidden className="text-black/30">·</span>}
          <span className="font-display text-xs font-semibold leading-tight text-black/80">
            {t.decks.audiences[key]}
          </span>
        </Fragment>
      ))}
    </span>
  );
};

export default CategoryAudience;
