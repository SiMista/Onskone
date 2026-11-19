import { Fragment, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { Icon } from '../Icon';
import { dragSteps, moveAround, seatPositionAt } from '../../utils/seatDrag';
import type { IPlayer } from '@onskone/shared';
import { getAvatarUrl } from '../../constants/game';
import { STICKER_FILTER } from '../../constants/icons';
import type { Dictionary } from '../../i18n/dictionary';

type SeatPlayer = Pick<IPlayer, 'id' | 'name' | 'avatarId' | 'isActive'>;

interface SeatCircleProps {
  /** Joueurs dans l'ordre des places (sens du jeu, place n°1 en bas). */
  players: SeatPlayer[];
  currentPlayerId?: string;
  excludedLeaderIds: string[];
  /** Hôte : glisser pour déplacer, toucher pour (dés)activer comme pilier. */
  editable: boolean;
  onReorder: (seatIds: string[]) => void;
  onToggleLeader: (playerId: string) => void;
  /** Tentative de retirer le dernier pilier possible. */
  onLastLeader: () => void;
  t: Dictionary;
}

// Repère de calcul : un carré de 320 px, rendu en % du conteneur (responsive).
const BOX = 320;
const CENTER = BOX / 2;
// En deçà, un appui est un « toucher » (pilier on/off), au-delà un glisser.
const DRAG_THRESHOLD_PX = 6;
const avatarSizeFor = (n: number) => (n <= 6 ? 62 : n <= 8 ? 54 : n <= 10 ? 46 : n <= 12 ? 40 : 36);
// À partir de 9 joueurs, un prénom sous l'avatar passe sous le voisin (côtés du cercle) :
// les prénoms vont à l'intérieur de l'anneau, côté table, et la table rétrécit.
const DENSE_FROM = 9;
const pct = (v: number) => `${(v / BOX) * 100}%`;
// Débord de l'étiquette « toi » au-dessus d'un avatar (+ survol), repère BOX.
const SEAT_TOP_OVERFLOW = 10;
// Air gardé au-dessus du contenu une fois le vide rogné (repère BOX) : à 0, le cercle
// collait aux consignes.
const SEAT_TOP_BREATHING = 10;
// Flèche du sens du jeu (repère 100×100) : arc de cercle parcouru dans le sens horaire,
// pointe tangente à son bout (côté gauche, vers le haut).
const TURN_ARC = 'M43.48 20.06A31 31 0 1 1 20.8 54.31';
const TURN_HEAD = '18.44,37.48 8.92,55.98 32.68,52.64';

// Près du centre (fraction du rayon), l'angle du doigt n'a plus de sens : un millimètre
// le fait tourner d'un demi-tour. L'ordre reste figé tant que l'avatar y est.
const DRAG_DEAD_ZONE = 0.4;
// Déplacements des places : rebond quand la table se recompose (arrivée, lâcher), mais
// glissé doux pendant qu'on traîne un joueur (sinon les voisins tanguent à chaque place franchie).
// Courbe à départ modéré et longue arrivée : une ease-out trop raide (quint) faisait
// l'essentiel du trajet en quelques frames, le voisin avait l'air de sauter de place.
const SEAT_MOVE_BOUNCY = 'duration-[420ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]';
const SEAT_MOVE_SMOOTH = 'duration-[360ms] ease-[cubic-bezier(0.3,0.7,0.2,1)]';

interface Gesture {
  id: string;
  startX: number;
  startY: number;
  rect: DOMRect;
  /** Prise : écart doigt → centre de l'avatar (repère BOX), gardé pendant tout le glisser. */
  dx: number;
  dy: number;
  /** Ordre au début du geste, et dernier ordre calculé pendant le glisser. */
  from: string[];
  last: string[] | null;
}

/**
 * « Qui est assis où ? » (mode sur place) : les joueurs autour de la table, dans
 * l'ordre des places. Cet ordre ne sert QU'AU reveal (de voisin en voisin, en partant
 * de la gauche du pilier) ; les piliers sont tirés au hasard. L'hôte glisse un joueur pour le
 * déplacer (ou flèches du clavier) et le touche pour l'activer ou non comme
 * pilier ; les autres voient la table en direct, en lecture seule.
 */
const SeatCircle = ({ players, currentPlayerId, excludedLeaderIds, editable, onReorder, onToggleLeader, onLastLeader, t }: SeatCircleProps) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  // Un glisser se termine par un `click` sur l'avatar : on l'ignore.
  const suppressClick = useRef(false);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);

  const byId = new Map(players.map(p => [p.id, p]));
  // Un ordre de glisser recalé sur les joueurs présents (un joueur parti en route en sort,
  // un arrivant prend la fin).
  const withCurrentPlayers = (ids: string[]) =>
    [...ids.filter(id => byId.has(id)), ...players.filter(p => !ids.includes(p.id)).map(p => p.id)];
  // Pendant un glisser : l'ordre en cours. Sinon : l'ordre des places venu du serveur.
  const order = dragOrder ? withCurrentPlayers(dragOrder) : players.map(p => p.id);
  const seated = order.map(id => byId.get(id)!);
  const n = seated.length;
  const excluded = new Set(excludedLeaderIds);

  const dense = n >= DENSE_FROM;
  const av = avatarSizeFor(n);
  // Dense : avatars repoussés vers le bord pour laisser une bande aux prénoms.
  const radius = CENTER - av / 2 - (dense ? 6 : 14);
  const step = 360 / Math.max(1, n);
  // Haut réel du contenu (repère BOX) : l'avatar le plus haut, « toi » compris
  // (ils débordent au-dessus), ou le haut de l'anneau s'il est plus haut. Au-dessus, le
  // carré n'est que du vide (les prénoms sont SOUS les avatars, seul le bas en a besoin),
  // et avec un nombre impair de joueurs personne n'est assis tout en haut : on rogne ce
  // vide par une marge négative. Ne dépend que de n, donc stable pendant un glisser.
  let contentTop = CENTER - radius - 1.25;
  for (let i = 0; i < n; i++) {
    const seatTop = CENTER + radius * Math.sin(((90 + i * step) * Math.PI) / 180) - av / 2;
    contentTop = Math.min(contentTop, seatTop - SEAT_TOP_OVERFLOW);
  }
  const topTrim = Math.max(0, contentTop - SEAT_TOP_BREATHING);
  // Dense : prénoms sur un cercle en dedans des avatars (assez loin pour laisser passer
  // la couronne, qui déborde de l'avatar), largeur = l'arc disponible.
  const labelRadius = radius - av / 2 - 18;
  const nameWidth = dense
    ? (2 * Math.PI * labelRadius) / n - 3
    : Math.min(64, (2 * Math.PI * radius) / Math.max(1, n) - 4);

  const seatMove = dragPos ? SEAT_MOVE_SMOOTH : SEAT_MOVE_BOUNCY;

  // Piliers possibles (actifs, non exclus) : on ne retire pas le dernier.
  const leaderCount = seated.filter(p => p.isActive && !excluded.has(p.id)).length;

  const toggle = (p: SeatPlayer) => {
    const isLeader = !excluded.has(p.id);
    if (isLeader && p.isActive && leaderCount <= 1) return onLastLeader();
    onToggleLeader(p.id);
  };

  const toLocal = (e: PointerEvent, rect: DOMRect) => ({
    x: ((e.clientX - rect.left) * BOX) / rect.width,
    y: ((e.clientY - rect.top) * BOX) / rect.height,
  });

  const onPointerDown = (id: string) => (e: PointerEvent<HTMLButtonElement>) => {
    if (!editable || e.button > 0 || !boxRef.current) return;
    // Nouveau geste : un ancien « clic à ignorer » resté levé ne doit pas avaler ce tap.
    suppressClick.current = false;
    // Capture : le glisser suit le doigt même hors de l'avatar.
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = boxRef.current.getBoundingClientRect();
    const from = players.map(p => p.id);
    // L'avatar garde la prise : on ne recentre pas l'avatar sous le doigt (sinon il saute d'un demi-avatar).
    const a = ((90 + from.indexOf(id) * step) * Math.PI) / 180;
    const finger = toLocal(e, rect);
    gesture.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      rect,
      dx: finger.x - (CENTER + radius * Math.cos(a)),
      dy: finger.y - (CENTER + radius * Math.sin(a)),
      from,
      last: null,
    };
  };

  // Le joueur glissé suit le doigt place par place, à partir de l'ordre EN COURS (pas de
  // celui du départ) : à chaque place franchie, seul le voisin croisé recule d'un cran.
  // Mouvement continu, sans bord à la place n°1 et sans bascule de la moitié de la table
  // quand on passe en face du point de départ (cf. utils/seatDrag).
  const onPointerMove = (id: string) => (e: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.id !== id) return;
    if (!g.last && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD_PX) return;
    const finger = toLocal(e, g.rect);
    const x = finger.x - g.dx;
    const y = finger.y - g.dy;
    setDragPos({ id, x, y });
    const base = withCurrentPlayers(g.last ?? g.from);
    const cur = base.indexOf(id);
    const steps = Math.hypot(x - CENTER, y - CENTER) < radius * DRAG_DEAD_ZONE
      ? 0
      : dragSteps(cur, seatPositionAt(x, y, CENTER, base.length), base.length);
    const next = steps ? moveAround(base, cur, steps) : base;
    if (!g.last || next.join() !== g.last.join()) {
      g.last = next;
      setDragOrder(next);
    }
  };

  const onPointerEnd = (e: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.last) {
      // Le clic qui suit la fin d'un glisser ne doit pas basculer le pilier. Un geste
      // annulé par le système (appel entrant, geste OS) n'est suivi d'aucun clic : rien
      // à ignorer, sinon le prochain vrai tap serait avalé.
      if (e.type !== 'pointercancel') suppressClick.current = true;
      if (g.last.join() !== g.from.join()) onReorder(g.last);
    }
    setDragOrder(null);
    setDragPos(null);
  };

  const onClick = (p: SeatPlayer) => () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    toggle(p);
  };

  // Clavier : flèches = une place dans un sens ou dans l'autre (droite = sens horaire inverse,
  // comme à l'écran) ; échange avec le voisin, y compris entre la dernière place et la n°1.
  const onKeyDown = (id: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const ids = players.map(p => p.id);
    onReorder(moveAround(ids, ids.indexOf(id), e.key === 'ArrowLeft' ? 1 : -1));
  };

  return (
    // Invité (lecture seule) : table grisée, comme les options qu'il ne peut pas toucher.
    <div className={`flex flex-col gap-3 transition-opacity duration-200 ${editable ? '' : 'opacity-65'}`}>
      <div
        ref={boxRef}
        role="group"
        aria-label={t.lobby.prepare.seatsTitle}
        className="relative w-full max-w-[320px] aspect-square mx-auto select-none transition-[margin] duration-[420ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        // Marge en % = % de la LARGEUR du parent ; min(100%, 320px) = largeur du carré (max-w).
        style={{ marginTop: `calc(min(100%, 320px) * ${-topTrim / BOX})` }}
      >
        {/* Anneau pointillé qui tourne dans le sens du jeu (horaire), comme la flèche. Il passe
            par le centre des avatars (rayon qui varie avec le nombre de joueurs) : trait de
            2.5px centré sur `radius`, d'où le demi-trait retranché. */}
        <span
          aria-hidden
          className="absolute rounded-full border-[2.5px] border-dashed border-brand-500/45 pointer-events-none animate-turn-ring transition-[inset] duration-[420ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ inset: pct(CENTER - radius - 1.25) }}
        />

        {/* Centre de la table : flèche discrète du sens du jeu + sous-titre. */}
        <div
          aria-hidden
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 pointer-events-none ${dense ? 'w-[18%]' : 'w-[22%]'}`}
        >
          <svg viewBox="0 0 100 100" className="w-full h-auto">
            <path d={TURN_ARC} fill="none" strokeWidth={9} strokeLinecap="round" className="stroke-black" />
            <polygon points={TURN_HEAD} strokeWidth={3} strokeLinejoin="round" className="fill-black stroke-black" />
          </svg>
          <span
            className={`whitespace-nowrap text-black/55 ${
              dense ? 'font-display font-semibold uppercase tracking-[0.06em] text-[9px] leading-none' : 'text-display-xs'
            }`}
          >
            {t.lobby.prepare.turnDirection}
          </span>
        </div>

        {/* Ordre DOM FIXE (par id), seule la position suit la place : déplacer un nœud
            dans le DOM libère la capture du pointeur, le glisser en cours se perdait. */}
        {[...seated].sort((p1, p2) => (p1.id < p2.id ? -1 : 1)).map(p => {
          const i = order.indexOf(p.id);
          const a = ((90 + i * step) * Math.PI) / 180;
          const dragging = dragPos?.id === p.id;
          const x = dragging ? dragPos.x : CENTER + radius * Math.cos(a);
          const y = dragging ? dragPos.y : CENTER + radius * Math.sin(a);
          const isLeader = !excluded.has(p.id);
          const dimmed = !isLeader || !p.isActive;
          const isMe = p.id === currentPlayerId;
          // Dense : couronne côté EXTÉRIEUR de la place (sinon elle mord sur les prénoms
          // intérieurs), étiquette « toi » côté intérieur.
          const outerLeft = Math.cos(a) < 0;
          const nameClass = `text-center font-display leading-tight truncate pointer-events-none ${
            isMe ? 'font-bold' : 'font-semibold'
          } ${dimmed ? 'text-gray-400' : 'text-black'}`;
          return (
            <Fragment key={p.id}>
            <div
              className={`absolute ${dragging ? 'z-30' : `z-10 transition-[left,top] ${seatMove}`}`}
              style={{ left: pct(x - av / 2), top: pct(y - av / 2), width: pct(av), height: pct(av) }}
            >
              <div className="relative w-full h-full animate-player-pop" style={{ animationDelay: `${i * 45}ms` }}>
                <button
                  type="button"
                  aria-pressed={isLeader}
                  aria-label={t.lobby.prepare.seatAria(p.name, isLeader, editable)}
                  disabled={!editable}
                  onPointerDown={onPointerDown(p.id)}
                  onPointerMove={onPointerMove(p.id)}
                  onPointerUp={onPointerEnd}
                  onPointerCancel={onPointerEnd}
                  onClick={onClick(p)}
                  onKeyDown={onKeyDown(p.id)}
                  className={`block w-full h-full p-0 rounded-full bg-white overflow-hidden border-[2.5px] transition-[transform,box-shadow] duration-300 ${
                    dimmed ? 'border-black/45' : 'border-black'
                  } ${dragging
                    ? 'cursor-grabbing scale-[1.16] -rotate-6 [box-shadow:5px_8px_0_0_rgba(0,0,0,0.3)]'
                    : '[box-shadow:2px_2px_0_0_black]'
                  } ${editable ? 'cursor-grab touch-none hover:-translate-y-[3px] hover:-rotate-[4deg] active:scale-[0.94]' : 'cursor-default'}`}
                >
                  <img
                    src={getAvatarUrl(p.avatarId)}
                    alt=""
                    draggable={false}
                    className={`w-full h-full object-cover pointer-events-none transition-[filter,opacity] duration-300 ${dimmed ? 'grayscale opacity-45' : ''}`}
                  />
                </button>
                {isMe && (
                  <span
                    className={`absolute px-1 py-px rounded-[5px] bg-white border-[1.5px] border-black rotate-[8deg] [box-shadow:1px_1px_0_0_black] font-display font-bold uppercase leading-none ${
                      dense ? `-top-1.5 text-[7px] ${outerLeft ? '-right-1.5' : '-left-1.5'}` : '-top-2 -right-2 text-[9px]'
                    }`}
                  >
                    {t.lobby.prepare.youTag}
                  </span>
                )}
                {isLeader && (
                  <Icon
                    icon="fluent-emoji-flat:crown"
                    width={dense ? 14 : 18}
                    height={dense ? 14 : 18}
                    aria-hidden
                    className={`absolute pointer-events-none ${dense ? `-bottom-1 ${outerLeft ? '-left-1.5' : '-right-1.5'}` : '-bottom-1.5 -right-2'}`}
                    style={{ filter: STICKER_FILTER }}
                  />
                )}
                {!dense && (
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 text-[11px] ${nameClass}`}
                    style={{ top: 'calc(100% + 4px)', width: `${(nameWidth / av) * 100}%` }}
                  >
                    {p.name}
                  </span>
                )}
              </div>
            </div>
            {/* Dense : prénom à l'intérieur de l'anneau, face à sa place (masqué pendant son glisser). */}
            {dense && !dragging && (
              <span
                aria-hidden
                className={`absolute z-10 text-[10px] transition-[left,top] ${seatMove} ${nameClass}`}
                style={{
                  left: pct(CENTER + labelRadius * Math.cos(a) - nameWidth / 2),
                  top: pct(CENTER + labelRadius * Math.sin(a) - 6),
                  width: pct(nameWidth),
                }}
              >
                {p.name}
              </span>
            )}
            </Fragment>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex justify-end gap-4 font-sans text-[11px] text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <Icon icon="fluent-emoji-flat:crown" width={14} height={14} aria-hidden style={{ filter: STICKER_FILTER }} />
          : {t.lobby.prepare.legendLeader}
        </span>
      </div>
    </div>
  );
};

export default SeatCircle;
