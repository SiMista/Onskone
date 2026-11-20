import { describe, it, expect, vi } from 'vitest';
import { DRAWING_IDEA_IDS, DRAWING_PORTRAIT_ID, WHITEBOARD, isWhiteboardLocalId, type DrawingIdeaId } from '@onskone/shared';
import { WHITEBOARD_COLORS } from '../constants/whiteboard';
import { fr } from '../i18n/fr';
import { en } from '../i18n/en';
import {
  BoardStrokes, chunkPoints, farEnough, resolveDrawingIdea, fitBoard, newLocalStrokeId, paintStroke, toBoardPoint,
} from './whiteboard';

describe('BoardStrokes', () => {
  it('ajoute les points à la suite et renvoie où reprendre le dessin', () => {
    const board = new BoardStrokes();
    expect(board.append('3.a', 3, [1, 1])).toBe(0);
    expect(board.append('3.a', 3, [2, 2, 3, 3])).toBe(1);
    expect(board.get('3.a')?.points).toEqual([1, 1, 2, 2, 3, 3]);
    expect(board.pointCount).toBe(3);
  });

  it("compte l'encre par couleur, et retirer un trait la rend", () => {
    const board = new BoardStrokes();
    board.append('3.a', 3, [1, 1, 2, 2]);
    board.append('5.b', 5, [1, 1]);
    expect(board.pointsOfColor(3)).toBe(2);
    expect(board.remove('3.a')).toBe(2);
    expect(board.remove('3.a')).toBe(0);
    expect(board.pointsOfColor(3)).toBe(0);
    expect(board.pointCount).toBe(1);
  });

  it("l'état complet remplace tout, dans l'ordre reçu", () => {
    const board = new BoardStrokes();
    board.append('9.z', 9, [5, 5]);
    board.reset([{ id: '1.a', color: 1, points: [1, 1] }, { id: '2.b', color: 2, points: [2, 2, 3, 3] }]);
    expect(board.list().map((s) => s.id)).toEqual(['1.a', '2.b']);
    expect(board.pointCount).toBe(3);
  });
});

describe('conversions et envois', () => {
  const rect = { left: 10, top: 20, width: 300, height: 400 };

  it("écran → tableau, borné quand le doigt sort du tableau", () => {
    expect(toBoardPoint(10, 20, rect)).toEqual([0, 0]);
    expect(toBoardPoint(160, 220, rect)).toEqual([500, 500]);
    expect(toBoardPoint(-50, 999, rect)).toEqual([0, WHITEBOARD.RESOLUTION]);
  });

  it('ignore les micro-mouvements', () => {
    expect(farEnough([100, 100], [101, 101])).toBe(false);
    expect(farEnough([100, 100], [110, 100])).toBe(true);
  });

  it('découpe en paquets acceptés par le serveur', () => {
    const points = Array.from({ length: (WHITEBOARD.MAX_POINTS_PER_CHUNK + 1) * 2 }, (_, i) => i % 1000);
    const chunks = chunkPoints(points);
    expect(chunks.map((c) => c.length)).toEqual([WHITEBOARD.MAX_POINTS_PER_CHUNK * 2, 2]);
    expect(chunks.flat()).toEqual(points);
  });

  it('ids locaux valides pour le serveur', () => {
    for (let i = 0; i < 50; i++) expect(isWhiteboardLocalId(newLocalStrokeId())).toBe(true);
  });
});

describe('format fixe du tableau', () => {
  it('la plus grande zone 3:4 qui tient, cadre compris', () => {
    expect(fitBoard(400, 1000, 0, 0)).toEqual({ width: 400, height: Math.floor(400 / WHITEBOARD.ASPECT_RATIO) });
    expect(fitBoard(1000, 400, 0, 0)).toEqual({ width: 300, height: 400 });
    expect(fitBoard(310, 1000, 10, 40)?.width).toBe(300);
    expect(fitBoard(1000, 440, 10, 40)).toEqual({ width: 300, height: 400 });
    expect(fitBoard(0, 400, 0, 0)).toBeNull();
  });
});

describe('idée de dessin de la manche (resolveDrawingIdea)', () => {
  const ideas = fr.phases.questionSelection.whiteboard.ideas;
  const players = [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }];

  it("traduit l'id tiré par le serveur", () => {
    expect(resolveDrawingIdea(ideas, { id: 'rainbow' }, players)).toBe('Un arc-en-ciel');
  });

  it('portrait : le pseudo du joueur désigné, avec élision', () => {
    expect(resolveDrawingIdea(ideas, { id: DRAWING_PORTRAIT_ID, playerId: 'b' }, players)).toBe('Le portrait de Bob');
    expect(resolveDrawingIdea(ideas, { id: DRAWING_PORTRAIT_ID, playerId: 'a' }, players)).toBe("Le portrait d'Alice");
  });

  it("rien à afficher plutôt qu'une idée fausse (vieux serveur, id inconnu, joueur absent)", () => {
    expect(resolveDrawingIdea(ideas, undefined, players)).toBeNull();
    expect(resolveDrawingIdea(ideas, { id: 'futureIdea' }, players)).toBeNull();
    expect(resolveDrawingIdea(ideas, { id: 'toString' }, players)).toBeNull();
    expect(resolveDrawingIdea(ideas, { id: DRAWING_PORTRAIT_ID, playerId: 'zz' }, players)).toBeNull();
  });
});

describe('idées de dessin', () => {
  it('chaque id tiré par le serveur a un texte dans chaque langue', () => {
    const ids: DrawingIdeaId[] = [...DRAWING_IDEA_IDS, DRAWING_PORTRAIT_ID];
    for (const dict of [fr, en]) {
      for (const id of ids) expect(dict.phases.questionSelection.whiteboard.ideas[id], id).toBeTruthy();
    }
  });

  it('chaque idée tient sur UNE ligne en haut du tableau (libellé compris)', () => {
    // ~40 caractères = une ligne sur un tableau de téléphone en portrait (pseudo de 8 lettres).
    for (const dict of [fr, en]) {
      const wb = dict.phases.questionSelection.whiteboard;
      Object.values(wb.ideas).forEach((idea) => {
        const shown = typeof idea === 'string' ? idea : idea('Bérénice');
        expect(`${wb.ideaLabel} ${shown}`.length, shown).toBeLessThanOrEqual(40);
        if (typeof idea !== 'string') expect(shown).toContain('Bérénice');
      });
    }
  });
});

describe('palette', () => {
  it('autant de couleurs que le serveur en distribue, toutes différentes', () => {
    expect(WHITEBOARD_COLORS).toHaveLength(WHITEBOARD.COLOR_COUNT);
    expect(new Set(WHITEBOARD_COLORS.map((c) => c.toLowerCase())).size).toBe(WHITEBOARD.COLOR_COUNT);
  });
});

describe('paintStroke', () => {
  const fakeCtx = () => ({
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(),
  }) as unknown as CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;

  it("un point seul fait un rond", () => {
    const ctx = fakeCtx();
    paintStroke(ctx, { id: '0.a', color: 0, points: [500, 500] }, 0, 300, 400);
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('la suite repart du point précédent (raccord), pas du début', () => {
    const ctx = fakeCtx();
    paintStroke(ctx, { id: '0.a', color: 0, points: [0, 0, 100, 100, 200, 200] }, 2, 1000, 1000);
    expect(ctx.moveTo).toHaveBeenCalledWith(100, 100);
    expect(ctx.lineTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledWith(200, 200);
  });
});
