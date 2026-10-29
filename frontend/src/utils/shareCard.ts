import logoFr from '../assets/logos/logo-fr.png';
import logoEn from '../assets/logos/logo-en.png';
import bgImg from '../assets/images/bg-question-marks.svg';
import { getAvatarUrl } from '../constants/game';
import { TIERS } from '../constants/tiers';
import type { Locale } from '@onskone/shared';
import type { Dictionary } from '../i18n/dictionary';

// Logo par langue ; repli FR (canvas n'a pas accès au contexte React).
const LOGO_BY_LOCALE: Record<Locale, string> = {
  fr: logoFr,
  en: logoEn,
};

export interface ShareCardOptions {
  pct: number;
  verdictTitle: string;
  verdictMessage: string;
  color: string;
  tierEmoji: string;
  /** Tous les joueurs classés, dans l'ordre ; la grille s'adapte à leur nombre. */
  topPlayers: { name: string; score: number; avatarId?: number }[];
  /** Textes localisés (canvas n'a pas accès au contexte React) */
  texts: Dictionary['shareCard'];
  /** Langue pour le logo ; repli FR si absent. */
  locale?: Locale;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const truncate = (s: string, max: number) =>
  s.length > max ? s.slice(0, max - 1) + '…' : s;

/**
 * Dessine un texte centré horizontalement avec un letter-spacing manuel
 * (le canvas n'a pas de `letterSpacing` fiable cross-browser). Le caller a déjà
 * configuré font / fillStyle / shadow sur le ctx ; on n'écrit que les glyphes.
 */
const drawSpacedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number
) => {
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'center';
  const letters = text.split('');
  const totalW =
    letters.reduce((s, l) => s + ctx.measureText(l).width, 0) +
    spacing * (letters.length - 1);
  let lx = centerX - totalW / 2;
  for (const l of letters) {
    const lw = ctx.measureText(l).width;
    ctx.fillText(l, lx + lw / 2, y);
    lx += lw + spacing;
  }
  ctx.textAlign = prevAlign;
};

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
};

// "Stack shadow" maison : 3 cartes noires décalées derrière l'élément.
const drawStackShadow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  offsets: number[] = [4, 8, 12],
  alphas: number[] = [1, 0.22, 0.1]
) => {
  for (let i = offsets.length - 1; i >= 0; i--) {
    ctx.save();
    ctx.globalAlpha = alphas[i];
    ctx.fillStyle = '#000';
    roundRectPath(ctx, x + offsets[i], y + offsets[i], w, h, r);
    ctx.fill();
    ctx.restore();
  }
};

// Carte arrondie "façon site" : fond plein + bordure noire épaisse.
const drawCard = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
  stroke: string,
  strokeWidth: number
) => {
  ctx.save();
  ctx.fillStyle = fill;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
};

