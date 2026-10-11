import { LuCrown } from 'react-icons/lu';
import { useLocale } from '../i18n';

/**
 * Pastille "PREMIUM" d'une carte question issue d'un thème premium
 * (`GameCard.premium`). Posée en haut à droite, en miroir de la pastille
 * catégorie (haut gauche) : mêmes tailles, mêmes paddings.
 *
 * Statique : pas d'anim idle, l'accent animé de l'écran reste sur l'action
 * en cours (cf. conventions animations).
 */
const PremiumCardBadge = ({ size = 'md', className = '' }: {
  /** `md` = main de cartes (sélection), `sm` = mini-carte compacte des phases suivantes. */
  size?: 'sm' | 'md';
  className?: string;
}) => {
  const { t } = useLocale();
  const isSm = size === 'sm';

  return (
    <span
      className={`bg-premium-gold font-display inline-flex items-center gap-1 rounded-full border-[1.5px] border-black text-black font-bold uppercase tracking-[0.08em] leading-none shadow-[0_2px_0_0_rgba(0,0,0,0.15)] ${
        isSm ? 'text-[9px] md:text-[10px] px-1.5 py-[3px]' : 'text-[11px] md:text-sm px-2.5 py-1'
      } ${className}`}
    >
      <LuCrown
        className={isSm ? 'w-2.5 h-2.5 md:w-3 md:h-3' : 'w-3 h-3 md:w-3.5 md:h-3.5'}
        strokeWidth={2.75}
        aria-hidden
      />
      {t.themePicker.premiumBadge}
    </span>
  );
};

export default PremiumCardBadge;
