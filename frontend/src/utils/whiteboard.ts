import { WHITEBOARD, type WhiteboardStroke } from '@onskone/shared';
import { WHITEBOARD_LINE_WIDTH, WHITEBOARD_MIN_POINT_DISTANCE, whiteboardColor } from '../constants/whiteboard';

// Logique pure du tableau blanc partagé (cf. shared/src/whiteboard.ts) : modèle des
// traits côté client, conversions écran ↔ tableau, découpe des envois et rendu canvas.

export type BoardPoint = [x: number, y: number];

/** Traits du tableau, dans l'ordre de dessin (ordre d'insertion de la Map). */
export class BoardStrokes {
  private readonly strokes = new Map<string, WhiteboardStroke>();
  private total = 0;

  /** Remplace tout le tableau (état complet reçu du serveur). */
  reset(list: WhiteboardStroke[]): void {
    this.strokes.clear();
    this.total = 0;
    list.forEach((s) => this.append(s.id, s.color, s.points));
  }

  /**
   * Ajoute des points à un trait (créé s'il est inconnu). Renvoie l'index du premier
   * point ajouté : le rendu ne repeint que la suite du trait.
   */
  append(id: string, color: number, points: number[]): number {
    let stroke = this.strokes.get(id);
    if (!stroke) {
      stroke = { id, color, points: [] };
      this.strokes.set(id, stroke);
    }
    const from = stroke.points.length / 2;
    stroke.points.push(...points);
    this.total += points.length / 2;
    return from;
  }

  /** Retire un trait. Renvoie son nombre de points (0 s'il était inconnu). */
  remove(id: string): number {
    const stroke = this.strokes.get(id);
    if (!stroke) return 0;
    this.strokes.delete(id);
    const count = stroke.points.length / 2;
    this.total -= count;
    return count;
  }

  get(id: string): WhiteboardStroke | undefined {
    return this.strokes.get(id);
  }

  list(): WhiteboardStroke[] {
    return [...this.strokes.values()];
  }

  /** Points de tous les traits d'une couleur (= l'encre utilisée par un joueur). */
  pointsOfColor(color: number): number {
    let n = 0;
    this.strokes.forEach((s) => { if (s.color === color) n += s.points.length / 2; });
    return n;
  }

  get pointCount(): number {
    return this.total;
  }
}

const clampUnit = (v: number): number => Math.min(WHITEBOARD.RESOLUTION, Math.max(0, Math.round(v)));

/** Position écran → coordonnées entières du tableau (bornées : on peut déborder en dessinant). */
export const toBoardPoint = (
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): BoardPoint => [
  clampUnit(((clientX - rect.left) / rect.width) * WHITEBOARD.RESOLUTION),
  clampUnit(((clientY - rect.top) / rect.height) * WHITEBOARD.RESOLUTION),
];

/** Le point est-il assez loin du précédent pour valoir la peine d'être envoyé ? */
export const farEnough = (last: BoardPoint, next: BoardPoint): boolean =>
  Math.hypot(next[0] - last[0], next[1] - last[1]) >= WHITEBOARD_MIN_POINT_DISTANCE;

/** Découpe des points à plat en paquets acceptés par le serveur. */
export const chunkPoints = (points: number[]): number[][] => {
  const size = WHITEBOARD.MAX_POINTS_PER_CHUNK * 2;
  const chunks: number[][] = [];
  for (let i = 0; i < points.length; i += size) chunks.push(points.slice(i, i + size));
  return chunks;
};

/** Id local d'un trait (cf. isWhiteboardLocalId : 1 à 12 caractères alphanumériques). */
export const newLocalStrokeId = (): string =>
  (Math.random().toString(36).slice(2, 10) || '0') + (Date.now() % 1296).toString(36);

/**
 * Peint un trait à partir de son point `from` (0 = tout le trait), sur un canvas déjà
 * mis à l'échelle (CSS px) de `width` × `height`. Un trait d'un seul point est un rond.
 */
