import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DrawingIdeaPick, IPlayer } from '@onskone/shared';
import { Icon } from './Icon';
import Avatar from './Avatar';
import PremiumName from './PremiumName';
import Whiteboard from './Whiteboard';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { useLocale } from '../i18n';
import { STICKER_FILTER } from '../constants/icons';
import {
  WHITEBOARD_FRAME_X, WHITEBOARD_FRAME_Y, WHITEBOARD_INTRO_MOVE_MS, WHITEBOARD_INTRO_READ_MS, WHITEBOARD_SHADOW,
} from '../constants/whiteboard';
import { fitBoard, resolveDrawingIdea } from '../utils/whiteboard';

type Stage = 'center' | 'top' | 'board';
type Size = { width: number; height: number };

/**
 * Attente des non-piliers pendant que le pilier choisit sa question : un tableau blanc
 * partagé. La consigne s'affiche d'abord seule au milieu (le temps de la lire), monte
 * en haut, puis le tableau apparaît dessous, avec l'idée de dessin de la manche en
 * bandeau sur son haut. Le tableau est monté dès le début (état demandé au serveur)
 * mais pas touchable avant la fin de l'intro.
 *
 * La taille du tableau est calculée ICI (place de l'écran moins la consigne et le
 * bandeau de l'idée) : consigne + tableau forment un bloc centré, la place en trop se
 * répartit à égalité en haut et en bas.
 */
