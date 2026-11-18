import { useRef, useEffect, ReactNode, createContext, useContext, CSSProperties, ComponentType } from 'react';
import step1Img from '../assets/images/home/1-question_selection.png';
import step2Img from '../assets/images/home/2-answering.png';
import step3Img from '../assets/images/home/3-guessing.png';
import step4Img from '../assets/images/home/4-reveal.png';
import step1CardLeft from '../assets/images/home/how-to-play/1-card-left.png';
import step1CardCenter from '../assets/images/home/how-to-play/1-card-center.png';
import step1CardRight from '../assets/images/home/how-to-play/1-card-right.png';
import step2Cloud from '../assets/images/home/how-to-play/2-thought-cloud.png';
import step2BubbleM from '../assets/images/home/how-to-play/2-thought-bubble-m.png';
import step2BubbleS from '../assets/images/home/how-to-play/2-thought-bubble-s.png';
import step2PilierHands from '../assets/images/home/how-to-play/2-pilier-hands.png';
import step3Qmark from '../assets/images/home/how-to-play/3-qmark.png';
import step3PhoneLeft from '../assets/images/home/how-to-play/3-phone-left.png';
import step3PhoneRight from '../assets/images/home/how-to-play/3-phone-right.png';
import step3ScreenLeft from '../assets/images/home/how-to-play/3-screen-left.png';
import step3ScreenRight from '../assets/images/home/how-to-play/3-screen-right.png';
import step4PhoneLeft from '../assets/images/home/how-to-play/4-phone-left.png';
import step4PhoneRight from '../assets/images/home/how-to-play/4-phone-right.png';
import step4ScreenAnswer from '../assets/images/home/how-to-play/4-screen-answer.png';
import step4ScreenAuthor from '../assets/images/home/how-to-play/4-screen-author.png';

// =====================================================================
// Illustrations animées des 4 étapes du jeu : bulles « Comment jouer ? » et écrans
// d'intro de phase (RoleIntroOverlay). Animations CSS illu-* dans index.css.
// =====================================================================

// Les animations démarrent une fois l'illustration posée (pop de la bulle / entrée de l'écran).
export const ILLU_ANIM_DELAY_MS = 800;
export const illuDelay = (ms: number) => `${ILLU_ANIM_DELAY_MS + ms}ms`;

// Illustrations d'étapes animées : le PNG d'origine + des calques par-dessus, découpés
// dans ce même PNG (assets/images/home/how-to-play). Boîtes en px de l'image source.
// Chaque animation se joue une fois à chaque activation de la bulle ; bulle inactive =
// calques au repos (l'image paraît intacte).
type Box = [x: number, y: number, w: number, h: number];
// Caméra : zoom doux sur la zone clé + voile blanc sur le reste, le temps du moment clé.
// `focus` = point fixe du zoom (px source), `inMs` / `outMs` = début du zoom avant / arrière,
// après ILLU_ANIM_DELAY_MS.
type Camera = { focus: [number, number]; zoom: number; inMs: number; outMs: number };
export type StepIllustration = {
  image: string;
  size: [number, number];
  // Zones masquées de l'image car rejouées par un calque (fond transparent uniquement).
  holes?: Box[];
  camera?: Camera;
  Overlay: ComponentType;
};

// `offset` : origine du repère courant (calques imbriqués dans un ZoomedPhone), en px source.
const IllustrationContext = createContext<{ size: [number, number]; active: boolean; offset?: [number, number] }>({
  size: [1, 1],
  active: false,
});

const boxStyle = ([x, y, w, h]: Box, [W, H]: [number, number], [ox, oy]: [number, number] = [0, 0]): CSSProperties => ({
  left: `${((x - ox) / W) * 100}%`,
  top: `${((y - oy) / H) * 100}%`,
  width: `${(w / W) * 100}%`,
  height: `${(h / H) * 100}%`,
});

