import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, Ref } from 'react';
import { LuUndo2 } from 'react-icons/lu';
import { WHITEBOARD, whiteboardStrokeId } from '@onskone/shared';
import socket from '../utils/socket';
import { useSocketEvent } from '../hooks';
import { useLocale } from '../i18n';
import { WHITEBOARD_BOARD_WAIT_MS, WHITEBOARD_FLUSH_MS, WHITEBOARD_FRAME, whiteboardColor } from '../constants/whiteboard';
import {
  BoardStrokes, chunkPoints, farEnough, newLocalStrokeId, paintAll, paintStroke, toBoardPoint,
  type BoardPoint,
} from '../utils/whiteboard';

interface Drawing {
  pointerId: number;
  /** Trait en cours (un geste trop long continue sur un nouveau trait, cf. addPoint). */
  localId: string;
  last: BoardPoint;
  pointsInStroke: number;
}

/**
 * Tableau blanc partagé (cf. shared/src/whiteboard.ts). Le serveur fait foi : à
 * l'ouverture (et à chaque reconnexion) on lui demande tout le tableau et notre
 * couleur ; on dessine nos traits en local tout de suite et on les lui envoie par
 * paquets ; ceux des autres arrivent en direct. Un stylo, une couleur, et « Annuler »
 * qui retire notre dernier geste. Rien d'autre, c'est voulu.
 */
