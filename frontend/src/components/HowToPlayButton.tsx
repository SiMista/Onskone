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

// Durée minimale d'affichage après le pop : un tap distrait (le joueur tape son
// pseudo, ferme le clavier...) ne la fait plus disparaître avant qu'il l'ait lue.
const HINT_MIN_VISIBLE_MS = 5000;

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
  // Instant (performance.now) où le pop d'entrée a démarré (il a 600ms de délai) ;
  // null avant. Une sortie AVANT ne doit pas jouer d'animation : la bulle, encore
  // invisible, flasherait à l'écran.
  const poppedAtRef = useRef<number | null>(null);
  const [popped, setPopped] = useState(false);
  // Le joueur a tapé quelque part : la bulle partira, mais pas avant HINT_MIN_VISIBLE_MS.
  const [dismissRequested, setDismissRequested] = useState(false);

  const markPopped = () => {
    if (poppedAtRef.current !== null) return;
    poppedAtRef.current = performance.now();
    setPopped(true);
  };

  // Filet si animationstart ne tombe pas (animation coupée) : considérée apparue à
  // la fin de son délai d'entrée, sinon un tap ne pourrait plus jamais la fermer.
  useEffect(() => {
    if (!hintVisible) return;
    const timer = setTimeout(markPopped, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marquée vue dès qu'elle s'affiche : elle ne reviendra plus, même si le
  // joueur ne l'a pas lue ni n'a ouvert le tuto.
  useEffect(() => {
    if (!hintVisible) return;
    try { studioStorage.setItem(SEEN_KEY, '1'); } catch { /* silent */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Premier tap n'importe où : demande de sortie (différée, cf. effet suivant).
  useEffect(() => {
    if (!hintVisible || dismissRequested) return;
    const onTap = () => setDismissRequested(true);
    document.addEventListener('pointerdown', onTap, { capture: true, once: true });
    return () => document.removeEventListener('pointerdown', onTap, { capture: true });
  }, [hintVisible, dismissRequested]);

  // Sortie au plus tôt HINT_MIN_VISIBLE_MS après le pop. Un tap pendant le délai
  // d'entrée attend donc l'apparition, puis le temps de lecture.
  useEffect(() => {
    if (!dismissRequested || !popped || hintLeaving || poppedAtRef.current === null) return;
    const remaining = Math.max(0, HINT_MIN_VISIBLE_MS - (performance.now() - poppedAtRef.current));
    const timer = setTimeout(() => setHintLeaving(true), remaining);
    return () => clearTimeout(timer);
  }, [dismissRequested, popped, hintLeaving]);

  // Filet si animationend ne tombe pas (animation coupée par le navigateur).
  useEffect(() => {
    if (!hintLeaving) return;
    const timer = setTimeout(() => setHintVisible(false), 300);
    return () => clearTimeout(timer);
  }, [hintLeaving]);

  // Clic sur le bouton : la bulle a rempli son rôle, elle part tout de suite.
  const handleClick = () => {
    if (hintVisible) {
      if (popped) setHintLeaving(true);
      else setHintVisible(false);
    }
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
          className={`pointer-events-none absolute top-full mt-3 z-20 ${hintAlign === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}
        >
          <span
            onAnimationStart={markPopped}
            onAnimationEnd={() => { if (hintLeaving) setHintVisible(false); }}
            className={`${hintLeaving ? 'animate-hint-bubble-out' : 'animate-player-pop'} ${hintAlign === 'end' ? 'origin-top-right' : 'origin-top'} relative block w-max max-w-[300px] px-4 py-2.5 rounded-2xl border-2 border-black bg-white stack-shadow font-display font-bold text-sm text-black text-center leading-snug`}
            style={hintLeaving ? undefined : { animationDelay: '600ms' }}
          >
            {/* Queue de la bulle, pointée vers le bouton */}
            <span
              aria-hidden
              className={`absolute -top-[9px] w-4 h-4 rotate-45 bg-white border-l-2 border-t-2 border-black ${hintAlign === 'end' ? 'right-6' : 'left-1/2 -ml-2'}`}
            />
            {t.howToPlay.firstTimeHint}
          </span>
        </span>
      )}
    </span>
  );
};

export default HowToPlayButton;
