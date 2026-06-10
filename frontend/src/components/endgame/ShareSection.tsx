import { Icon } from '@iconify/react';
import Button from '../Button';
import Spinner from '../Spinner';
import { useLocale } from '../../i18n';

interface ShareSectionProps {
  /** Pilote l'apparition (fade/translate) une fois le reveal terminé. */
  revealed: boolean;
  /** Vrai pendant le partage (spinner + bouton désactivé). */
  isSharing: boolean;
  onShare: () => void;
  onPlayAgain: () => void;
  onQuit: () => void;
}

/**
 * Bloc d'actions de fin de partie : lien "Partager" (image générée par
 * shareCard) + boutons "Rejouer" / "Quitter".
 */
const ShareSection: React.FC<ShareSectionProps> = ({
  revealed,
  isSharing,
  onShare,
  onPlayAgain,
  onQuit,
}) => {
  const { t } = useLocale();

  return (
    <div
      className={`flex flex-col items-center gap-3 mb-4 md:mb-6 transition-all duration-700 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
    >
      <button
        type="button"
        onClick={onShare}
        disabled={isSharing}
        className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-display transition-colors disabled:opacity-50 cursor-pointer"
      >
        {isSharing ? (
          <Spinner />
        ) : (
          <Icon icon="mdi:share-variant-outline" width="1.1em" height="1.1em" aria-hidden />
        )}
        <span>{t.endGame.share}</span>
      </button>
      <div className="flex flex-row justify-center items-center gap-3 md:gap-6">
        <Button variant="success" size="lg" onClick={onPlayAgain}>
          {t.endGame.playAgain}
        </Button>
        <Button variant="quit" size="lg" onClick={onQuit}>
          {t.endGame.quit}
        </Button>
      </div>
    </div>
  );
};

export default ShareSection;