const WhiteboardWaiting = ({ lobbyCode, playerId, roundNumber, leader, players, drawingIdea }: {
  lobbyCode: string;
  playerId: string;
  roundNumber: number;
  /** Idée de dessin de la manche, tirée par le serveur (IRound.drawingIdea). Absente : pas de bandeau. */
  drawingIdea?: DrawingIdeaPick | null;
  leader: Pick<IPlayer, 'id' | 'name' | 'avatarId' | 'isPremium'>;
  /** Joueurs de la partie, pour le pseudo du portrait. Absent : le pilier seul. */
  players?: readonly Pick<IPlayer, 'id' | 'name'>[];
}) => {
  const { t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>('center');
  const [boardSize, setBoardSize] = useState<Size | null>(null);
  // Bandeau de l'idée (rendu par le tableau) : sa hauteur est prise sur la place du dessin.
  const [ideaBanner, setIdeaBanner] = useState<HTMLParagraphElement | null>(null);
  // Sa dernière hauteur connue, GARDÉE quand il se démonte (pas de place pour le tableau,
  // qui l'emporte avec lui). Repartir de 0 faisait réapparaître le tableau, donc le
  // bandeau, qui ne tenait plus : boucle de rendu infinie à une hauteur d'écran près.
  const ideaBannerHeightRef = useRef(0);
  // Décalage qui pose la consigne au centre de l'écran pendant l'intro.
  const [centerOffset, setCenterOffset] = useState(0);
  const wb = t.phases.questionSelection.whiteboard;
  const idea = resolveDrawingIdea(wb.ideas, drawingIdea, players?.length ? players : [leader]);
  const drawText = wb.drawMeanwhile;
  const drawLastSpace = drawText.lastIndexOf(' ');

  // Place du tableau = l'écran moins sa marge, la consigne, l'écart, le bandeau de
  // l'idée et l'ombre du cadre (réservée à droite et en bas, cf. le conteneur du tableau).
  // Tailles de mise en page (clientHeight, offsetHeight) : insensibles aux transform de l'intro.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const header = headerRef.current;
    if (!root || !header) return;
    const fit = () => {
      const cs = getComputedStyle(root);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const gap = parseFloat(cs.rowGap) || 0;
      if (ideaBanner) ideaBannerHeightRef.current = ideaBanner.offsetHeight;
      const next = fitBoard(
        root.clientWidth - padX - WHITEBOARD_SHADOW,
        root.clientHeight - padY - header.offsetHeight - gap - WHITEBOARD_SHADOW,
        WHITEBOARD_FRAME_X,
        WHITEBOARD_FRAME_Y + ideaBannerHeightRef.current,
      );
      // ±1 px ignoré : le bandeau suit la largeur du tableau (taille du texte, retours à
      // la ligne), sans cette marge les deux pourraient se renvoyer la balle sans fin.
      setBoardSize((prev) => (prev && next && Math.abs(prev.width - next.width) <= 1 ? prev : next));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    ro.observe(header);
    if (ideaBanner) ro.observe(ideaBanner);
    return () => ro.disconnect();
  }, [ideaBanner]);

  // Centre de l'écran pour la consigne, une fois le tableau (invisible) en place.
  useLayoutEffect(() => {
    if (stage !== 'center') return;
    const root = rootRef.current;
    const header = headerRef.current;
    if (!root || !header) return;
    setCenterOffset(Math.max(0, (root.clientHeight - header.offsetHeight) / 2 - header.offsetTop));
  }, [boardSize, stage]);

  useEffect(() => {
    const toTop = setTimeout(() => setStage('top'), WHITEBOARD_INTRO_READ_MS);
    const toBoard = setTimeout(() => setStage('board'), WHITEBOARD_INTRO_READ_MS + WHITEBOARD_INTRO_MOVE_MS);
    return () => { clearTimeout(toTop); clearTimeout(toBoard); };
  }, []);

  const centered = stage === 'center';

  return (
    <div
      ref={rootRef}
      className="relative flex-1 min-h-[calc(80dvh-7rem)] phone-landscape:min-h-0 w-full flex flex-col items-center justify-center gap-3 tablet:gap-4 phone-landscape:gap-1 px-2 pt-2 pb-0 overflow-hidden"
    >
      <div
        ref={headerRef}
        className="shrink-0 max-w-md text-center transition-transform ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none"
        style={{
          transform: centered ? `translateY(${centerOffset}px) scale(1.06)` : 'none',
          transitionDuration: `${WHITEBOARD_INTRO_MOVE_MS}ms`,
        }}
      >
        {/* Nunito gris, texte droit, pilier en semi-gras.
            Morceaux séparés en flex : l'avatar et le pseudo restent centrés sur la ligne. */}
        <div className="animate-phase-enter flex flex-col items-center gap-1 phone-landscape:flex-row phone-landscape:flex-wrap phone-landscape:justify-center phone-landscape:gap-x-1.5 text-gray-700 text-base tablet:text-lg phone-landscape:text-sm font-medium leading-snug">
          <div className="flex items-center justify-center flex-wrap gap-x-1.5 gap-y-1">
            <span>{wb.whilePrefix}</span>
            <span className="inline-flex items-center gap-1.5">
              <Avatar avatarId={leader.avatarId} name={leader.name} size="sm" className="shrink-0" />
              <PremiumName name={leader.name} premium={!!leader.isPremium} className="font-semibold text-gray-900" />
            </span>
            <span>{wb.whileSuffix}</span>
          </div>
          {/* La palette suit le dernier mot (comme la pastille de QuestionCard) : en flex à
              côté du texte, elle partait seule au bord droit dès que la phrase passait à la
              ligne. */}
          <p className="!m-0 text-pretty">
            {drawText.slice(0, drawLastSpace + 1)}
            <span className="whitespace-nowrap">
              {drawText.slice(drawLastSpace + 1)}
              <span className="inline-flex align-middle -my-1 ml-1.5">
                <Icon icon="fluent-emoji-flat:artist-palette" width="1.25em" height="1.25em" aria-hidden style={{ filter: STICKER_FILTER }} />
              </span>
            </span>
          </p>
        </div>
      </div>

      {/* Le tableau est en place dès le début (invisible) : la consigne se centre sur
          l'écran entier, et rien ne bouge quand il apparaît. Le padding droite/bas loge
          l'ombre du cadre : centré avec elle, le bloc paraît équilibré. */}
      <div
        className={`shrink-0 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${stage === 'board' ? 'opacity-100' : 'opacity-0 translate-y-3 scale-95'}`}
        style={{ padding: `0 ${WHITEBOARD_SHADOW}px ${WHITEBOARD_SHADOW}px 0` }}
        aria-hidden={stage !== 'board'}
      >
        {/* Un plantage du tableau (canvas…) ne doit pas emporter la consigne avec lui. */}
        <SectionErrorBoundary name="game.whiteboard" fallback="silent">
          <Whiteboard
            lobbyCode={lobbyCode}
            playerId={playerId}
            roundNumber={roundNumber}
            size={boardSize}
            active={stage === 'board'}
            idea={idea ? <><span className="font-bold whitespace-nowrap">{wb.ideaLabel}</span> {idea}</> : undefined}
            ideaRef={setIdeaBanner}
          />
        </SectionErrorBoundary>
      </div>
    </div>
  );
};

export default WhiteboardWaiting;