const Whiteboard = ({ lobbyCode, playerId, roundNumber, size, active = true, idea, ideaRef }: {
  lobbyCode: string;
  playerId: string;
  roundNumber: number;
  /** Zone de dessin (px), au format WHITEBOARD.ASPECT_RATIO : calculée par l'écran qui l'accueille (cf. fitBoard). */
  size: { width: number; height: number } | null;
  /** false pendant l'intro de l'écran : le tableau est là (chargé) mais pas encore touchable. */
  active?: boolean;
  /** Idée de dessin : bandeau en haut du tableau, au-dessus de la zone de dessin. */
  idea?: ReactNode;
  /** Bandeau de l'idée, pour que l'écran qui accueille le tableau réserve sa hauteur. */
  ideaRef?: Ref<HTMLParagraphElement>;
}) => {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const strokesRef = useRef(new BoardStrokes());
  const myColorRef = useRef<number | null>(null);
  const [myColor, setMyColor] = useState<number | null>(null);
  // Nos gestes, du plus ancien au plus récent : chacun = ses traits (ids locaux).
  const gesturesRef = useRef<string[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const drawingRef = useRef<Drawing | null>(null);
  // À envoyer au prochain paquet : points par trait (dans l'ordre), puis gestes annulés.
  const queueRef = useRef<{ localId: string; points: number[] }[]>([]);
  const undoQueueRef = useRef<string[][]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Demandes de tableau encore sans réponse. Tant qu'il y en a, on n'envoie rien : le
  // tableau qui va arriver ne contiendra pas nos derniers gestes, on les rejouera dessus
  // avant de les envoyer (cf. whiteboardState).
  const pendingBoardRequestsRef = useRef(0);
  const boardWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const context = () => canvasRef.current?.getContext('2d') ?? null;

  const repaint = useCallback(() => {
    const ctx = context();
    const s = sizeRef.current;
    if (ctx && s) paintAll(ctx, strokesRef.current.list(), s.width, s.height);
  }, []);

  // Canvas net sur écran haute densité, repeint en entier à chaque taille.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) {
      // Canvas démonté : un geste en cours ne recevra jamais son pointerup.
      drawingRef.current = null;
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    repaint();
  }, [size, repaint]);

  // ----- Envoi -----

  const flush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (pendingBoardRequestsRef.current > 0) return;
    const queue = queueRef.current;
    const undos = undoQueueRef.current;
    queueRef.current = [];
    undoQueueRef.current = [];
    queue.forEach(({ localId, points }) => {
      chunkPoints(points).forEach((chunk) => {
        socket.emit('whiteboardDraw', { lobbyCode, playerId, roundNumber, strokeId: localId, points: chunk });
      });
    });
    undos.forEach((gesture) => {
      for (let i = 0; i < gesture.length; i += WHITEBOARD.MAX_STROKES_PER_UNDO) {
        const strokeIds = gesture.slice(i, i + WHITEBOARD.MAX_STROKES_PER_UNDO);
        socket.emit('whiteboardUndo', { lobbyCode, playerId, roundNumber, strokeIds });
      }
    });
  }, [lobbyCode, playerId, roundNumber]);

  const scheduleFlush = () => {
    if (!flushTimerRef.current) flushTimerRef.current = setTimeout(flush, WHITEBOARD_FLUSH_MS);
  };

  const stopWaitingForBoard = useCallback(() => {
    if (boardWaitTimerRef.current) clearTimeout(boardWaitTimerRef.current);
    boardWaitTimerRef.current = null;
    pendingBoardRequestsRef.current = 0;
  }, []);

  // Phase finie (démontage) : on envoie ce qui reste, le serveur trie.
  useEffect(() => () => {
    stopWaitingForBoard();
    flush();
  }, [flush, stopWaitingForBoard]);

  // ----- Réception -----

  const requestBoard = useCallback(() => {
    // Ce qui attend part AVANT la demande : le tableau reçu le contiendra.
    flush();
    pendingBoardRequestsRef.current += 1;
    socket.emit('getWhiteboard', { lobbyCode, playerId });
    // Serveur muet (rate limit, socket pas encore rattaché) : on n'attend pas indéfiniment.
    if (boardWaitTimerRef.current) clearTimeout(boardWaitTimerRef.current);
    boardWaitTimerRef.current = setTimeout(() => {
      stopWaitingForBoard();
      flush();
    }, WHITEBOARD_BOARD_WAIT_MS);
  }, [flush, stopWaitingForBoard, lobbyCode, playerId]);

  useEffect(() => { requestBoard(); }, [requestBoard]);
  // État complet de la partie reçu (reconnexion, resynchro) : le socket vient d'être
  // rattaché à notre place (avant, le serveur l'ignorait) et on a pu rater des traits.
  useSocketEvent('gameState', requestBoard);

  useSocketEvent('whiteboardState', (data) => {
    if (data.roundNumber !== roundNumber) return;
    // Plus aucune demande en cours = réponse arrivée après le délai d'attente : périmée
    // (on a envoyé depuis), sauf si c'est la toute première (pas encore de couleur).
    if (pendingBoardRequestsRef.current === 0 && myColorRef.current !== null) return;
    pendingBoardRequestsRef.current = Math.max(0, pendingBoardRequestsRef.current - 1);
    const color = data.myColor;
    myColorRef.current = color;
    setMyColor(color);

    // Le tableau du serveur, puis nos gestes faits depuis la demande (pas encore envoyés).
    const strokes = strokesRef.current;
    strokes.reset(data.strokes);
    queueRef.current.forEach(({ localId, points }) => strokes.append(whiteboardStrokeId(color, localId), color, points));
    const undone = new Set(undoQueueRef.current.flat());
    undone.forEach((localId) => strokes.remove(whiteboardStrokeId(color, localId)));

    // Nos gestes : ceux qu'on connaît encore (sans les traits perdus), précédés de nos
    // traits que le serveur a et qu'on ne connaissait pas (rechargement) : un geste chacun.
    const prefix = whiteboardStrokeId(color, '');
    const exists = (localId: string) => strokes.get(whiteboardStrokeId(color, localId)) !== undefined;
    const kept = gesturesRef.current.map((gesture) => gesture.filter(exists)).filter((gesture) => gesture.length > 0);
    const keptIds = new Set(kept.flat());
    const recovered = data.strokes
      .filter((s) => s.id.startsWith(prefix))
      .map((s) => s.id.slice(prefix.length))
      .filter((localId) => !keptIds.has(localId) && !undone.has(localId))
      .map((localId) => [localId]);
    gesturesRef.current = [...recovered, ...kept];
    setCanUndo(gesturesRef.current.length > 0);
    repaint();

    if (pendingBoardRequestsRef.current === 0) {
      stopWaitingForBoard();
      flush();
    }
  });

  useSocketEvent('whiteboardStroke', ({ roundNumber: round, stroke }) => {
    // Nos propres traits sont déjà peints (le serveur ne renvoie pas d'écho).
    if (round !== roundNumber || stroke.color === myColorRef.current) return;
    const from = strokesRef.current.append(stroke.id, stroke.color, stroke.points);
    const ctx = context();
    const s = sizeRef.current;
    const full = strokesRef.current.get(stroke.id);
    if (ctx && s && full) paintStroke(ctx, full, from, s.width, s.height);
  });

  useSocketEvent('whiteboardStrokeRemoved', ({ roundNumber: round, strokeIds }) => {
    if (round !== roundNumber) return;
    const removed = strokeIds.reduce((sum, id) => sum + strokesRef.current.remove(id), 0);
    if (removed > 0) repaint();
  });

  // ----- Dessin -----

  // Encre restante (limites du serveur) : au-delà, le trait s'arrête sans rien dire.
  const inkLeft = (color: number) => Math.min(
    WHITEBOARD.MAX_POINTS_PER_PLAYER - strokesRef.current.pointsOfColor(color),
    WHITEBOARD.MAX_POINTS_TOTAL - strokesRef.current.pointCount,
  );

  /** Ajoute un point au trait en cours : peint tout de suite, envoyé au prochain paquet. */
  const addPoint = (p: BoardPoint) => {
    const drawing = drawingRef.current;
    const color = myColorRef.current;
    if (!drawing || color === null) return;
    if (inkLeft(color) <= 0) {
      drawingRef.current = null;
      return;
    }
    // Trait plein : le geste continue sur un nouveau trait, qui repart du dernier point
    // (raccord invisible). Le raccord peut épuiser l'encre : on s'arrête alors là.
    if (drawing.pointsInStroke >= WHITEBOARD.MAX_POINTS_PER_STROKE) {
      const next = newLocalStrokeId();
      gesturesRef.current[gesturesRef.current.length - 1]?.push(next);
      drawing.localId = next;
      drawing.pointsInStroke = 0;
      addPoint(drawing.last);
      if (drawingRef.current !== drawing) return;
    }
    const id = whiteboardStrokeId(color, drawing.localId);
    const from = strokesRef.current.append(id, color, p);
    const ctx = context();
    const s = sizeRef.current;
    const stroke = strokesRef.current.get(id);
    if (ctx && s && stroke) paintStroke(ctx, stroke, from, s.width, s.height);

    const queue = queueRef.current;
    const tail = queue[queue.length - 1];
    if (tail?.localId === drawing.localId) tail.points.push(p[0], p[1]);
    else queue.push({ localId: drawing.localId, points: [p[0], p[1]] });
    drawing.pointsInStroke += 1;
    drawing.last = p;
    scheduleFlush();
  };

  const pointOf = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    return canvas ? toBoardPoint(e.clientX, e.clientY, canvas.getBoundingClientRect()) : null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const color = myColorRef.current;
    // Un seul doigt à la fois ; clic gauche seulement à la souris.
    if (!active || color === null || drawingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = pointOf(e);
    if (!p) return;
    e.preventDefault();
    if (inkLeft(color) <= 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
    const localId = newLocalStrokeId();
    gesturesRef.current.push([localId]);
    setCanUndo(true);
    drawingRef.current = { pointerId: e.pointerId, localId, last: p, pointsInStroke: 0 };
    addPoint(p);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drawing = drawingRef.current;
    if (!drawing || e.pointerId !== drawing.pointerId) return;
    // Points intermédiaires du navigateur : un trait rapide reste lisse.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length > 0 ? events : [e.nativeEvent]) {
      const p = pointOf(ev);
      const current = drawingRef.current;
      if (p && current && farEnough(current.last, p)) addPoint(p);
    }
  };

  const endStroke = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drawingRef.current?.pointerId !== e.pointerId) return;
    drawingRef.current = null;
    flush();
  };

  const undo = () => {
    const color = myColorRef.current;
    const gesture = gesturesRef.current.pop();
    if (color === null || !gesture) return;
    if (drawingRef.current && gesture.includes(drawingRef.current.localId)) drawingRef.current = null;
    gesture.forEach((localId) => strokesRef.current.remove(whiteboardStrokeId(color, localId)));
    // Ses points pas encore partis ne partiront pas ; le serveur retire ceux qu'il a déjà.
    queueRef.current = queueRef.current.filter(({ localId }) => !gesture.includes(localId));
    undoQueueRef.current.push(gesture);
    setCanUndo(gesturesRef.current.length > 0);
    repaint();
    flush();
  };

  const ready = myColor !== null;
  const { border, rail, tray } = WHITEBOARD_FRAME;

  if (!size) return null;
  return (
    // Un vrai tableau blanc : cadre alu (montants + rebord à feutres en bas), surface
    // légèrement creusée. La zone de dessin garde la taille exacte reçue.
    // Pas de reflet sur la surface : sur du blanc, il ne peut être que gris.
    <div
      className="relative rounded-2xl border-black stack-shadow bg-gradient-to-b from-gray-100 via-gray-300 to-gray-200"
      style={{ borderWidth: border, padding: `${rail}px ${rail}px 0` }}
    >
      <div
        className="relative bg-white rounded-md overflow-hidden ring-1 ring-black/25 shadow-[inset_0_1px_4px_rgba(0,0,0,0.18)]"
        style={{ width: size.width }}
      >
        {/* Idée de dessin : bandeau incrusté en haut du tableau, hors de la zone de
            dessin (on ne peut pas écrire dessus). Taille suivant la largeur du tableau :
            en paysage serré il est tout petit. */}
        {idea && (
          <p
            ref={ideaRef}
            className="!m-0 px-[5%] py-1.5 text-center font-sans text-black leading-snug text-pretty [overflow-wrap:anywhere] bg-gray-100 border-b border-black/20 select-none"
            style={{ fontSize: Math.min(14, Math.max(8, size.width / 22)) }}
          >
            {idea}
          </p>
        )}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t.phases.questionSelection.whiteboard.aria}
          className={`block touch-none select-none [-webkit-touch-callout:none] ${ready && active ? 'cursor-crosshair' : 'cursor-default'}`}
          style={{ width: size.width, height: size.height }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onLostPointerCapture={endStroke}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Rebord à feutres : ton feutre (ta couleur) et Annuler ton dernier trait. */}
      <div className="flex items-center justify-end gap-2 px-1" style={{ height: tray }}>
        {ready && (
          <>
            <span aria-hidden className="flex items-center drop-shadow-[1px_1.5px_0_rgba(0,0,0,0.35)]" title={t.phases.questionSelection.whiteboard.yourMarker}>
              <span className="w-1.5 h-2.5 rounded-l-full" style={{ backgroundColor: whiteboardColor(myColor) }} />
              <span className="w-3.5 h-4 rounded-l-[4px] border-[1.5px] border-black" style={{ backgroundColor: whiteboardColor(myColor) }} />
              <span className="w-9 h-4 bg-white border-[1.5px] border-l-0 border-black rounded-r-[5px] flex items-center justify-center">
                <span className="w-5 h-1.5 rounded-full" style={{ backgroundColor: whiteboardColor(myColor) }} />
              </span>
            </span>
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              aria-label={t.phases.questionSelection.whiteboard.undo}
              title={t.phases.questionSelection.whiteboard.undo}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border-2 border-black text-black stack-shadow-sm cursor-pointer transition-[transform,opacity] duration-150 active:scale-90 disabled:opacity-40 disabled:cursor-default disabled:active:scale-100"
            >
              <LuUndo2 size={15} strokeWidth={2.75} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Whiteboard;
