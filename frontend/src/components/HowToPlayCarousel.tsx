import { useState, useRef, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import logoFr from '../assets/logos/logo-fr.png';
import logoEn from '../assets/logos/logo-en.png';
import { PUBLIC_TIERS } from '../constants/tiers';
import { useLocale } from '../i18n';
import { useSwipe } from '../hooks/useSwipe';
import type { HowToPlayMarkers } from '../i18n/dictionary';
import { AnimatedIllustration, STEP_ILLUSTRATIONS, ILLU_ANIM_DELAY_MS, illuDelay, type StepIllustration } from './StepIllustrations';

// 3 types de bulles : accueil (logo), étapes numérotées (illustration), fin (anneau de score).
// `n` = numéro du sticker : l'accueil porte le 1, les étapes vont de 2 à 5, la fin porte le 6.
type Step =
  | { kind: 'intro'; n: number; text: ReactNode }
  | { kind: 'step'; n: number; illustration: StepIllustration; text: ReactNode }
  | { kind: 'outro'; n: number; text: ReactNode };

const ACCENT = '#F5B800';
const ACCENT_PAUSED = '#b8860b';

// Surligneurs partagés : réutilisent l'utility .marker-highlight, palette dédiée
// par rôle (pilier = jaune, joueurs = bleu).
const MARKERS: HowToPlayMarkers = {
  Pilier: (children) => (
    <span className="marker-highlight marker-highlight--inline font-bold">{children}</span>
  ),
  Joueurs: (children) => (
    <span
      className="marker-highlight marker-highlight--inline font-bold"
      style={{ ['--marker-color' as string]: 'var(--color-brand-200)' }}
    >
      {children}
    </span>
  ),
};

const SLIDE_DURATION = 7000;
// Index dans la liste complète (intro = 0, étapes = 1..4, outro = 5) : les bulles
// au texte plus long ont plus de temps de lecture.
const STEP_DURATION_OVERRIDES: Record<number, number> = {
  0: 8000,
  // bulle 4 : texte le plus long + animation la plus chargée (cartes, écrans, traits)
  3: 10000,
  5: 8000,
};
const getStepDuration = (i: number) => STEP_DURATION_OVERRIDES[i] ?? SLIDE_DURATION;

const SLIDE_ANIM_MS = 600;
const SLIDE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const ILLU_SIZE =
  'w-[max(220px,min(308px,42dvh,calc(100vw-80px)))] h-[max(220px,min(308px,42dvh,calc(100vw-80px)))] md:w-[max(286px,min(407px,50dvh))] md:h-[max(286px,min(407px,50dvh))]';
// L'anneau de score reste plus compact que les stickmen.
const RING_SIZE =
  'w-[max(140px,min(190px,26dvh))] h-[max(140px,min(190px,26dvh))] md:w-[max(180px,min(250px,34dvh))] md:h-[max(180px,min(250px,34dvh))]';

const LOGO_BY_LOCALE = { fr: logoFr, en: logoEn } as Record<string, string>;

// Bulle d'accueil : le logo (sans slogan, le texte le dit déjà) en gros.
const LogoIllustration = () => {
  const { locale, t } = useLocale();
  return (
    <img
      src={LOGO_BY_LOCALE[locale] ?? logoFr}
      alt={t.seo.logoAlt}
      draggable={false}
      className="w-[max(200px,min(260px,36dvh))] md:w-[max(260px,min(340px,44dvh))] h-auto object-contain [filter:drop-shadow(3px_4px_0_rgba(0,0,0,0.18))]"
    />
  );
};

// Confettis de la bulle d'accueil : jaillissent du centre du logo à chaque activation
// puis restent FIXES à leur place, disposés en gerbe autour du logo — chaque pièce est placée
// sur un rayon partant du centre et orientée le long de ce rayon. Grosse gerbe en
// haut, petite en bas (plus serrée et plus clairsemée : le texte est juste en dessous).
// Couleurs = tokens, pas de hex.
const CONFETTI_COLORS = [
  'var(--color-success-400)',
  'var(--color-warning-300)',
  'var(--color-brand-400)',
  'var(--color-premium-300)',
  'var(--color-danger-400)',
  'var(--color-brand-200)',
];
// Pseudo-aléatoire déterministe (pas de Math.random au render).
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// Ellipse calée sur le logo (large et bas) : rayons en % de SA largeur / hauteur.
const CONFETTI_RX = 58;
const CONFETTI_RY_TOP = 95;
const CONFETTI_RY_BOTTOM = 108;
const CONFETTI_TOP_COUNT = 11;
const CONFETTI_BOTTOM_COUNT = 4;
// Éparpillement VERTICAL (sinon ça fait deux ovales bien rangés) : chaque pièce
// s'éloigne ou se rapproche du logo en hauteur seulement (facteur [min, max] sur le
// rayon vertical), sa position horizontale ne bouge pas. Plage plus courte en bas :
// le texte est juste en dessous.
const CONFETTI_SCATTER_Y_TOP: [number, number] = [0.85, 1.4];
const CONFETTI_SCATTER_Y_BOTTOM: [number, number] = [0.95, 1.2];
// Retouche à la main : facteur vertical imposé à certaines pièces du bas (clé = index
// dans la gerbe du bas, 0 = la plus à droite) pour garder un confetti tout près du logo.
const CONFETTI_BOTTOM_SCATTER_FIXED: Record<number, number> = { 1: 0.87, 2: 1.05 };
const confettiPiece = (
  i: number,
  baseDeg: number,
  rx: number,
  ry: number,
  [scatterMin, scatterMax]: [number, number],
) => {
  const deg = baseDeg + (rand(i, 1) - 0.5) * 10;
  const angle = (deg * Math.PI) / 180;
  const scatter = scatterMin + rand(i, 3) * (scatterMax - scatterMin);
  const shape = i % 3; // 0 = bandelette, 1 = rectangle, 2 = rond
  return {
    left: 50 + Math.cos(angle) * rx,
    top: 50 + Math.sin(angle) * ry * scatter,
    // Orientée le long du rayon (bandelettes « tirées » hors du logo).
    rot: deg + 90 + (rand(i, 2) - 0.5) * 30,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    w: shape === 0 ? 4 : 8,
    h: shape === 0 ? 16 : shape === 1 ? 11 : 8,
    round: shape === 2,
  };
};
const CONFETTI_PIECES = [
  // Haut : éventail de 160° à 380°, flanc gauche -> haut -> flanc droit
  // (0° = droite, y écran vers le bas).
  ...Array.from({ length: CONFETTI_TOP_COUNT }, (_, i) => {
    const deg = 160 + (i / (CONFETTI_TOP_COUNT - 1)) * 220;
    const far = i % 2 ? 1.08 : 1; // deux « couronnes » pour casser la régularité
    return confettiPiece(i, deg, CONFETTI_RX * far, CONFETTI_RY_TOP * far, CONFETTI_SCATTER_Y_TOP);
  }),
  // Bas : de 50° à 130°, entre les deux flancs, sans les toucher.
  ...Array.from({ length: CONFETTI_BOTTOM_COUNT }, (_, j) => {
    const i = CONFETTI_TOP_COUNT + j;
    const deg = 50 + (j / (CONFETTI_BOTTOM_COUNT - 1)) * 80;
    const far = j % 2 ? 0.9 : 1; // ici la 2e couronne est à l'intérieur
    const fixed = CONFETTI_BOTTOM_SCATTER_FIXED[j];
    return confettiPiece(
      i,
      deg,
      CONFETTI_RX * far,
      CONFETTI_RY_BOTTOM * far,
      fixed !== undefined ? [fixed, fixed] : CONFETTI_SCATTER_Y_BOTTOM,
    );
  }),
];
const ConfettiBurst = ({ active }: { active: boolean }) => (
  <div aria-hidden className="absolute inset-0 pointer-events-none">
    {CONFETTI_PIECES.map((c, i) => (
      <span
        key={i}
        className="illu-anim absolute block"
        style={{
          left: `${c.left}%`,
          top: `${c.top}%`,
          width: c.w,
          height: c.h,
          backgroundColor: c.color,
          borderRadius: c.round ? 999 : 1.5,
          transform: `translate(-50%, -50%) rotate(${c.rot}deg)`,
          boxShadow: '1px 1.5px 0 rgba(0,0,0,0.18)',
          animation: active
            ? `illu-confetti-burst 550ms cubic-bezier(0.2, 0.9, 0.3, 1.15) ${illuDelay(i * 12)} both`
            : 'none',
        }}
      />
    ))}
  </div>
);

// Bulle de fin : anneau de score façon EndGame. Un seul arc qui progresse d'un trait
// (couleur du palier en cours, comme VerdictRing) pendant que le % monte ; valeur
// d'exemple fixe. Rejoue à chaque passage sur la bulle.
// L'anneau part d'un score déjà entamé et monte jusqu'au score d'exemple.
const RING_FROM_PCT = 49;
const RING_PCT = 67;
const RING_R = 90;
const RING_C = 2 * Math.PI * RING_R;
const RING_ANIM_MS = 1400;
const RING_START_DELAY_MS = ILLU_ANIM_DELAY_MS;
const tierColorFor = (pct: number) =>
  (PUBLIC_TIERS.find((t) => pct <= t.max) ?? PUBLIC_TIERS[PUBLIC_TIERS.length - 1]).color;

const ScoreRingIllustration = ({ active }: { active: boolean }) => {
  const [pct, setPct] = useState(RING_FROM_PCT);
  useEffect(() => {
    if (!active) {
      setPct(RING_FROM_PCT);
      return;
    }
    let raf = 0;
    let startedAt = 0;
    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const p = Math.min(1, Math.max(0, (now - startedAt) / RING_ANIM_MS));
      // ease-in-out sinus : démarrage et arrivée doux, montée régulière au milieu
      setPct(RING_FROM_PCT + (RING_PCT - RING_FROM_PCT) * (0.5 - Math.cos(Math.PI * p) / 2));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const to = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, RING_START_DELAY_MS);
    return () => {
      window.clearTimeout(to);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  const { t } = useLocale();
  const shown = Math.round(pct);
  return (
    <div className="flex flex-col items-center gap-1">
    <div className="relative" style={{ filter: 'drop-shadow(3px 4px 0 rgba(0,0,0,0.18))' }}>
      <svg viewBox="0 0 240 240" aria-hidden className={`-rotate-90 ${RING_SIZE}`}>
        <circle cx={120} cy={120} r={RING_R} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={20} />
        <circle
          cx={120}
          cy={120}
          r={RING_R}
          fill="none"
          stroke={tierColorFor(pct)}
          strokeWidth={20}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * RING_C} ${RING_C}`}
          // Passage de palier en fondu, comme VerdictRing (fin de partie), pas en saut de couleur.
          style={{ transition: 'stroke 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display font-bold text-gray-900 text-5xl md:text-6xl tabular-nums">{shown}%</span>
      </div>
    </div>
    <p className="m-0 font-display font-semibold text-sm md:text-base text-gray-800">{t.howToPlay.ringLabel}</p>
    </div>
  );
};

// Pop de la bulle quand elle devient active (transition CSS one-shot, rejouée à
// chaque passage) + léger float : seule animation idle de l'écran.
const Pop = ({ active, children }: { active: boolean; children: ReactNode }) => (
  <div
    className="relative"
    style={{
      transform: active ? 'scale(1) rotate(0deg)' : 'scale(0.82) rotate(-6deg)',
      opacity: active ? 1 : 0.4,
      transition: 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out',
    }}
  >
    <div className={active ? 'animate-float' : undefined}>{children}</div>
  </div>
);

// Bulle d'étape : halo jaune + boîte carrée (équivalent object-contain), l'illustration
// animée épouse l'image à l'intérieur.
const Illustration = ({ illustration, active }: { illustration: StepIllustration; active: boolean }) => (
  <div className="relative">
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
    <div className={`relative z-10 ${ILLU_SIZE} flex items-center`}>
      <AnimatedIllustration illustration={illustration} active={active} />
    </div>
  </div>
);

const HowToPlayCarousel = () => {
  const { t } = useLocale();
  const STEPS = useMemo<Step[]>(
    () => [
      { kind: 'intro', n: 1, text: t.howToPlay.intro(MARKERS) },
      ...t.howToPlay.steps.map((render, i): Step => ({
        kind: 'step',
        n: i + 2,
        illustration: STEP_ILLUSTRATIONS[i],
        text: render(MARKERS),
      })),
      { kind: 'outro', n: t.howToPlay.steps.length + 2, text: t.howToPlay.outro(MARKERS) },
    ],
    [t.howToPlay],
  );
  const TRACK_SLIDES = useMemo<Step[]>(
    () => [STEPS[STEPS.length - 1], ...STEPS, STEPS[0]],
    [STEPS],
  );
  // displayIndex peut sortir de [0, STEPS.length) pour viser les ghosts (-1 ou STEPS.length).
  // index reste toujours l'index logique courant.
  const [displayIndex, setDisplayIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [autoTick, setAutoTick] = useState(0); // bump to restart fill animation
  const [isPaused, setIsPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
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
    // Conserver la convention "dernière→0 = forward" et "0→dernière = backward"
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
  const snapIfNeeded = useCallback(() => {
    setDisplayIndex((d) => {
      if (d >= 0 && d < STEPS.length) return d;
      setAnimate(false);
      // Réactiver l'animation pour les transitions suivantes après que le snap soit peint
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
      return ((d % STEPS.length) + STEPS.length) % STEPS.length;
    });
  }, []);

  const onTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== 'transform') return;
    snapIfNeeded();
  };

  // Filet de sécurité : `transitionend` n'est PAS émis si la transition est
  // annulée en cours — ce que fait tout nouveau `touchstart` (setAnimate(false)).
  // Sans ce recadrage différé, des swipes rapides successifs faisaient dériver
  // displayIndex hors du track : le viewport pointait au-delà du dernier slot et
  // le carrousel s'affichait vide (les dots, eux, restaient corrects).
  useEffect(() => {
    if (displayIndex >= 0 && displayIndex < STEPS.length) return;
    const t = setTimeout(snapIfNeeded, SLIDE_ANIM_MS + 120);
    return () => clearTimeout(t);
  }, [displayIndex, snapIfNeeded]);

  // Décision de swipe (gauche/droite) + suivi 1:1 du doigt (dragX) factorisés via
  // useSwipe — mêmes seuils (abs(dx) >= 40 ; abs(dx) < abs(dy) = intention
  // verticale ignorée). `onMove` pilote le drag live, remis à 0 par useSwipe à la
  // fin / l'annulation du geste.
  // Étape précédente / suivante (swipe et flèches desktop). Le track continue dans la
  // direction demandée ; pas de double animation. Bornage : on ne s'autorise qu'UN ghost
  // de part et d'autre (positions -1 et STEPS.length), ce que le track sait afficher.
  // Au-delà, le snap n'a pas encore eu lieu et on resterait bloqué hors des slots -> écran vide.
  const goPrev = () => {
    setDisplayIndex((d) => (d <= -1 ? d : d - 1));
    setAutoTick((t) => t + 1);
  };
  const goNext = () => {
    setDisplayIndex((d) => (d >= STEPS.length ? d : d + 1));
    setAutoTick((t) => t + 1);
  };

  const swipe = useSwipe({
    threshold: 40,
    onMove: setDragX,
    onPrev: goPrev,
    onNext: goNext,
  });

  const onTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    setAnimate(false); // suivi 1:1 du doigt sans transition
    swipe.touchHandlers.onTouchStart(e);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    setAnimate(true);
    swipe.touchHandlers.onTouchEnd(e);
    setIsPaused(false);
  };
  const onTouchCancel = () => {
    setAnimate(true);
    setIsPaused(false);
    swipe.touchHandlers.onTouchCancel(); // reset des refs internes + dragX
  };

  // TRACK_SLIDES = [ghost-last, s0, s1, s2, s3, ghost-first]
  // displayIndex = -1 → position 0 (ghost-last), 0 → position 1 (s0), etc.
  // Une slide du track (ghosts inclus) est active si elle correspond à l'index logique courant.
  const isSlideActive = (trackI: number) =>
    (((trackI - 1) % STEPS.length) + STEPS.length) % STEPS.length === index;
  const trackPosition = displayIndex + 1;
  const trackTransform = `translateX(calc(${-trackPosition * 100}% + ${dragX}px))`;
  const trackTransition = animate ? `transform ${SLIDE_ANIM_MS}ms ${SLIDE_EASE}` : 'none';

  return (
    <div
      className="w-full flex flex-col items-center gap-4 desktop-short:gap-2 select-none pt-4 desktop-short:pt-1 touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={swipe.touchHandlers.onTouchMove}
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
            className="relative w-full"
            style={{ overflowX: 'clip', overflowY: 'visible', height: 'max(187px, min(264px, 33dvh))' }}
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
                  <Pop active={isSlideActive(i)}>
                    {s.kind === 'intro' && (
                      <div className="relative">
                        <ConfettiBurst active={isSlideActive(i)} />
                        <LogoIllustration />
                      </div>
                    )}
                    {s.kind === 'step' && <Illustration illustration={s.illustration} active={isSlideActive(i)} />}
                    {s.kind === 'outro' && <ScoreRingIllustration active={isSlideActive(i)} />}
                  </Pop>
                </div>
              ))}
            </div>
          </div>

          {/* Flèches précédent / suivant : desktop (pas de swipe à la souris). */}
          {[
            { side: 'left-0', label: t.howToPlay.previousStep, onClick: goPrev, Icon: LuChevronLeft },
            { side: 'right-0', label: t.howToPlay.nextStep, onClick: goNext, Icon: LuChevronRight },
          ].map(({ side, label, onClick, Icon }) => (
            <button
              key={side}
              type="button"
              onClick={onClick}
              aria-label={label}
              className={`hidden md:flex absolute ${side} top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white border-2 border-black text-gray-900 cursor-pointer hover:bg-gray-100 active:scale-90 transition-all`}
              style={{ boxShadow: '1px 2px 0 0 #000' }}
            >
              <Icon size={20} strokeWidth={2.75} />
            </button>
          ))}

          {/* Numéro sticker - reste fixe, reflète l'index logique (1 = accueil). */}
          <div
            className="absolute -top-2 left-1 z-20 w-11 h-11 desktop-short:w-8 desktop-short:h-8 rounded-full flex items-center justify-center font-display font-bold text-xl desktop-short:text-base text-gray-900 border-[2.5px] border-black overflow-hidden"
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
              <p className="text-sm md:text-base desktop-short:text-xs text-gray-800 m-0 leading-snug">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stepper dots : pastille de 10 px, zone de clic de 44 px de haut pour le doigt
          (marge négative : la hauteur de la mise en page ne bouge pas). */}
      <div className="flex items-center pt-1 -my-[17px]">
        {STEPS.map((step_i, i) => {
          const active = i === index;
          return (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={t.howToPlay.goToStep(step_i.n)}
              className="cursor-pointer h-11 min-w-7 px-1 flex items-center justify-center"
            >
              <span
                aria-hidden
                className="block transition-all duration-200"
                style={{
                  width: active ? 28 : 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: active ? ACCENT : '#d4d4d4',
                  border: '2px solid #000',
                  boxShadow: active ? '1px 2px 0 0 #000' : 'none',
                }}
              />
            </button>
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
