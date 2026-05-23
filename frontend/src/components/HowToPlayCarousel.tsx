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
        Chaque manche, un joueur devient <Pilier>pilier</Pilier> et choisit une question parmis celles proposées.
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
        <Pilier>Le pilier</Pilier> doit deviner qui l'a écrite et ré-attribue chaque réponse. <Joueurs>Les joueurs</Joueurs> montrent leur écran pour découvrir celle qu'on leur a donnée.
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

const HowToPlayCarousel = () => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [autoTick, setAutoTick] = useState(0); // bump to restart fill animation
  const [isPaused, setIsPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  // Suivi du temps écoulé sur l'étape courante pour reprendre la lecture exactement
  // là où on s'est arrêté (sinon le compteur se désynchroniserait à la reprise).
  const slideStartRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  const goTo = (i: number) => {
    const target = (i + STEPS.length) % STEPS.length;
    setDirection(target > index || (index === STEPS.length - 1 && target === 0) ? 1 : -1);
    setIndex(target);
    setAutoTick((t) => t + 1);
    setIsPaused(false);
  };
  const prev = () => goTo(index - 1);
  const next = () => goTo(index + 1);

  // Reset du temps écoulé à chaque changement d'étape
  useEffect(() => {
    elapsedRef.current = 0;
  }, [index, autoTick]);

  // Auto-play : reprend exactement avec le temps restant après une pause
  useEffect(() => {
    if (isPaused) {
      elapsedRef.current = Date.now() - slideStartRef.current;
      return;
    }
    const remaining = Math.max(0, getStepDuration(index) - elapsedRef.current);
    slideStartRef.current = Date.now() - elapsedRef.current;
    const id = window.setTimeout(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % STEPS.length);
      setAutoTick((t) => t + 1);
    }, remaining);
    return () => window.clearTimeout(id);
  }, [index, autoTick, isPaused]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    // Résistance élastique pour un suivi fluide sans débordement
    setDragX(Math.sign(delta) * Math.min(Math.abs(delta), 120));
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    setDragX(0);
    if (Math.abs(delta) > 40) {
      delta < 0 ? next() : prev();
    } else {
      setIsPaused(false);
    }
  };
  const onTouchCancel = () => {
    touchStartX.current = null;
    setDragX(0);
    setIsPaused(false);
  };

  const step = STEPS[index];
  const isDragging = dragX !== 0;

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
              horizontal du drag mais on laisse le halo / l'image dépasser verticalement. */}
          <div
            className="relative w-full flex items-center justify-center h-[210px] md:h-[240px]"
            style={{ overflowX: 'clip', overflowY: 'visible' }}
          >
            {/* Wrapper de drag : applique le translateX du doigt et revient à 0 sans
                relancer l'anim d'apparition de l'illustration. */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translateX(${dragX}px)`,
                transition: isDragging ? 'none' : 'transform 0.25s ease-out',
              }}
            >
              {/* Illustration centrale - animée uniquement quand l'étape change */}
              <div
                key={index}
                className="flex items-center justify-center"
                style={{
                  animation: `comic-slide-${direction === 1 ? 'r' : 'l'} 0.45s cubic-bezier(0.34, 1.4, 0.5, 1) both`,
                }}
              >
                <div
                  className="relative"
                  style={{
                    filter: 'drop-shadow(3px 4px 0 rgba(0,0,0,0.18))',
                  }}
                >
                  {/* Halo jaune derrière - libre de déborder grâce à overflow-y: visible */}
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
                    src={step.image}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="relative z-10 w-[280px] h-[280px] md:w-[370px] md:h-[370px] object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Numéro sticker */}
          <div
            className="absolute -top-2 left-1 z-20 w-11 h-11 rounded-full flex items-center justify-center font-display font-bold text-xl text-gray-900 border-[2.5px] border-black overflow-hidden"
            style={{
              backgroundColor: '#ffffff',
              transform: 'rotate(-8deg)',
              boxShadow: '2px 2px 0 0 #000',
            }}
          >
            <span
              key={`fill-${index}-${autoTick}`}
              aria-hidden
              className="absolute left-0 right-0 bottom-0"
              style={{
                backgroundColor: ACCENT,
                animation: `bubble-fill ${getStepDuration(index)}ms linear forwards`,
                animationPlayState: isPaused ? 'paused' : 'running',
              }}
            />
            <span className="relative z-10">{step.n}</span>
          </div>
        </div>
      </div>

      {/* Texte de l'étape - tous les steps sont empilés dans la même cellule grid
          pour que le conteneur prenne la hauteur du plus long et ne tressaute pas.
          On applique le translateX du drag sur un wrapper externe pour que le texte
          suive le doigt sans rejouer l'anim au relâchement. */}
      <div className="w-full px-1 overflow-hidden">
        <div
          className="grid w-full"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: isDragging ? 'none' : 'transform 0.25s ease-out',
          }}
        >
          {STEPS.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.n}
                aria-hidden={!active}
                className="text-center"
                style={{
                  gridArea: '1 / 1',
                  visibility: active ? 'visible' : 'hidden',
                  animation: active
                    ? `comic-slide-${direction === 1 ? 'r' : 'l'} 0.45s cubic-bezier(0.34, 1.4, 0.5, 1) both`
                    : undefined,
                }}
              >
                <p className="text-sm md:text-base text-gray-800 m-0 leading-snug">
                  {s.text}
                </p>
              </div>
            );
          })}
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
        @keyframes comic-slide-r {
          0% { opacity: 0; transform: translateX(40%) rotate(6deg) scale(0.85); }
          100% { opacity: 1; transform: translateX(0) rotate(0) scale(1); }
        }
        @keyframes comic-slide-l {
          0% { opacity: 0; transform: translateX(-40%) rotate(-6deg) scale(0.85); }
          100% { opacity: 1; transform: translateX(0) rotate(0) scale(1); }
        }
        @keyframes comic-fade-up {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes bubble-fill {
          0%   { height: 0%; }
          100% { height: 100%; }
        }
      `}</style>
    </div>
  );
};

export default HowToPlayCarousel;
