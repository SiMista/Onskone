import { useState, useRef, useEffect, ReactNode } from 'react';
import step1Img from '../assets/images/home/1-question_selection.png';
import step2Img from '../assets/images/home/2-answering.png';
import step3Img from '../assets/images/home/3-guessing.png';
import step4Img from '../assets/images/home/4-reveal.png';

type Step = {
  n: number;
  image: string;
  text: ReactNode;
};

const ACCENT = '#F5B800';
const ACCENT_PAUSED = '#b8860b';

// Surligneurs : réutilisent l'utility .marker-highlight (même effet feutre que
// les titres de modales), juste avec une couleur override par rôle.
const Pilier = ({ children }: { children: ReactNode }) => (
  <span className="marker-highlight marker-highlight--inline font-bold">{children}</span>
);
const Joueurs = ({ children }: { children: ReactNode }) => (
  <span
    className="marker-highlight marker-highlight--inline font-bold"
    style={{ ['--marker-color' as string]: 'var(--color-brand-200)' }}
  >
    {children}
  </span>
);

const STEPS: Step[] = [
  {
    n: 1,
    image: step1Img,
    text: (
      <>
        Chaque manche, un joueur devient <Pilier>pilier</Pilier> et choisit une question parmi celles proposées.
      </>
    ),
  },
  {
    n: 2,
    image: step2Img,
    text: (
      <>
        <Joueurs>Les joueurs</Joueurs> reçoivent la question et écrivent leur réponse, <b>anonymement</b>.
      </>
    ),
  },
  {
    n: 3,
    image: step3Img,
    text: (
      <>
        <Pilier>Le pilier</Pilier> attribue chaque réponse au joueur qui l'a écrite selon lui. <Joueurs>Les joueurs</Joueurs> montrent leur écran pour découvrir quelle réponse le pilier leur a attribuée.
      </>
    ),
  },
  {
    n: 4,
    image: step4Img,
    text: (
      <>
        <Pilier>Le pilier</Pilier> dévoile qui a écrit quoi et il marque des points pour le groupe s'il a bien deviné.
      </>
    ),
  },
];

const SLIDE_DURATION = 7000;
// Le step 3 a un texte plus long : on lui donne 1s de plus pour le lire.
const STEP_DURATION_OVERRIDES: Record<number, number> = {
  2: 9000,
};
const getStepDuration = (i: number) => STEP_DURATION_OVERRIDES[i] ?? SLIDE_DURATION;

const SLIDE_ANIM_MS = 600;
const SLIDE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

// Track avec un "ghost" à chaque extrémité (copie de la dernière slide à gauche,
// copie de la première à droite) pour que la boucle 3→0 et 0→3 se joue toujours
// dans le bon sens visuel. Après l'animation, on resync l'index sans transition.
const TRACK_SLIDES: Step[] = [STEPS[STEPS.length - 1], ...STEPS, STEPS[0]];