export const paintStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: WhiteboardStroke,
  from: number,
  width: number,
  height: number,
): void => {
  const { points } = stroke;
  const count = points.length / 2;
  if (count === 0 || from >= count) return;
  const sx = width / WHITEBOARD.RESOLUTION;
  const sy = height / WHITEBOARD.RESOLUTION;
  const lineWidth = WHITEBOARD_LINE_WIDTH * width;
  const color = whiteboardColor(stroke.color);
  if (count === 1) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(points[0] * sx, points[1] * sy, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  // On repart du point d'avant pour raccorder la suite au trait déjà peint.
  const start = Math.max(0, from - 1);
  ctx.moveTo(points[start * 2] * sx, points[start * 2 + 1] * sy);
  for (let i = start + 1; i < count; i++) ctx.lineTo(points[i * 2] * sx, points[i * 2 + 1] * sy);
  ctx.stroke();
};

/** Repeint tout le tableau (annulation, état complet, redimensionnement). */
export const paintAll = (
  ctx: CanvasRenderingContext2D,
  strokes: WhiteboardStroke[],
  width: number,
  height: number,
): void => {
  ctx.clearRect(0, 0, width, height);
  strokes.forEach((s) => paintStroke(ctx, s, 0, width, height));
};

/**
 * Plus grande zone de dessin au format fixe (largeur / hauteur = ASPECT_RATIO) qui tient
 * dans la place dispo, cadre compris (`frameX` / `frameY` : place prise par le cadre en
 * largeur / en hauteur). null si la place est nulle.
 */
export const fitBoard = (
  availableWidth: number,
  availableHeight: number,
  frameX: number,
  frameY: number,
): { width: number; height: number } | null => {
  const width = Math.floor(Math.min(availableWidth - frameX, (availableHeight - frameY) * WHITEBOARD.ASPECT_RATIO));
  if (width <= 0) return null;
  return { width, height: Math.floor(width / WHITEBOARD.ASPECT_RATIO) };
};

/** FNV-1a : même entrée, même nombre, sur tous les téléphones. */
export const stableHash = (key: string): number => {
  let hash = 0x811c9dc5;
  for (const ch of key) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

/** Générateur pseudo-aléatoire à graine (mulberry32) : même graine, même suite partout. */
const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Mélange de Fisher-Yates à graine (copie). */
export const seededShuffle = <T>(items: readonly T[], seed: number): T[] => {
  const out = [...items];
  const rand = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Idée de dessin : un texte, ou une fonction qui reçoit 1 ou 2 pseudos (cf. le dictionnaire). */
export type DrawingIdea = string | ((a: string, b: string) => string);

/** Nombre de joueurs mis en scène : 0 (classique), 1 ou 2 (duo), d'après les paramètres. */
export const ideaArity = (idea: DrawingIdea): 0 | 1 | 2 =>
  typeof idea === 'string' ? 0 : idea.length >= 2 ? 2 : 1;

/**
 * Ordre des idées pour toute la partie : mélangé par la graine, pris dans l'ordre manche
 * après manche, donc aucune idée ne revient avant que toutes soient passées. La manche 1
 * met toujours un joueur en scène (première impression : « c'est moi ?! »).
 */
export const drawingIdeaOrder = (arities: readonly number[], seed: number): number[] => {
  const order = seededShuffle(arities.map((_, i) => i), seed);
  const firstNamed = order.findIndex((i) => arities[i] > 0);
  if (firstNamed > 0) [order[0], order[firstNamed]] = [order[firstNamed], order[0]];
  return order;
};

/**
 * Idée de dessin de la manche, la même sur tous les téléphones du salon, sans
 * aller-retour serveur (graine de la partie + numéro de manche).
 *
 * Joueurs mis en scène : à tour de rôle, dans un ordre mélangé par la graine (triés par
 * id d'abord, pour ne pas dépendre de l'ordre de la liste). Chaque idée « à nom » prend
 * le(s) suivant(s) : tout le monde passe une fois avant que quelqu'un y repasse, et un
 * duo réunit toujours deux joueurs différents (dès qu'il y en a deux).
 */
export const resolveDrawingIdea = (
  ideas: readonly DrawingIdea[],
  seed: number,
  roundNumber: number,
  players: readonly { id: string; name: string }[],
): string => {
  if (ideas.length === 0) return '';
  const arities = ideas.map(ideaArity);
  const order = drawingIdeaOrder(arities, seed);
  const round = Math.max(0, roundNumber - 1);
  const idea = ideas[order[round % order.length]];
  if (typeof idea === 'string') return idea;

  // Places de la rotation déjà prises par les manches d'avant.
  let used = 0;
  for (let r = 0; r < round; r++) used += arities[order[r % order.length]];
  const sorted = [...players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const roster = seededShuffle(sorted, stableHash(`${seed}:players`));
  if (roster.length === 0) return idea('?', '?');
  const first = roster[used % roster.length].name;
  const second = roster[(used + 1) % roster.length].name;
  return idea(first, second);
};
