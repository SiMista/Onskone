import { useState, useRef, useEffect, ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

type Step = {
  n: number;
  icon: string;
  title: string;
  text: ReactNode;
  tint: string; // bg color of the comic panel
  accent: string; // dot/decor color
};

const STEPS: Step[] = [
  {
    n: 1,
    icon: 'fluent-emoji-flat:crown',
    title: 'Le pilier',
    text: (
      <>
        Un joueur est désigné <b>pilier</b>. Il pioche une question parmi trois cartes.
      </>
    ),
    tint: '#FFF7DD',
    accent: '#F5B800',
  },
  {
    n: 2,
    icon: 'fluent-emoji-flat:memo',
    title: 'Tout le monde répond',
    text: (
      <>
        Chacun écrit sa réponse à la question, <b>anonymement</b>.
      </>
    ),
    tint: '#E6F4FF',
    accent: '#18BBED',
  },
  {
    n: 3,
    icon: 'fluent-emoji-flat:magnifying-glass-tilted-left',
    title: 'L\'enquête du pilier',
    text: (
      <>
        Le pilier reçoit toutes les réponses et <b>devine qui</b> a écrit quoi.
      </>
    ),
    tint: '#FCE8F1',
    accent: '#EC4899',
  },
  {
    n: 4,
    icon: 'fluent-emoji-flat:party-popper',
    title: 'La révélation',
    text: (
      <>
        On dévoile les auteurs, le pilier marque des points <b>pour l'équipe</b>.
      </>
    ),
    tint: '#E7F8E7',
    accent: '#22C55E',
  },
];

const SLIDE_DURATION = 4000;

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
    <div className="w-full flex flex-col items-center gap-4 select-none">
      {/* Comic panel + flèches */}
      <div className="relative w-full flex items-center gap-2">
        {/* Flèche gauche */}
        <button
          type="button"
          onClick={prev}
          aria-label="Étape précédente"
          className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-black hover:scale-110 active:scale-95 transition-all cursor-pointer z-10"
        >
          <LuChevronLeft size={28} strokeWidth={3} />
        </button>

        {/* Panel */}
        <div
          className="relative flex-1 overflow-hidden rounded-2xl border-[2.5px] border-black texture-paper"
          style={{
            backgroundColor: step.tint,
            boxShadow: '4px 4px 0 0 #000, 8px 8px 0 0 rgba(0,0,0,0.15)',
            aspectRatio: '1 / 0.78',
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Lignes d'action décoratives */}
          <svg
            aria-hidden
            className="absolute inset-0 w-full h-full opacity-30"
            viewBox="0 0 100 78"
            preserveAspectRatio="none"
          >
            <g stroke="black" strokeWidth="0.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="18" y2="6" />
              <line x1="82" y1="8" x2="95" y2="14" />
              <line x1="6" y1="68" x2="20" y2="74" />
              <line x1="80" y1="72" x2="94" y2="66" />
            </g>
          </svg>

          {/* Dots */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: `radial-gradient(${step.accent}55 1px, transparent 1px)`,
              backgroundSize: '12px 12px',
            }}
          />

          {/* Numéro sticker - se remplit pendant les 4s */}
          <div
            className="absolute top-3 left-3 z-10 w-11 h-11 rounded-full flex items-center justify-center font-display font-bold text-xl text-gray-900 border-[2.5px] border-black overflow-hidden"
            style={{
              backgroundColor: '#ffffff',
              transform: 'rotate(-8deg)',
              boxShadow: '2px 2px 0 0 #000',
            }}
          >
            {/* Couche de remplissage qui monte */}
            <span
              key={`fill-${index}-${autoTick}`}
              aria-hidden
              className="absolute left-0 right-0 bottom-0"
              style={{
                backgroundColor: step.accent,
                animation: `bubble-fill ${SLIDE_DURATION}ms linear forwards`,
              }}
            />
            <span className="relative z-10">{step.n}</span>
          </div>

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
                filter: 'drop-shadow(3px 4px 0 rgba(0,0,0,0.25))',
              }}
            >
              {/* Halo derrière */}
              <span
                aria-hidden
                className="absolute inset-0 m-auto w-[110%] h-[110%] -z-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${step.accent}33 0%, transparent 65%)`,
                }}
              />
              <Icon
                icon={step.icon}
                className="relative z-10"
                width={120}
                height={120}
                aria-hidden
              />
              {/* Étoiles décoratives autour */}
              <Icon
                icon="fluent-emoji-flat:sparkles"
                className="absolute -top-2 -right-3 animate-twinkle"
                width={28}
                height={28}
                aria-hidden
              />
              <Icon
                icon="fluent-emoji-flat:sparkles"
                className="absolute -bottom-1 -left-4 animate-twinkle-delay"
                width={20}
                height={20}
                aria-hidden
              />
            </div>
          </div>
        </div>

        {/* Flèche droite */}
        <button
          type="button"
          onClick={next}
          aria-label="Étape suivante"
          className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-700 hover:text-black hover:scale-110 active:scale-95 transition-all cursor-pointer z-10"
        >
          <LuChevronRight size={28} strokeWidth={3} />
        </button>
      </div>

      {/* Texte de l'étape */}
      <div
        key={`text-${index}`}
        className="text-center px-1"
        style={{ animation: 'comic-fade-up 0.4s ease-out both' }}
      >
        <h3 className="font-display font-bold text-lg md:text-xl text-gray-900 m-0 mb-1 tracking-tight">
          {step.title}
        </h3>
        <p className="text-sm md:text-base text-gray-700 m-0 leading-snug">
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
                backgroundColor: active ? s.accent : '#d4d4d4',
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