const Illustration = ({ image }: { image: string }) => (
  <div
    className="relative"
    style={{ filter: 'drop-shadow(3px 4px 0 rgba(0,0,0,0.18))' }}
  >
    <span
      aria-hidden
      className="absolute top-1/2 left-1/2 -z-0 rounded-full"
      style={{
        width: '75%',
        height: '75%',
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, ${ACCENT}26 0%, transparent 65%)`,
      }}
    />
    <img
      src={image}
      alt=""
      aria-hidden
      draggable={false}
      className="relative z-10 w-[280px] h-[280px] md:w-[370px] md:h-[370px] object-contain"
    />
  </div>
);

const HowToPlayCarousel = () => {
  // displayIndex peut sortir de [0, STEPS.length) pour viser les ghosts (-1 ou STEPS.length).
  // index reste toujours l'index logique courant.
  const [displayIndex, setDisplayIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [autoTick, setAutoTick] = useState(0); // bump to restart fill animation
  const [isPaused, setIsPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  // Suivi du temps écoulé pour reprendre l'autoplay là où on s'est arrêté.
  const slideStartRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  const index = ((displayIndex % STEPS.length) + STEPS.length) % STEPS.length;
  const step = STEPS[index];

  const advance = () => {
    setAnimate(true);
    setDisplayIndex((d) => d + 1);
    setAutoTick((t) => t + 1);
  };

  const goTo = (i: number) => {
    const target = ((i % STEPS.length) + STEPS.length) % STEPS.length;
    if (target === index) {
      setIsPaused(false);
      return;
    }
    // Conserver la convention "3→0 = forward" et "0→3 = backward"
    const forward = target > index || (index === STEPS.length - 1 && target === 0);
    let nextDisplay: number;
    if (forward && target < index) nextDisplay = STEPS.length; // ghost à droite
    else if (!forward && target > index) nextDisplay = -1;     // ghost à gauche
    else nextDisplay = target;
    setAnimate(true);
    setDisplayIndex(nextDisplay);
    setAutoTick((t) => t + 1);
    setIsPaused(false);
  };

  // Reset du temps écoulé à chaque changement d'étape
  useEffect(() => {
    elapsedRef.current = 0;
  }, [index, autoTick]);

  // Auto-play : reprend avec le temps restant après une pause
  useEffect(() => {
    if (isPaused) {
      elapsedRef.current = Date.now() - slideStartRef.current;
      return;
    }
    const remaining = Math.max(0, getStepDuration(index) - elapsedRef.current);
    slideStartRef.current = Date.now() - elapsedRef.current;
    const id = window.setTimeout(advance, remaining);
    return () => window.clearTimeout(id);
  }, [index, autoTick, isPaused]);

  // Snap silencieux quand on atteint un ghost (displayIndex hors [0, STEPS.length))
  const onTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== 'transform') return;
    if (displayIndex >= 0 && displayIndex < STEPS.length) return;
    setAnimate(false);
    setDisplayIndex(((displayIndex % STEPS.length) + STEPS.length) % STEPS.length);
    // Réactiver l'animation pour les transitions suivantes après que le snap soit peint
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
    setAnimate(false); // suivi 1:1 du doigt sans transition
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    setDragX(delta);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    setDragX(0);
    setAnimate(true);
    if (Math.abs(delta) > 40) {
      // Le track continue dans la direction du swipe ; pas de double animation.
      setDisplayIndex((d) => d + (delta < 0 ? 1 : -1));
      setAutoTick((t) => t + 1);
    }
    setIsPaused(false);
  };
  const onTouchCancel = () => {
    touchStartX.current = null;
    setDragX(0);
    setAnimate(true);
    setIsPaused(false);
  };

  // TRACK_SLIDES = [ghost-last, s0, s1, s2, s3, ghost-first]
  // displayIndex = -1 → position 0 (ghost-last), 0 → position 1 (s0), etc.
  const trackPosition = displayIndex + 1;
  const trackTransform = `translateX(calc(${-trackPosition * 100}% + ${dragX}px))`;
  const trackTransition = animate ? `transform ${SLIDE_ANIM_MS}ms ${SLIDE_EASE}` : 'none';

  return (
    <div
      className="w-full flex flex-col items-center gap-4 select-none pt-4 touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Illustration */}
      <div className="relative w-full">
        <div className="relative w-full">
          {/* overflow-x: clip + overflow-y: visible -> on bloque le débordement
              horizontal du track mais on laisse le halo / l'image dépasser verticalement. */}
          <div
            className="relative w-full h-[210px] md:h-[240px]"
            style={{ overflowX: 'clip', overflowY: 'visible' }}
          >
            <div
              className="absolute inset-0 flex"
              style={{
                transform: trackTransform,
                transition: trackTransition,
                willChange: 'transform',
              }}
              onTransitionEnd={onTrackTransitionEnd}
            >
              {TRACK_SLIDES.map((s, i) => (
                <div
                  key={`ill-${i}`}
                  className="w-full flex-shrink-0 flex items-center justify-center"
                >
                  <Illustration image={s.image} />
                </div>
              ))}
            </div>
          </div>

          {/* Numéro sticker - reste fixe, reflète l'index logique */}
          <div
            className="absolute -top-2 left-1 z-20 w-11 h-11 rounded-full flex items-center justify-center font-display font-bold text-xl text-gray-900 border-[2.5px] border-black overflow-hidden"
            style={{
              backgroundColor: '#ffffff',
              transform: `rotate(-8deg) scale(${isPaused ? 0.94 : 1})`,
              boxShadow: '2px 2px 0 0 #000',
              transition: 'transform 0.2s ease-out',
            }}
          >
            <span
              key={`fill-${index}-${autoTick}`}
              aria-hidden
              className="absolute left-0 right-0 bottom-0"
              style={{
                backgroundColor: isPaused ? ACCENT_PAUSED : ACCENT,
                animation: `bubble-fill ${getStepDuration(index)}ms linear forwards`,
                animationPlayState: isPaused ? 'paused' : 'running',
                transition: 'background-color 0.2s ease-out',
              }}
            />
            <span className="relative z-10">{step.n}</span>
          </div>
        </div>
      </div>

      {/* Texte - même track synchronisé avec l'illustration */}
      <div className="w-full overflow-hidden">
        <div
          className="flex"
          style={{
            transform: trackTransform,
            transition: trackTransition,
            willChange: 'transform',
          }}
        >
          {TRACK_SLIDES.map((s, i) => (
            <div
              key={`txt-${i}`}
              className="w-full flex-shrink-0 px-1 text-center"
            >
              <p className="text-sm md:text-base text-gray-800 m-0 leading-snug">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stepper dots */}
      <div className="flex items-center gap-2 pt-1">
        {STEPS.map((s, i) => {
          const active = i === index;
          return (
            <button
              key={s.n}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Aller à l'étape ${s.n}`}
              className="cursor-pointer transition-all duration-200"
              style={{
                width: active ? 28 : 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: active ? ACCENT : '#d4d4d4',
                border: '2px solid #000',
                boxShadow: active ? '1px 2px 0 0 #000' : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Animations locales */}
      <style>{`
        @keyframes bubble-fill {
          0%   { height: 0%; }
          100% { height: 100%; }
        }
      `}</style>
    </div>
  );
};

export default HowToPlayCarousel;