export async function buildShareCard(opts: ShareCardOptions): Promise<Blob> {
  // Format story 9:16
  const W = 1080;
  const H = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    /* ignore */
  }

  // === Fond : gradient bleu du site ===
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#173f6e');
  bg.addColorStop(0.5, '#1d7fc4');
  bg.addColorStop(1, '#22c3f4');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // === Pattern points d'interrogation (même tile SVG que le fond de l'app) ===
  // Un tile par largeur, comme sur un téléphone. Redessiné à cette taille dans un canvas
  // intermédiaire : un pattern agrandi étirerait le bitmap de l'SVG, d'où des « ? » flous.
  try {
    const svg = await loadImage(bgImg);
    const tileW = W;
    const tileH = Math.round(tileW * ((svg.naturalHeight || 560) / (svg.naturalWidth || 440)));
    const tile = document.createElement('canvas');
    tile.width = tileW;
    tile.height = tileH;
    tile.getContext('2d')?.drawImage(svg, 0, 0, tileW, tileH);
    const p = ctx.createPattern(tile, 'repeat');
    if (p) {
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, W, H);
    }
  } catch {
    /* ignore */
  }

  // Lueurs douces : une en haut à droite (derrière le CTA), une en bas à gauche
  for (const [gx, gy, gr] of [[W * 0.85, 120, 620], [W * 0.1, H - 200, 700]] as const) {
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    glow.addColorStop(0, 'rgba(255,255,255,0.28)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  // Léger voile sombre en haut/bas pour aérer la composition
  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, 'rgba(20,50,90,0.25)');
  veil.addColorStop(0.5, 'rgba(20,50,90,0)');
  veil.addColorStop(1, 'rgba(10,40,70,0.35)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  // Logo : dessiné dans le post-it en haut (chargé ici pour que le canvas l'ait prêt)
  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await loadImage(LOGO_BY_LOCALE[opts.locale ?? 'fr'] ?? logoFr);
  } catch {
    logoImg = null;
  }

  // === Géométrie du panneau verdict (la hauteur dépend du nb de lignes du message) ===
  const cx = W / 2;
  const glassX = 70;
  const glassY = 300; // sous le post-it du haut
  const glassW = W - 140;
  const glassR = 56;

  const radius = 270;
  const ringWidth = 44;
  const cy = glassY + 422; // centre de la jauge (le demi-cercle monte au-dessus)
  const titleY = cy + 126;
  const msgLineH = 52;

  ctx.save();
  ctx.font = 'italic 600 38px Nunito, sans-serif';
  const msgLines = wrapText(ctx, `« ${opts.verdictMessage} »`, glassW - 110);
  ctx.restore();
  const glassH = titleY - glassY + 56 + (msgLines.length - 1) * msgLineH + 60;

  // étoile cartoon à 4 branches (particules)
  const drawSparkle = (sx: number, sy: number, size: number, fill: string) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4 - Math.PI / 2;
      const r = k % 2 === 0 ? size : size * 0.28;
      ctx[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  // === Décor plein cadre : rayons en éventail centrés sur la jauge, demi-teintes BD, confettis ===
  ctx.save();
  ctx.translate(cx, cy);
  const burst = 24;
  for (let i = 0; i < burst; i++) {
    const a0 = (i / burst) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / burst / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.065)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 2400, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // particules étoiles dans les marges (en-tête + bords), jamais sur le contenu
  const stars: [number, number, number, string][] = [
    [120, 140, 38, 'rgba(255,255,255,0.9)'],
    [230, 215, 20, '#ffc700'],
    [70, 240, 14, 'rgba(255,255,255,0.7)'],
    [300, 120, 14, opts.color],
    [365, 205, 11, 'rgba(255,255,255,0.8)'],
    [W - 45, 285, 12, opts.color],
    [38, glassY + 560, 14, 'rgba(255,255,255,0.8)'],
    [W - 36, glassY + 660, 18, '#ffc700'],
    [40, glassY + glassH + 30, 16, opts.color],
    [W - 40, glassY + glassH + 24, 13, 'rgba(255,255,255,0.8)'],
  ];
  stars.forEach(([sx, sy, size, fill]) => drawSparkle(sx, sy, size, fill));

  // ombre dure façon sticker (décalée, marine) + ombre douce
  ctx.save();
  ctx.fillStyle = 'rgba(8,32,60,0.45)';
  roundRectPath(ctx, glassX + 4, glassY + 14, glassW, glassH, glassR);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, glassX, glassY, glassW, glassH, glassR);
  ctx.clip();

  // base marine translucide : donne du contraste aux textes blancs
  const base = ctx.createLinearGradient(glassX, glassY, glassX, glassY + glassH);
  base.addColorStop(0, 'rgba(14,52,96,0.62)');
  base.addColorStop(1, 'rgba(10,40,78,0.5)');
  ctx.fillStyle = base;
  ctx.fillRect(glassX, glassY, glassW, glassH);

  // lueur à la couleur du palier derrière la jauge
  const aura = ctx.createRadialGradient(cx, cy, 20, cx, cy, 520);
  aura.addColorStop(0, opts.color + '66');
  aura.addColorStop(0.55, opts.color + '1f');
  aura.addColorStop(1, opts.color + '00');
  ctx.fillStyle = aura;
  ctx.fillRect(glassX, glassY, glassW, glassH);

  // rayons de lumière qui partent du centre de la jauge
  ctx.save();
  ctx.translate(cx, cy);
  const rays = 16;
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / rays / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.055)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 1100, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // reflet en haut du panneau
  const gloss = ctx.createLinearGradient(glassX, glassY, glassX, glassY + 220);
  gloss.addColorStop(0, 'rgba(255,255,255,0.22)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(glassX, glassY, glassW, 220);

  // étincelles cartoon autour de la jauge
  drawSparkle(glassX + 120, glassY + 190, 26, 'rgba(255,255,255,0.85)');
  drawSparkle(glassX + glassW - 110, glassY + 250, 34, opts.color);
  drawSparkle(glassX + glassW - 190, glassY + 150, 16, 'rgba(255,255,255,0.7)');
  drawSparkle(glassX + 80, glassY + 330, 18, opts.color);
  ctx.restore();

  // contour marine extérieur + bordure épaisse blanche (sticker) + liseré intérieur
  ctx.save();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 8;
  roundRectPath(ctx, glassX, glassY, glassW, glassH, glassR);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 6;
  roundRectPath(ctx, glassX + 3, glassY + 3, glassW - 6, glassH - 6, glassR - 3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, glassX + 16, glassY + 16, glassW - 32, glassH - 32, glassR - 14);
  ctx.stroke();
  ctx.restore();

  // === Eyebrow "VOUS VOUS CONNAISSEZ À" en pastille ===
  ctx.save();
  ctx.font = '600 30px Fredoka, Nunito, sans-serif';
  const eyeSpacing = 6;
  const eyeLetters = opts.texts.eyebrow.split('');
  const eyeTextW =
    eyeLetters.reduce((sum, l) => sum + ctx.measureText(l).width, 0) +
    eyeSpacing * (eyeLetters.length - 1);
  const pillW = eyeTextW + 72;
  const pillH = 62;
  const pillX = cx - pillW / 2;
  const pillY = glassY + 78 - pillH / 2 - 10;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  drawSpacedText(ctx, opts.texts.eyebrow, W / 2, glassY + 78, eyeSpacing);
  ctx.restore();

  // === Jauge demi-cercle + % ===
  const pctClamped = Math.max(0, Math.min(100, opts.pct));
  const gaugeStart = Math.PI;
  const angleAt = (pct: number) => gaugeStart + (pct / 100) * Math.PI;

  // piste : un segment par palier (couleur du palier, atténuée) pour qu'on
  // lise d'un coup d'œil où se situe le score dans l'échelle
  const bounds = [0, 20, 40, 60, 80, 100];

  // contour marine épais autour de la piste (look sticker)
  ctx.save();
  ctx.strokeStyle = 'rgba(8,32,60,0.55)';
  ctx.lineWidth = ringWidth + 18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, gaugeStart, gaugeStart + Math.PI);
  ctx.stroke();
  ctx.restore();
  const segGap = 0.014;
  ctx.save();
  ctx.lineWidth = ringWidth;
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 0.32;
  for (let i = 0; i < bounds.length - 1; i++) {
    const a0 = angleAt(bounds[i]) + (i === 0 ? 0 : segGap);
    const a1 = angleAt(bounds[i + 1]) - (i === bounds.length - 2 ? 0 : segGap);
    ctx.strokeStyle = TIERS[i].color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, a0, a1);
    ctx.stroke();
  }
  ctx.restore();

  if (pctClamped > 0) {
    const endAngle = angleAt(pctClamped);

    // glow externe (calque large flou couleur)
    ctx.save();
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = ringWidth;
    ctx.lineCap = 'round';
    ctx.shadowColor = opts.color;
    ctx.shadowBlur = 40;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, gaugeStart, endAngle);
    ctx.stroke();
    ctx.restore();

    // arc plein
    ctx.save();
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = ringWidth;
    ctx.lineCap = 'round';
    ctx.shadowColor = opts.color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, gaugeStart, endAngle);
    ctx.stroke();
    ctx.restore();

    // reflet brillant sur le bord extérieur de l'arc
    if (endAngle - gaugeStart > 0.2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = ringWidth * 0.16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, radius + ringWidth * 0.26, gaugeStart + 0.06, endAngle - 0.06);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Texte % dans la cuvette de la jauge (contour marine + ombre dure, façon sticker)
  const pctY = cy - 52;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = 'bold 200px Fredoka, Nunito, sans-serif';
  const pctText = `${pctClamped}`;
  const pctW = ctx.measureText(pctText).width;
  const pctX = cx - 26;
  const pctSignX = pctX + pctW / 2 + 16;
  const strokeNavy = '#0f3556';

  // ombre dure
  ctx.fillStyle = 'rgba(8,32,60,0.55)';
  ctx.fillText(pctText, pctX, pctY + 10);
  ctx.font = 'bold 100px Fredoka, Nunito, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('%', pctSignX, pctY + 20);

  // contour
  ctx.strokeStyle = strokeNavy;
  ctx.lineWidth = 16;
  ctx.strokeText('%', pctSignX, pctY + 10);
  ctx.font = 'bold 200px Fredoka, Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeText(pctText, pctX, pctY);

  // remplissage
  ctx.fillStyle = '#ffffff';
  ctx.fillText(pctText, pctX, pctY);
  ctx.font = 'bold 100px Fredoka, Nunito, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = opts.color;
  ctx.fillText('%', pctSignX, pctY + 10);
  ctx.restore();

  // === Titre verdict + emoji de tier ===
  const tierEmoji = opts.tierEmoji;
  const titleFont = 'bold 78px Fredoka, Nunito, sans-serif';
  const emojiSize = 78;
  const emojiFont = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif`;
  const gap = 22;

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = titleFont;
  const titleW = ctx.measureText(opts.verdictTitle).width;
  ctx.font = emojiFont;
  const emojiW = ctx.measureText(tierEmoji).width;
  const titleBlockW = titleW + gap + emojiW;
  const titleX = cx - titleBlockW / 2;
  const emojiX = titleX + titleW + gap;

  // Titre coloré, contour marine + ombre dure (même langage que le %)
  ctx.font = titleFont;
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(8,32,60,0.55)';
  ctx.fillText(opts.verdictTitle, titleX, titleY + 7);
  ctx.strokeStyle = '#0f3556';
  ctx.lineWidth = 14;
  ctx.strokeText(opts.verdictTitle, titleX, titleY);
  ctx.fillStyle = opts.color;
  ctx.fillText(opts.verdictTitle, titleX, titleY);

  // Emoji collé à droite, ombre plus douce pour ne pas l'assombrir
  ctx.font = emojiFont;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.fillText(tierEmoji, emojiX, titleY);
  ctx.restore();

  // Message verdict
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 600 38px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  msgLines.forEach((line, i) => {
    ctx.fillText(line, cx, titleY + 62 + i * msgLineH);
  });
  ctx.restore();

  // === Scores : grille adaptative (jeu coopératif, tout le monde a le même poids) ===
  // 1 colonne jusqu'à 6 joueurs, 2 colonnes au-delà ; la hauteur des lignes
  // s'ajuste à la place restante, et un "+N" prend le relais si ça déborde.
  const players = opts.topPlayers;
  if (players.length > 0) {
    const sectionY = glassY + glassH + 80;
    const listTop = sectionY + 38;
    const listBottom = H - 70;
    const avail = listBottom - listTop;

    ctx.save();
    ctx.font = 'bold 36px Fredoka, Nunito, sans-serif';
    const lblSpacing = 8;
    const lblLetters = opts.texts.rankingLabel.split('');
    const lblW =
      lblLetters.reduce((sum, l) => sum + ctx.measureText(l).width, 0) +
      lblSpacing * (lblLetters.length - 1);
    // traits arrondis de chaque côté du libellé
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + dir * (lblW / 2 + 36), sectionY - 13);
      ctx.lineTo(W / 2 + dir * (lblW / 2 + 36 + 150), sectionY - 13);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(8,32,60,0.6)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 4;
    drawSpacedText(ctx, opts.texts.rankingLabel, W / 2, sectionY, lblSpacing);
    ctx.restore();

    const cols = players.length > 6 ? 2 : 1;
    const gapY = cols === 1 ? 20 : 12;
    const colGap = 20;
    const maxCardH = cols === 1 ? 116 : 96;
    const minCardH = cols === 1 ? 54 : 46;
    const listW = W - 160;
    const cardW = (listW - (cols - 1) * colGap) / cols;

    const rowsFit = Math.max(1, Math.floor((avail + gapY) / (minCardH + gapY)));
    const capacity = rowsFit * cols;
    const overflow = players.length > capacity;
    const shown = overflow ? players.slice(0, capacity - 1) : players;
    const extra = players.length - shown.length;
    const cells = shown.length + (overflow ? 1 : 0);
    const rows = Math.ceil(cells / cols);
    const cardH = Math.min(maxCardH, (avail - (rows - 1) * gapY) / rows);

    // Pré-charge les avatars affichés en parallèle (DiceBear sert CORS *)
    const avatarImgs = await Promise.all(
      shown.map(p =>
        typeof p.avatarId === 'number'
          ? loadImage(getAvatarUrl(p.avatarId)).catch(() => null)
          : Promise.resolve(null)
      )
    );

    const cardR = Math.min(26, cardH * 0.22);
    const strokeW = cardH > 80 ? 4 : 3;
    const shadowOffsets = cardH > 80 ? [4, 8, 12] : [3, 6];
    const shadowAlphas = cardH > 80 ? [1, 0.22, 0.1] : [1, 0.22];
    const fontSize = Math.max(24, Math.round(cardH * 0.42));
    const cellPos = (i: number) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // dernière carte seule sur sa ligne : on la centre plutôt que de la laisser orpheline à gauche
      const orphan = cols === 2 && i === cells - 1 && cells % 2 === 1;
      return {
        x: orphan ? 80 + (listW - cardW) / 2 : 80 + col * (cardW + colGap),
        y: listTop + row * (cardH + gapY),
      };
    };

    shown.forEach((p, i) => {
      const { x, y } = cellPos(i);
      drawStackShadow(ctx, x, y, cardW, cardH, cardR, shadowOffsets, shadowAlphas);
      const cardFill = ctx.createLinearGradient(x, y, x, y + cardH);
      cardFill.addColorStop(0, '#ffffff');
      cardFill.addColorStop(1, '#e3f3fd');
      drawCard(ctx, x, y, cardW, cardH, cardR, cardFill, '#000000', strokeW);

      const midY = y + cardH / 2;

      // rang : pastille jaune Onskoné, chiffre noir
      const rankR = cardH * 0.2;
      const rankX = x + cardH * 0.45;
      ctx.save();
      ctx.fillStyle = '#ffc700';
      ctx.beginPath();
      ctx.arc(rankX, midY, rankR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = strokeW - 1;
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${Math.round(cardH * 0.26)}px Fredoka, Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, rankX, midY + 1);
      ctx.restore();

      // avatar dans un disque à bord noir
      const avatarR = cardH * 0.36;
      const avatarX = x + cardH * 0.9 + avatarR;
      const avatarImg = avatarImgs[i];
      ctx.save();
      ctx.fillStyle = '#e8f6fd';
      ctx.beginPath();
      ctx.arc(avatarX, midY, avatarR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (avatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, midY, avatarR - 1, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatarImg, avatarX - avatarR, midY - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = '#1f5d90';
        ctx.font = `bold ${Math.round(avatarR)}px Fredoka, Nunito, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.name.charAt(0).toUpperCase(), avatarX, midY + 2);
        ctx.restore();
      }
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = strokeW - 1;
      ctx.beginPath();
      ctx.arc(avatarX, midY, avatarR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // score : pastille marine à droite
      const scoreText = `${p.score} pt${p.score > 1 ? 's' : ''}`;
      const scoreFont = Math.round(fontSize * 0.88);
      const pillPadX = cardH * 0.22;
      const pillH = cardH * 0.58;
      const pillRight = x + cardW - cardH * 0.22;
      ctx.save();
      ctx.font = `bold ${scoreFont}px Fredoka, Nunito, sans-serif`;
      const scoreW = ctx.measureText(scoreText).width;
      const pillW = scoreW + pillPadX * 2;
      ctx.fillStyle = '#0f3556';
      roundRectPath(ctx, pillRight - pillW, midY - pillH / 2, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(scoreText, pillRight - pillPadX, midY + 2);
      ctx.restore();

      // nom : on réduit la police avant de tronquer
      const nameX = avatarX + avatarR + cardH * 0.28;
      const nameMaxW = pillRight - pillW - cardH * 0.2 - nameX;
      ctx.save();
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      let nameSize = fontSize;
      let name = p.name;
      ctx.font = `bold ${nameSize}px Fredoka, Nunito, sans-serif`;
      while (ctx.measureText(name).width > nameMaxW && nameSize > Math.round(fontSize * 0.65)) {
        nameSize -= 2;
        ctx.font = `bold ${nameSize}px Fredoka, Nunito, sans-serif`;
      }
      for (let cut = name.length; ctx.measureText(name).width > nameMaxW && cut > 2; ) {
        cut--;
        name = truncate(p.name, cut);
      }
      ctx.fillText(name, nameX, midY + 2);
      ctx.restore();
    });

    // "+N" : les joueurs qui ne tiennent pas
    if (overflow) {
      const { x, y } = cellPos(shown.length);
      drawCard(ctx, x, y, cardW, cardH, cardR, 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.6)', 3);
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px Fredoka, Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 8;
      ctx.fillText(`+${extra}`, x + cardW / 2, y + cardH / 2 + 2);
      ctx.restore();
    }
  }

  // === Post-it du haut à droite : "Télécharge l'appli" + logo, penché ===
  ctx.save();
  const ctaW = 420;
  const ctaH = 186;
  const ctaR = 26;
  ctx.translate(W - 70 - ctaW / 2, 115 + ctaH / 2);
  ctx.rotate(4 * Math.PI / 180);
  const ctaX = -ctaW / 2;
  const ctaY = -ctaH / 2;

  drawStackShadow(ctx, ctaX, ctaY, ctaW, ctaH, ctaR, [4, 8], [1, 0.25]);
  drawCard(ctx, ctaX, ctaY, ctaW, ctaH, ctaR, '#fdf6e3', '#111827', 4);

  // scotch jaune en haut
  ctx.save();
  const tapeW = 140;
  const tapeH = 40;
  ctx.translate(0, ctaY);
  ctx.rotate(2 * Math.PI / 180);
  ctx.fillStyle = 'rgba(255, 199, 0, 0.8)';
  ctx.fillRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  for (let i = -tapeW / 2 + 12; i < tapeW / 2; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, -tapeH / 2);
    ctx.lineTo(i, tapeH / 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 36px Fredoka, Nunito, sans-serif';
  ctx.fillText(opts.texts.ctaLine1, 0, ctaY + 62);

  if (logoImg) {
    const lw = 310;
    const lh = (logoImg.height / logoImg.width) * lw;
    ctx.drawImage(logoImg, -lw / 2, ctaY + 80, lw, lh);
  } else {
    ctx.fillStyle = '#1f5d90';
    ctx.font = 'bold 64px Fredoka, Nunito, sans-serif';
    ctx.fillText('Onskoné !', 0, ctaY + 160);
  }
  ctx.restore();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob returned null'));
      },
      'image/png',
      0.95
    );
  });
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Partage un blob déjà construit. DOIT être appelé synchronement depuis un
 * user gesture (onClick) - pas de await avant l'appel, sinon les navigateurs
 * refusent share() et clipboard.write().
 */
export async function shareBlob(blob: Blob, text: string): Promise<ShareResult> {
  const file = new File([blob], 'onskone.png', { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[]; title?: string; text?: string }) => boolean;
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Onskoné', text });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }

  try {
    const clip = (navigator as Navigator & {
      clipboard?: { write?: (items: ClipboardItem[]) => Promise<void> };
    }).clipboard;
    if (clip?.write && typeof ClipboardItem !== 'undefined') {
      await clip.write([new ClipboardItem({ 'image/png': blob })]);
      return 'copied';
    }
  } catch (err) {
    console.warn('clipboard.write failed', err);
  }

  if (nav.share) {
    try {
      await nav.share({ title: 'Onskoné', text });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }

  return 'failed';
}