// Masque = calque plein moins un rectangle par trou (exclude / xor).
const holesMask = (holes: Box[], [W, H]: [number, number]): CSSProperties => {
  const image = Array(holes.length + 1).fill('linear-gradient(#000 0 0)').join(', ');
  const size = [...holes.map(([, , w, h]) => `${(w / W) * 100}% ${(h / H) * 100}%`), '100% 100%'].join(', ');
  // mask-position en % : p% aligne p% du masque sur p% de l'image, d'où p = x / (W - w).
  const position = [
    ...holes.map(([x, y, w, h]) => `${(x / (W - w)) * 100}% ${(y / (H - h)) * 100}%`),
    '0 0',
  ].join(', ');
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: size,
    WebkitMaskSize: size,
    maskPosition: position,
    WebkitMaskPosition: position,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskComposite: 'exclude',
    WebkitMaskComposite: 'xor',
  };
};

// `anim` absent = calque fixe. `hiddenAtRest` = visible seulement pendant son animation.
const Layer = ({
  box,
  anim,
  origin,
  rotate,
  hiddenAtRest,
  children,
}: {
  box: Box;
  anim?: string;
  origin?: string;
  rotate?: number;
  hiddenAtRest?: boolean;
  children?: ReactNode;
}) => {
  const { size, active, offset } = useContext(IllustrationContext);
  return (
    <div className="absolute" style={{ ...boxStyle(box, size, offset), transform: rotate ? `rotate(${rotate}deg)` : undefined }}>
      <div
        className="illu-anim w-full h-full"
        style={{
          transformOrigin: origin,
          opacity: hiddenAtRest ? 0 : undefined,
          animation: active && anim ? anim : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
};

const LayerImg = ({ src }: { src: string }) => (
  <img src={src} alt="" aria-hidden draggable={false} className="block w-full h-full" />
);

// Écran de téléphone : capture du vrai jeu (Studio, /studio/screen) posée sur l'écran dessiné.
const ScreenCapture = ({ src }: { src: string }) => (
  <img src={src} alt="" aria-hidden draggable={false} className="block w-full h-full rounded-[6%] object-cover" />
);

// Carte réponse qui vole en cloche d'un point à un autre (px source) et se fond dans l'arrivée :
// crème comme dans le jeu, ou « ? » (réponse anonyme).
const FLIGHT_MS = 650;
const FLIGHT_ARC = 90;
const CARD_SIZE: [number, number] = [80, 56];
const FlyingCard = ({
  from,
  to,
  startMs,
  mystery,
  rotate = 0,
}: {
  from: [number, number];
  to: [number, number];
  startMs: number;
  mystery?: boolean;
  rotate?: number;
}) => {
  const { active } = useContext(IllustrationContext);
  const [w, h] = CARD_SIZE;
  const timing = `${FLIGHT_MS}ms ${illuDelay(startMs)}`;
  return (
    <Layer box={[from[0] - w / 2, from[1] - h / 2, w, h]}>
      {/* X linéaire + Y en cloche, sur deux calques imbriqués = trajectoire en arc. */}
      <div
        className="illu-anim w-full h-full"
        style={{
          '--tx': `${((to[0] - from[0]) / w) * 100}%`,
          animation: active ? `illu-fly-x ${timing} linear both` : 'none',
        } as CSSProperties}
      >
        <div
          className="illu-anim w-full h-full"
          style={{
            '--ty': `${((to[1] - from[1]) / h) * 100}%`,
            '--arc': `${(-FLIGHT_ARC / h) * 100}%`,
            '--rot': `${rotate}deg`,
            opacity: 0,
            animation: active ? `illu-fly-y ${timing} both` : 'none',
          } as CSSProperties}
        >
          <svg viewBox="0 0 80 56" aria-hidden className="block w-full h-full overflow-visible">
            <rect x={2} y={2} width={76} height={52} rx={9} fill="var(--color-cream-answer)" stroke="#000" strokeWidth={4} />
            {mystery ? (
              <text x={40} y={41} textAnchor="middle" fontSize={34} fontWeight={800} className="font-display">
                ?
              </text>
            ) : (
              <g stroke="#000" strokeWidth={5} strokeLinecap="round">
                <line x1={20} y1={22} x2={60} y2={22} />
                <line x1={20} y1={35} x2={48} y2={35} />
              </g>
            )}
          </svg>
        </div>
      </div>
    </Layer>
  );
};

const Sparkle = () => (
  <svg viewBox="-3 -3 30 30" aria-hidden className="block w-full h-full">
    <path
      d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z"
      fill="var(--color-warning-300)"
      stroke="#000"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  </svg>
);

const CheckBadge = () => (
  <div
    className="w-full h-full rounded-full flex items-center justify-center"
    style={{ backgroundColor: 'var(--color-success-500)', border: '2px solid #000', boxShadow: '1.5px 1.5px 0 #000' }}
  >
    <svg viewBox="0 0 24 24" aria-hidden className="w-[62%] h-[62%]">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

// Étape 1 : les 3 cartes grossissent tour à tour (le pilier passe les questions en revue).
// Grossir sans jamais rétrécir : la carte agrandie recouvre toujours l'originale dessous.
const ChoosingOverlay = () => (
  <>
    <Layer box={[455, 487, 194, 262]} anim={`illu-card 450ms ease-in-out ${illuDelay(0)} both`}>
      <LayerImg src={step1CardLeft} />
    </Layer>
    <Layer box={[749, 486, 194, 262]} anim={`illu-card 450ms ease-in-out ${illuDelay(500)} both`}>
      <LayerImg src={step1CardRight} />
    </Layer>
    {/* Carte du milieu rendue en dernier : elle reste devant les deux autres. */}
    <Layer box={[614, 473, 171, 239]} anim={`illu-card 450ms ease-in-out ${illuDelay(250)} both`}>
      <LayerImg src={step1CardCenter} />
    </Layer>
  </>
);

// Dos de téléphone dans le style des dessins : gris foncé, contour noir épais, objectif en haut.
const PhoneBack = () => (
  <svg viewBox="0 0 70 95" aria-hidden className="block w-full h-full overflow-visible">
    <rect x={3} y={3} width={64} height={89} rx={11} fill="#3d3d3d" stroke="#000" strokeWidth={6} />
    <rect x={10} y={10} width={50} height={75} rx={7} fill="#474747" />
    <circle cx={18} cy={18} r={5.5} fill="#111" />
  </svg>
);

// Étape 2 : la bulle de pensée apparaît (petites bulles puis nuage), les points « écrivent »,
// puis la réponse du joueur de gauche part, anonyme, vers le téléphone du pilier.
const CLOUD_BOX: Box = [244, 189, 143, 124];
const PILIER_PHONE_BOX: Box = [668, 518, 70, 95];
const PILIER_PHONE_CENTER: [number, number] = [703, 565];
const CLOUD_DOTS_X = [292, 317, 342];
const CLOUD_DOT_Y = 256;
const CLOUD_DOT_D = 14;
const AnsweringOverlay = () => {
  const { active } = useContext(IllustrationContext);
  const [cx, cy, cw, ch] = CLOUD_BOX;
  return (
    <>
      <Layer box={[315, 338, 23, 23]} anim={`illu-pop 300ms ease-out ${illuDelay(0)} both`}>
        <LayerImg src={step2BubbleS} />
      </Layer>
      <Layer box={[325, 312, 31, 30]} anim={`illu-pop 300ms ease-out ${illuDelay(120)} both`}>
        <LayerImg src={step2BubbleM} />
      </Layer>
      <Layer box={CLOUD_BOX} anim={`illu-pop 400ms ease-out ${illuDelay(240)} both`} origin="64% 100%">
        <LayerImg src={step2Cloud} />
        {CLOUD_DOTS_X.map((x, i) => (
          <span
            key={x}
            className="illu-anim absolute block rounded-full bg-black"
            style={{
              left: `${((x - CLOUD_DOT_D / 2 - cx) / cw) * 100}%`,
              top: `${((CLOUD_DOT_Y - CLOUD_DOT_D / 2 - cy) / ch) * 100}%`,
              width: `${(CLOUD_DOT_D / cw) * 100}%`,
              height: `${(CLOUD_DOT_D / ch) * 100}%`,
              animation: active ? `illu-typing 900ms ease-in-out ${illuDelay(700 + i * 150)} 3 backwards` : 'none',
            }}
          />
        ))}
      </Layer>
      {/* Téléphone du pilier (absent du dessin), tenu entre ses mains et vu de dos comme aux
          étapes 3 et 4 : ses mains, découpées dans l'image, repassent devant. Il sursaute quand
          la réponse arrive. */}
      <Layer
        box={PILIER_PHONE_BOX}
        rotate={-3}
        anim={`illu-receive 260ms ease-out ${illuDelay(1950)}`}
      >
        <PhoneBack />
      </Layer>
      <Layer box={[612, 584, 165, 65]}>
        <LayerImg src={step2PilierHands} />
      </Layer>
      {/* La réponse part sans nom vers le téléphone du pilier : carte « ? ». */}
      <FlyingCard from={[400, 590]} to={PILIER_PHONE_CENTER} startMs={1300} mystery />
    </>
  );
};

// Écran de joueur : éteint dès l'activation, se rallume (flash) sur la réponse que le pilier lui a attribuée.
const ScreenShade = ({ onMs }: { onMs: number }) => {
  const { active } = useContext(IllustrationContext);
  return (
    <div
      className="illu-anim w-full h-full rounded-[6%]"
      style={{
        animation: active
          ? `illu-screen-on 500ms ease-out ${illuDelay(onMs)} both`
          : 'none',
      }}
    />
  );
};

// Traits de mouvement façon BD (comme ceux autour des têtes), en éventail vers le haut.
const MotionLines = () => (
  <svg viewBox="0 0 100 100" aria-hidden className="block w-full h-full">
    <g stroke="#000" strokeWidth={11} strokeLinecap="round">
      <line x1={27} y1={67} x2={4} y2={35} />
      <line x1={50} y1={60} x2={50} y2={20} />
      <line x1={73} y1={67} x2={96} y2={35} />
    </g>
  </svg>
);

// Téléphone de joueur agrandi pour qu'on voie l'écran : calque téléphone + main (fondu sur la
// coupe du bras), grossi en restant ancré au poignet pour que la main reste sur le bras.
// Les enfants (écrans) se placent en px de l'image source et suivent l'agrandissement.
const PHONE_ZOOM = 1.3;
const ZoomedPhone = ({
  box,
  wrist,
  src,
  children,
}: {
  box: Box;
  wrist: [number, number];
  src: string;
  children?: ReactNode;
}) => {
  const { size, active } = useContext(IllustrationContext);
  const [x, y, w, h] = box;
  return (
    <div
      className="absolute"
      style={{
        ...boxStyle(box, size),
        transform: `scale(${PHONE_ZOOM})`,
        transformOrigin: `${((wrist[0] - x) / w) * 100}% ${((wrist[1] - y) / h) * 100}%`,
      }}
    >
      <LayerImg src={src} />
      <IllustrationContext.Provider value={{ size: [w, h], active, offset: [x, y] }}>{children}</IllustrationContext.Provider>
    </div>
  );
};

// Étape 3 : écrans des joueurs éteints, le « ? » du pilier hésite, puis il envoie une carte à
// chacun : l'écran se rallume sur la réponse attribuée, avec des traits de mouvement.
const GuessingOverlay = () => (
  <>
    <Layer box={[803, 147, 45, 72]} anim={`illu-wonder 700ms ease-in-out ${illuDelay(0)} both`} origin="50% 100%">
      <LayerImg src={step3Qmark} />
    </Layer>
    <ZoomedPhone box={[313, 473, 201, 134]} wrist={[330, 588]} src={step3PhoneLeft}>
      <Layer box={[356, 496, 127, 80]} rotate={-6.3}>
        <ScreenCapture src={step3ScreenLeft} />
      </Layer>
      <Layer box={[356, 496, 127, 80]} rotate={-6.3}>
        <ScreenShade onMs={1150} />
      </Layer>
    </ZoomedPhone>
    <ZoomedPhone box={[888, 474, 201, 129]} wrist={[1072, 588]} src={step3PhoneRight}>
      <Layer box={[919, 496, 127, 74]} rotate={6.8}>
        <ScreenCapture src={step3ScreenRight} />
      </Layer>
      <Layer box={[919, 496, 127, 74]} rotate={6.8}>
        <ScreenShade onMs={2050} />
      </Layer>
    </ZoomedPhone>
    {/* Le pilier envoie à chacun la réponse qu'il lui attribue : la carte part de son téléphone,
        l'écran s'allume quand elle arrive (cartes vers les écrans agrandis, en px source). */}
    <FlyingCard from={[695, 545]} to={[446, 520]} startMs={600} rotate={-6.3} />
    <FlyingCard from={[695, 545]} to={[956, 517]} startMs={1500} rotate={6.8} />
    {/* Traits au-dessus des téléphones agrandis (placés après zoom, en px source). */}
    <Layer box={[420, 385, 60, 60]} anim={`illu-lines 650ms ease-out ${illuDelay(1250)} both`} origin="50% 100%" hiddenAtRest>
      <MotionLines />
    </Layer>
    <Layer box={[925, 375, 60, 60]} anim={`illu-lines 650ms ease-out ${illuDelay(2150)} both`} origin="50% 100%" hiddenAtRest>
      <MotionLines />
    </Layer>
  </>
);

// Étape 4 : l'écran de droite montre d'abord la réponse (« À toi ! Montre ton écran »), puis
// bascule sur l'auteur révélé (grosse tête + pseudo) ; la ✓ « bien deviné » s'allume avec lui.
// Écrans = captures du vrai jeu (Studio, /studio/screen) ; l'auteur reste affiché au repos.
const REVEAL_SWITCH_MS = 800;
const REVEAL_SCREEN: Box = [943, 492, 129, 74];
const RevealOverlay = () => (
  <>
    {/* Même joueur qu'à l'étape 3 : sa carte n'est pas encore révélée. */}
    <ZoomedPhone box={[296, 459, 199, 137]} wrist={[318, 584]} src={step4PhoneLeft}>
      <Layer box={[338, 485, 126, 71]} rotate={-9.7}>
        <ScreenCapture src={step3ScreenLeft} />
      </Layer>
    </ZoomedPhone>
    <ZoomedPhone box={[910, 475, 200, 133]} wrist={[1092, 592]} src={step4PhoneRight}>
      <Layer box={REVEAL_SCREEN} rotate={3.4}>
        <ScreenCapture src={step4ScreenAuthor} />
      </Layer>
      <Layer box={REVEAL_SCREEN} rotate={3.4} anim={`illu-screen-hide 150ms ease-out ${illuDelay(REVEAL_SWITCH_MS)} both`} hiddenAtRest>
        <ScreenCapture src={step4ScreenAnswer} />
      </Layer>
      {/* Flash blanc à la bascule (calque vide, seul son fond s'anime). */}
      <Layer box={REVEAL_SCREEN} rotate={3.4} anim={`illu-screen-flash 450ms ease-out ${illuDelay(REVEAL_SWITCH_MS)}`} />
    </ZoomedPhone>
    {/* ✓ au-dessus du téléphone agrandi. */}
    <Layer
      box={[943, 353, 84, 84]}
      anim={`illu-badge 450ms cubic-bezier(0.34, 1.56, 0.64, 1) ${illuDelay(REVEAL_SWITCH_MS)} both`}
      hiddenAtRest
    >
      <CheckBadge />
    </Layer>
    <Layer box={[1005, 328, 56, 56]} anim={`illu-sparkle 700ms ease-out ${illuDelay(REVEAL_SWITCH_MS + 200)} both`} hiddenAtRest>
      <Sparkle />
    </Layer>
  </>
);

export const STEP_ILLUSTRATIONS: StepIllustration[] = [
  { image: step1Img, size: [1400, 1100], Overlay: ChoosingOverlay },
  {
    image: step2Img,
    size: [1402, 1122],
    // nuage + ses 2 petites bulles
    holes: [CLOUD_BOX, [315, 312, 41, 49]],
    // côté gauche seulement : le joueur qui réfléchit, écrit, puis envoie sa réponse au pilier
    camera: { focus: [430, 450], zoom: 1.3, inMs: 100, outMs: 2300 },
    Overlay: AnsweringOverlay,
  },
  {
    image: step3Img,
    size: [1402, 1122],
    holes: [[800, 144, 51, 78]],
    Overlay: GuessingOverlay,
  },
  {
    image: step4Img,
    size: [1402, 1122],
    // écran de droite (téléphone agrandi + ✓) : point de zoom décalé vers le bord pour que le
    // joueur de droite reste net et entier, seuls le pilier et le joueur de gauche s'effacent
    camera: { focus: [1100, 470], zoom: 1.3, inMs: 200, outMs: 2700 },
    Overlay: RevealOverlay,
  },
];

const CAMERA_MOVE_MS = 600;

// Mouvement réduit : pas de caméra (en CSS, les calques sautent déjà à leur état final).
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Voile : bords blancs (le recadrage du zoom ne se voit pas) + blanc hors de la zone clé.
// Même zone épargnée (rayons en % de l'image) et même dégradé pour toutes les bulles.
const WASH_HOLE: [number, number] = [44, 40];
const washBackground = ({ focus: [fx, fy] }: Camera, [W, H]: [number, number]) =>
  [
    'linear-gradient(to right, #fff, transparent 6%, transparent 94%, #fff)',
    'linear-gradient(to bottom, #fff, transparent 6%, transparent 94%, #fff)',
    `radial-gradient(ellipse ${WASH_HOLE[0]}% ${WASH_HOLE[1]}% at ${(fx / W) * 100}% ${(fy / H) * 100}%, transparent 60%, rgba(255, 255, 255, 0.82) 100%)`,
  ].join(', ');

const DEFAULT_SHADOW = 'drop-shadow(3px 4px 0 rgba(0,0,0,0.18))';

/**
 * Illustration animée d'une étape, à largeur pleine dans son conteneur. `withCamera` :
 * zoom + voile blanc (fonds clairs uniquement), `shadow` : ombre portée du dessin.
 */
export const AnimatedIllustration = ({
  illustration,
  active,
  withCamera = true,
  shadow = DEFAULT_SHADOW,
}: {
  illustration: StepIllustration;
  active: boolean;
  withCamera?: boolean;
  shadow?: string;
}) => {
  const { image, size, holes, Overlay } = illustration;
  const camera = withCamera ? illustration.camera : undefined;
  const cameraRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);

  // Caméra + voile, joués une fois à chaque activation de la bulle, avec les calques.
  useEffect(() => {
    if (!active || !camera || prefersReducedMotion()) return;
    const zoomIn = ILLU_ANIM_DELAY_MS + camera.inMs;
    const total = ILLU_ANIM_DELAY_MS + camera.outMs + CAMERA_MOVE_MS;
    const frames = (rest: Keyframe, focused: Keyframe): Keyframe[] => [
      { ...rest, offset: 0 },
      { ...rest, offset: zoomIn / total, easing: 'ease-in-out' },
      { ...focused, offset: (zoomIn + CAMERA_MOVE_MS) / total },
      { ...focused, offset: (total - CAMERA_MOVE_MS) / total, easing: 'ease-in-out' },
      { ...rest, offset: 1 },
    ];
    const anims = [
      cameraRef.current?.animate?.(frames({ transform: 'none' }, { transform: `scale(${camera.zoom})` }), total),
      washRef.current?.animate?.(frames({ opacity: 0 }, { opacity: 1 }), total),
    ];
    return () => anims.forEach((a) => a?.cancel());
  }, [active, camera]);

  return (
    <div className="relative w-full">
      {/* Cadre de la caméra : le zoom reste dans l'image. */}
      <div className={camera ? 'overflow-hidden' : undefined}>
        <div
          ref={cameraRef}
          className="relative"
          style={{
            filter: shadow,
            transformOrigin: camera
              ? `${(camera.focus[0] / size[0]) * 100}% ${(camera.focus[1] / size[1]) * 100}%`
              : undefined,
          }}
        >
          <img
            src={image}
            alt=""
            aria-hidden
            draggable={false}
            className="block w-full h-auto"
            style={holes ? holesMask(holes, size) : undefined}
          />
          <IllustrationContext.Provider value={{ size, active }}>
            <Overlay />
          </IllustrationContext.Provider>
        </div>
      </div>
      {camera && (
        // Hors du filtre (sinon le voile projetterait une ombre) et hors du cadre, qu'il
        // déborde de 2 px : l'arrondi au pixel du recadrage laissait passer la dernière
        // rangée du dessin zoomé. Le point de zoom ne bouge pas, la zone épargnée non plus.
        <div
          ref={washRef}
          aria-hidden
          className="absolute -inset-[2px] pointer-events-none"
          style={{ opacity: 0, background: washBackground(camera, size) }}
        />
      )}
    </div>
  );
};
