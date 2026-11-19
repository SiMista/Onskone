import { describe, it, expect, vi } from 'vitest';
import { WHITEBOARD, isWhiteboardLocalId } from '@onskone/shared';
import { WHITEBOARD_COLORS } from '../constants/whiteboard';
import { fr } from '../i18n/fr';
import { en } from '../i18n/en';
import {
  BoardStrokes, chunkPoints, drawingIdeaOrder, farEnough, ideaArity, resolveDrawingIdea, fitBoard, newLocalStrokeId, paintStroke, toBoardPoint,
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
  const ideas = ['Pizza', 'Volcan', 'Zoo', (n: string) => `${n} en pirate`, (n: string) => `${n} en robot`, (a: string, b: string) => `${a} épouse ${b}`];
  const players = [{ id: 'c', name: 'Charlie' }, { id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }, { id: 'd', name: 'Dana' }];
  const game = (seed: number, list = players) =>
    Array.from({ length: ideas.length }, (_, r) => resolveDrawingIdea(ideas, seed, r + 1, list));

  it("la même pour tout le salon, quel que soit l'ordre de la liste des joueurs", () => {
    expect(game(42, [...players].reverse())).toEqual(game(42));
  });

  it('aucune idée ne revient avant que toutes soient passées', () => {
    for (const seed of [1, 42, 999, 123456]) {
      const order = drawingIdeaOrder(ideas.map(ideaArity), seed);
      expect([...order].sort()).toEqual(ideas.map((_, i) => i));
    }
  });

  it('la manche 1 met toujours un joueur en scène', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(ideaArity(ideas[drawingIdeaOrder(ideas.map(ideaArity), seed)[0]])).toBeGreaterThan(0);
    }
  });

  it('nouvelle partie (autre graine), autre suite', () => {
    const runs = new Set(Array.from({ length: 10 }, (_, seed) => game(seed).join('|')));
    expect(runs.size).toBeGreaterThan(1);
  });

  it('les joueurs passent à tour de rôle, et un duo réunit deux joueurs différents', () => {
    // Que des idées à nom : 1 + 2 + 1 = 4 places = chacun des 4 joueurs une fois.
    const named = [(n: string) => `solo:${n}`, (a: string, b: string) => `duo:${a}+${b}`, (n: string) => `solo:${n}`];
    for (const seed of [3, 7, 2024]) {
      const shown = Array.from({ length: 3 }, (_, r) => resolveDrawingIdea(named, seed, r + 1, players))
        .flatMap((s) => s.split(':')[1].split('+'));
      expect(new Set(shown).size).toBe(players.length);
    }
  });
});

describe('idées de dessin', () => {
  it("même nombre dans chaque langue : l'index tiré désigne la même idée pour tout le salon", () => {
    expect(fr.phases.questionSelection.whiteboard.ideas.length).toBeGreaterThan(10);
    expect(en.phases.questionSelection.whiteboard.ideas).toHaveLength(fr.phases.questionSelection.whiteboard.ideas.length);
  });

  it('même forme à chaque index : classique, solo ou duo dans toutes les langues', () => {
    const frIdeas = fr.phases.questionSelection.whiteboard.ideas;
    const enIdeas = en.phases.questionSelection.whiteboard.ideas;
    frIdeas.forEach((idea, i) => expect(ideaArity(enIdeas[i]), String(i)).toBe(ideaArity(idea)));
  });

  it('chaque idée tient sur UNE ligne en haut du tableau (libellé compris)', () => {
    // ~40 caractères = une ligne sur un tableau de téléphone en portrait. Pseudo de
    // 8 lettres pour un solo ; pour un duo, deux pseudos courts (3 lettres) : choix
    // assumé, avec deux pseudos longs un duo passe sur 2 lignes.
    for (const dict of [fr, en]) {
      const wb = dict.phases.questionSelection.whiteboard;
      wb.ideas.forEach((idea) => {
        const arity = ideaArity(idea);
        const shown = typeof idea === 'string' ? idea : arity === 2 ? idea('Léa', 'Tom') : idea('Bérénice', '');
        expect(`${wb.ideaLabel} ${shown}`.length, shown).toBeLessThanOrEqual(40);
        if (arity >= 1) expect(shown).toContain(arity === 2 ? 'Léa' : 'Bérénice');
        if (arity === 2) expect(shown).toContain('Tom');
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
