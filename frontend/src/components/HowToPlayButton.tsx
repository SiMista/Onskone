import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../i18n';
import { studioStorage } from '../utils/studioStorage';
import { getStats } from '../utils/playerStats';

type HowToPlayButtonProps = {
  onClick: () => void;
  className?: string;
  /**
   * Alignement de la bulle « première fois » sous le bouton : 'center' quand le
   * bouton est centré (accueil), 'end' quand il est collé au bord droit (lobby),
   * pour que la bulle ne déborde pas de l'écran.
   */
  hintAlign?: 'center' | 'end';
};

// Bulle affichée UNE SEULE FOIS dans la vie du joueur : au tout premier passage
// (jamais vue ET aucune partie jouée). Marquée « vue » dès son affichage.
// ⚠️ Ne JAMAIS renommer ni versionner cette clé (ex. après un changement de
// style de la bulle) : tous les joueurs existants la reverraient.
const SEEN_KEY = 'onskone_howtoplay_seen';

const isFirstVisit = (): boolean => {
  try {
    if (studioStorage.getItem(SEEN_KEY) === '1') return false;
    return getStats().gamesPlayed === 0;
  } catch {
    return false;
  }
};

// Pill ghost : miroir du BackButton, translation hover vers la droite.
const HowToPlayButton = ({ onClick, className = '', hintAlign = 'center' }: HowToPlayButtonProps) => {
  const { t } = useLocale();
  const [hintVisible, setHintVisible] = useState(isFirstVisit);
  // Sortie animée : la bulle reste montée le temps de hint-bubble-out.
  const [hintLeaving, setHintLeaving] = useState(false);
  // Vrai une fois le pop d'entrée lancé (il a 600ms de délai). Un tap AVANT ne
  // doit pas jouer la sortie : la bulle, encore invisible, flasherait à l'écran.
  const popStartedRef = useRef(false);

  const dismissHint = () => {
    if (!popStartedRef.current) {
      setHintVisible(false);
      return;
    }
    setHintLeaving(true);
    // Filet si animationend ne tombe pas (animation coupée par le navigateur).
    setTimeout(() => setHintVisible(false), 300);
  };

  // Marquée vue dès qu'elle s'affiche : elle ne reviendra plus, même si le
  // joueur ne l'a pas lue ni n'a ouvert le tuto.
  useEffect(() => {
    if (!hintVisible) return;
    try { studioStorage.setItem(SEEN_KEY, '1'); } catch { /* silent */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Masquée au premier tap n'importe où.
  useEffect(() => {
    if (!hintVisible || hintLeaving) return;
    document.addEventListener('pointerdown', dismissHint, { capture: true, once: true });
    return () => document.removeEventListener('pointerdown', dismissHint, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintVisible, hintLeaving]);

  // Le pointerdown a déjà lancé la sortie : le clic ouvre juste le tuto.
  const handleClick = () => {
    onClick();
  };

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t.howToPlay.ariaButton}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-[1.5px] border-transparent text-white/75 font-display font-bold text-[11px] uppercase tracking-[0.12em] cursor-pointer transition-all duration-200 ease-out hover:translate-x-0.5 active:translate-x-0 active:translate-y-0.5 hover:bg-white/15 hover:border-white/40 hover:text-white"
      >
        <span>{t.howToPlay.button}</span>
      </button>

      {hintVisible && (
        // Positionnement sur l'externe, pop (qui anime transform) sur l'interne :
        // sinon l'animation écrasait le -translate-x du centrage.
        <span
          role="status"
          className={`pointer-events-none absolute top-full mt-2.5 z-20 ${hintAlign === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}
        >
          <span
            onAnimationStart={() => { popStartedRef.current = true; }}
            onAnimationEnd={() => { if (hintLeaving) setHintVisible(false); }}
            className={`${hintLeaving ? 'animate-hint-bubble-out' : 'animate-player-pop'} ${hintAlign === 'end' ? 'origin-top-right' : 'origin-top'} relative block w-max max-w-[280px] px-3 py-1.5 rounded-xl border-2 border-black bg-white stack-shadow-sm font-display font-bold text-xs text-black text-center leading-snug`}
            style={hintLeaving ? undefined : { animationDelay: '600ms' }}
          >
            {/* Queue de la bulle, pointée vers le bouton */}
            <span
              aria-hidden
              className={`absolute -top-[7px] w-3 h-3 rotate-45 bg-white border-l-2 border-t-2 border-black ${hintAlign === 'end' ? 'right-5' : 'left-1/2 -ml-1.5'}`}
            />
            {t.howToPlay.firstTimeHint}
          </span>
        </span>
      )}
    </span>
  );
};

export default HowToPlayButton;
