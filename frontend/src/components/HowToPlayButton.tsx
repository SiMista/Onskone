import { useLocale } from '../i18n';

type HowToPlayButtonProps = {
  onClick: () => void;
  className?: string;
};

// Pill ghost : miroir du BackButton, translation hover vers la droite.
const HowToPlayButton = ({ onClick, className = '' }: HowToPlayButtonProps) => {
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t.howToPlay.ariaButton}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-[1.5px] border-transparent text-white/75 font-display font-bold text-[11px] uppercase tracking-[0.12em] cursor-pointer transition-all duration-200 ease-out hover:translate-x-0.5 active:translate-x-0 active:translate-y-0.5 hover:bg-white/15 hover:border-white/40 hover:text-white ${className}`}
    >
      <span>{t.howToPlay.button}</span>
    </button>
  );
};

export default HowToPlayButton;
