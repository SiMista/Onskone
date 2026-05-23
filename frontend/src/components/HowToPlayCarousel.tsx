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

const STEPS: Step[] = [
  {
    n: 1,
    image: step1Img,
    text: (
      <>
        Un joueur devient <b>pilier</b> et choisit une question parmi celles des trois cartes proposées.
      </>
    ),
  },
  {
    n: 2,
    image: step2Img,
    text: (
      <>
        Chacun reçoit la question et écrit sa réponse, <b>anonymement</b>.
      </>
    ),
  },
  {
    n: 3,
    image: step3Img,
    text: (
      <>
        Le pilier ré-attribue chaque réponse et doit deviner qui l'a écrite. Les joueurs, <b>montrent leur écran</b> pour découvrir celle qu'on leur a donnée.
      </>
    ),
  },
  {
    n: 4,
    image: step4Img,
    text: (
      <>
        On dévoile qui à écrit quoi et le pilier marque des points <b>pour l'équipe</b> si il a bien deviné.
      </>
    ),
  },
];

const SLIDE_DURATION = 5000;

const HowToPlayCarousel = () => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [autoTick, setAutoTick] = useState(0); // bump to restart fill animation
  const touchStartX = useRef<number | null>(null);

  const goTo = (i: number) => {
    const target = (i + STEPS.length) % STEPS.length;
    setDirection(target > index || (index === STEPS.length - 1 && target === 0) ? 1 : -1);
    setIndex(target);
    setAutoTick((t) => t + 1);
  };
  const prev = () => goTo(index - 1);
  const next = () => goTo(index + 1);

  // Auto-play 4s par étape
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % STEPS.length);
      setAutoTick((t) => t + 1);
    }, SLIDE_DURATION);
    return () => window.clearTimeout(id);
  }, [index, autoTick]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      delta < 0 ? next() : prev();
    }
    touchStartX.current = null;
  };

  const step = STEPS[index];

  return (
    <div className="w-full flex flex-col items-center gap-4 select-none pt-4">
      {/* Illustration */}
      <div className="relative w-full">
        <div className="relative w-full" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div
            className="relative w-full flex items-center justify-center"
            style={{ aspectRatio: '1 / 0.78' }}
          >
            {/* Illustration centrale - animée à chaque changement */}
            <div
              key={index}
              className="absolute inset-0 flex items-center justify-center"
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
                {/* Halo jaune derrière */}
                <span
                  aria-hidden
                  className="absolute inset-0 m-auto w-[130%] h-[130%] -z-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${ACCENT}44 0%, transparent 65%)`,
                  }}
                />
                <img
                  src={step.image}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="relative z-10 w-[260px] h-[260px] md:w-[300px] md:h-[300px] object-contain"
                />
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
                animation: `bubble-fill ${SLIDE_DURATION}ms linear forwards`,
              }}
            />
            <span className="relative z-10">{step.n}</span>
          </div>
        </div>
      </div>

      {/* Texte de l'étape */}
      <div
        key={`text-${index}`}
        className="text-center px-1"
        style={{ animation: 'comic-fade-up 0.4s ease-out both' }}
      >
        <p className="text-sm md:text-base text-gray-800 m-0 leading-snug">
          {step.text}
        </p>
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
