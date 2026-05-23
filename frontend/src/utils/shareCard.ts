import logoSloganImg from '../assets/logos/logo_slogan.png';
import bgImg from '../assets/images/interrogation_bg_transparent.png';
import { getAvatarUrl } from '../constants/game';

export interface ShareCardOptions {
  pct: number;
  verdictTitle: string;
  verdictMessage: string;
  color: string;
  topPlayers: { name: string; score: number; avatarId?: number }[];
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

const getTierEmojis = (pct: number): string[] => {
  if (pct >= 85) return ['🤣', '😂'];
  if (pct >= 65) return ['😎', '🔥'];
  if (pct >= 40) return ['😅', '🙃'];
  if (pct >= 20) return ['😬', '👀'];
  return ['💀', '🫠'];
};

const drawEmojiSticker = (
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  size: number,
  rotationDeg: number
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.40)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
};

// Étoile 4 branches "sparkle" dessinée au canvas.
const drawSparkle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number = 1
) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.translate(x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.6;
  const long = size;
  const short = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(0, -long);
  ctx.quadraticCurveTo(short, -short, long, 0);
  ctx.quadraticCurveTo(short, short, 0, long);
  ctx.quadraticCurveTo(-short, short, -long, 0);
  ctx.quadraticCurveTo(-short, -short, 0, -long);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

// Trait de feutre semi-transparent (jaune surligneur).
const drawMarkerStroke = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  thickness: number,
  bend: number = 10,
  alpha: number = 0.55
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + bend;
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
  ctx.restore();
};

// Confetti : rectangle ou triangle coloré incliné.
const drawConfetti = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg: number,
  color: string,
  shape: 'rect' | 'triangle'
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.fillStyle = color;
  if (shape === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
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
    if ((document as any).fonts?.ready) {
      await (document as any).fonts.ready;
    }
  } catch {
    /* ignore */
  }

  // === Fond : gradient bleu du site ===
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1f5d90');
  bg.addColorStop(1, '#18bbed');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // === Pattern points d'interrogation bien visible ===
  try {
    const pattern = await loadImage(bgImg);
    const p = ctx.createPattern(pattern, 'repeat');
    if (p) {
      ctx.save();
      ctx.globalAlpha = 0.60;
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  } catch {
    /* ignore */
  }

  // Léger voile sombre en haut/bas pour aérer la composition
  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, 'rgba(20,50,90,0.25)');
  veil.addColorStop(0.5, 'rgba(20,50,90,0)');
  veil.addColorStop(1, 'rgba(10,40,70,0.35)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  // === Logo en haut à gauche, plus petit ===
  let logoBottomY = 180;
  try {
    const logo = await loadImage(logoSloganImg);
    const logoW = 280;
    const logoH = (logo.height / logo.width) * logoW;
    const logoX = 85;
    const logoY = 115;
    ctx.drawImage(logo, logoX, logoY, logoW, logoH);
    logoBottomY = logoY + logoH;
  } catch {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Fredoka, Nunito, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Onskoné', 60, 120);
  }

  // === Liquid glass panel central (verdict + ring) ===
  const glassX = 70;
  const glassY = logoBottomY + 60;
  const glassW = W - 140;
  const glassH = 975;
  const glassR = 56;

  // ombre douce sous le glass
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.001)';
  roundRectPath(ctx, glassX, glassY, glassW, glassH, glassR);
  ctx.fill();
  ctx.restore();

  // fond glass : blanc translucide + gradient de highlight
  ctx.save();
  roundRectPath(ctx, glassX, glassY, glassW, glassH, glassR);
  ctx.clip();

  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(glassX, glassY, glassW, glassH);

  const gloss = ctx.createLinearGradient(glassX, glassY, glassX, glassY + glassH);
  gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.05)');
  gloss.addColorStop(1, 'rgba(255,255,255,0.16)');
  ctx.fillStyle = gloss;
  ctx.fillRect(glassX, glassY, glassW, glassH);

  // highlight diagonal subtil
  const sheen = ctx.createLinearGradient(glassX, glassY, glassX + glassW, glassY + glassH);
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(glassX, glassY, glassW, glassH);
  ctx.restore();

  // bordure du glass
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, glassX + 1, glassY + 1, glassW - 2, glassH - 2, glassR - 1);
  ctx.stroke();
  // bord intérieur lumineux
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  roundRectPath(ctx, glassX + 5, glassY + 5, glassW - 10, glassH - 10, glassR - 4);
  ctx.stroke();
  ctx.restore();

  // === Eyebrow "VOUS VOUS CONNAISSEZ À" ===
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 30px Fredoka, Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const eyebrowY = glassY + 78;
  const eyebrow = 'VOUS VOUS CONNAISSEZ À';
  // letter-spacing manuel
  const letters = eyebrow.split('');
  const spacing = 6;
  const totalW = letters.reduce((s, l) => s + ctx.measureText(l).width, 0) + spacing * (letters.length - 1);
  let lx = W / 2 - totalW / 2;
  for (const l of letters) {
    ctx.fillText(l, lx + ctx.measureText(l).width / 2, eyebrowY);
    lx += ctx.measureText(l).width + spacing;
  }
  ctx.restore();

  // === Anneau + % ===
  const cx = W / 2;
  const cy = glassY + 410;
  const radius = 230;
  const ringWidth = 40;

  // anneau fond
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = ringWidth;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // glow externe (calque large flou couleur)
  const pctClamped = Math.max(0, Math.min(100, opts.pct));
  ctx.save();
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = ringWidth;
  ctx.lineCap = 'round';
  ctx.shadowColor = opts.color;
  ctx.shadowBlur = 40;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(
    cx,
    cy,
    radius,
    -Math.PI / 2,
    -Math.PI / 2 + (pctClamped / 100) * Math.PI * 2
  );
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
  ctx.arc(
    cx,
    cy,
    radius,
    -Math.PI / 2,
    -Math.PI / 2 + (pctClamped / 100) * Math.PI * 2
  );
  ctx.stroke();
  ctx.restore();

  // Texte %
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;
  ctx.font = 'bold 220px Fredoka, Nunito, sans-serif';
  const pctText = `${pctClamped}`;
  const pctW = ctx.measureText(pctText).width;
  ctx.fillText(pctText, cx - 30, cy);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = 'bold 110px Fredoka, Nunito, sans-serif';
  ctx.fillStyle = opts.color;
  ctx.textAlign = 'left';
  ctx.shadowColor = opts.color;
  ctx.shadowBlur = 18;
  ctx.fillText('%', cx - 30 + pctW / 2 + 18, cy + 10);
  ctx.restore();

  // === Sparkles 4 branches autour de l'anneau ===
  const sparkles: Array<{ a: number; r: number; s: number; alpha: number; color: string }> = [
    { a: -65, r: radius + 60, s: 26, alpha: 1, color: '#ffffff' },
    { a: -20, r: radius + 80, s: 18, alpha: 0.85, color: '#ffffff' },
    { a: 40, r: radius + 50, s: 22, alpha: 0.95, color: opts.color },
    { a: 110, r: radius + 70, s: 16, alpha: 0.7, color: '#ffffff' },
    { a: 175, r: radius + 55, s: 24, alpha: 0.9, color: '#ffffff' },
    { a: 230, r: radius + 90, s: 14, alpha: 0.65, color: opts.color },
  ];
  for (const sp of sparkles) {
    const rad = (sp.a * Math.PI) / 180;
    drawSparkle(ctx, cx + Math.cos(rad) * sp.r, cy + Math.sin(rad) * sp.r, sp.s, sp.color, sp.alpha);
  }

  // === Titre verdict ===
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = opts.color;
  ctx.font = 'bold 78px Fredoka, Nunito, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  const titleY = cy + radius + 130;
  ctx.fillText(opts.verdictTitle, cx, titleY);
  const titleWidth = ctx.measureText(opts.verdictTitle).width;
  ctx.restore();

  // Squiggle de surligneur jaune sous le titre verdict
  const sqHalf = Math.min(titleWidth / 2 + 30, glassW / 2 - 60);
  drawMarkerStroke(ctx, cx - sqHalf, titleY + 22, cx + sqHalf, titleY + 18, '#fbbf24', 14, -6, 0.6);
  drawMarkerStroke(ctx, cx - sqHalf * 0.7, titleY + 36, cx + sqHalf * 0.85, titleY + 32, '#fbbf24', 8, 4, 0.4);

  // Message verdict
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 600 38px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const lines = wrapText(ctx, `« ${opts.verdictMessage} »`, glassW - 110);
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, titleY + 80 + i * 52);
  });
  ctx.restore();

  // === Top 3 : cartes blanches style site ===
  const top = opts.topPlayers.slice(0, 3);

  // Pré-charge les avatars en parallèle (DiceBear sert CORS *)
  const avatarImgs = await Promise.all(
    top.map(p =>
      typeof p.avatarId === 'number'
        ? loadImage(getAvatarUrl(p.avatarId)).catch(() => null)
        : Promise.resolve(null)
    )
  );
  if (top.length > 0) {
    const sectionY = glassY + glassH + 90;

    // Label "TOP 3"
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Fredoka, Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    const labelText = 'TOP 3';
    const lblLetters = labelText.split('');
    const lblSpacing = 8;
    const lblTotal = lblLetters.reduce((s, l) => s + ctx.measureText(l).width, 0) + lblSpacing * (lblLetters.length - 1);
    let lx2 = W / 2 - lblTotal / 2;
    for (const l of lblLetters) {
      ctx.fillText(l, lx2 + ctx.measureText(l).width / 2, sectionY);
      lx2 += ctx.measureText(l).width + lblSpacing;
    }
    ctx.restore();

    const cardX = 80;
    const cardW = W - 160;
    const cardH = 120;
    const cardR = 26;
    const gap = 22;
    const firstCardY = sectionY + 40;

    const podiumColors = ['#FFC700', '#C0C0C0', '#CD7F32'];
    const podiumTextColors = ['#000000', '#1f2937', '#1f2937'];

    // === Confettis derrière le gagnant ===
    const confettiPalette = ['#1f5d90', '#18bbed', '#FFC700', '#fbbf24', '#22c55e', '#ef4444', '#a855f7'];
    const winnerCardY = firstCardY;
    const seedRand = (n: number) => {
      const x = Math.sin(n * 9301 + 49297) * 233280;
      return x - Math.floor(x);
    };
    for (let k = 0; k < 32; k++) {
      const rx = cardX + seedRand(k + 1) * cardW;
      const ry = winnerCardY - 30 + seedRand(k + 100) * (cardH + 60);
      const rw = 14 + seedRand(k + 200) * 18;
      const rh = 6 + seedRand(k + 300) * 10;
      const rot = seedRand(k + 400) * 360;
      const color = confettiPalette[Math.floor(seedRand(k + 500) * confettiPalette.length)];
      const shape: 'rect' | 'triangle' = seedRand(k + 600) > 0.5 ? 'rect' : 'triangle';
      ctx.save();
      ctx.globalAlpha = 0.85;
      drawConfetti(ctx, rx, ry, rw, rh, rot, color, shape);
      ctx.restore();
    }

    top.forEach((p, i) => {
      const y = firstCardY + i * (cardH + gap);

      // stack shadow (3 ombres décalées)
      drawStackShadow(ctx, cardX, y, cardW, cardH, cardR);

      // carte blanche
      ctx.save();
      ctx.fillStyle = '#ffffff';
      roundRectPath(ctx, cardX, y, cardW, cardH, cardR);
      ctx.fill();
      // bordure noire 2.5px style site
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      roundRectPath(ctx, cardX, y, cardW, cardH, cardR);
      ctx.stroke();
      ctx.restore();

      // badge rank : avatar entouré d'un ring couleur médaille
      const badgeSize = 88;
      const badgeX = cardX + 24 + badgeSize / 2;
      const badgeY = y + cardH / 2;
      const ringW = 6;
      const avatarImg = avatarImgs[i];

      ctx.save();
      // ring couleur médaille
      ctx.fillStyle = podiumColors[i];
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeSize / 2, 0, Math.PI * 2);
      ctx.fill();
      // bordure noire extérieure
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();

      // disque blanc intérieur (avatar bg ou fallback)
      const innerR = badgeSize / 2 - ringW;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, innerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (avatarImg) {
        // clip cercle pour l'avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, innerR - 1, 0, Math.PI * 2);
        ctx.clip();
        const size = (innerR - 1) * 2;
        ctx.drawImage(avatarImg, badgeX - innerR + 1, badgeY - innerR + 1, size, size);
        ctx.restore();
      } else {
        // Fallback : numéro de rang
        ctx.save();
        ctx.fillStyle = podiumTextColors[i];
        ctx.font = 'bold 50px Fredoka, Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, badgeX, badgeY + 3);
        ctx.restore();
      }

      // Petit numéro de rang en pastille couleur en bas-droite du badge
      const rankPX = badgeX + innerR * 0.78;
      const rankPY = badgeY + innerR * 0.78;
      const rankPR = 18;
      ctx.save();
      ctx.fillStyle = podiumColors[i];
      ctx.beginPath();
      ctx.arc(rankPX, rankPY, rankPR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = podiumTextColors[i];
      ctx.font = 'bold 22px Fredoka, Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, rankPX, rankPY + 1);
      ctx.restore();

      // nom
      ctx.save();
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 50px Fredoka, Nunito, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncate(p.name, 16), badgeX + badgeSize / 2 + 28, badgeY + 2);
      ctx.restore();

      // score (à droite)
      ctx.save();
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 52px Fredoka, Nunito, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${p.score} pt${p.score > 1 ? 's' : ''}`,
        cardX + cardW - 32,
        badgeY + 2
      );
      ctx.restore();
    });
  }

  // === Emojis stickers éparpillés (au-dessus du glass, sous le CTA) ===
  const tierEmojis = getTierEmojis(pctClamped);
  const isTopTier = pctClamped >= 65;
  const stickers: Array<{ e: string; x: number; y: number; size: number; rot: number }> = [
    // Verdict tier - 2 stickers bien visibles
    { e: tierEmojis[0], x: 110, y: glassY + 50, size: 110, rot: -14 },
    { e: tierEmojis[1], x: W - 110, y: glassY + glassH - 110, size: 100, rot: 12 },
    // Bulle de pensée, côté gauche du verdict
    { e: '💭', x: 95, y: glassY + 470, size: 78, rot: -10 },
    // Point d'interrogation / exclamation - raccord avec le pattern de fond
    { e: '❓', x: W - 95, y: glassY + 230, size: 72, rot: 14 },
    { e: '❗', x: 70, y: glassY + glassH - 180, size: 64, rot: -8 },
    // Confettis emoji autour du top 3 gagnant
    { e: '🎉', x: 70, y: glassY + glassH + 220, size: 90, rot: -18 },
    { e: '🎊', x: W - 70, y: glassY + glassH + 220, size: 90, rot: 18 },
  ];
  // Bonus top tier : encore plus festif
  if (isTopTier) {
    stickers.push({ e: '✨', x: W - 130, y: glassY + 60, size: 70, rot: 16 });
  }
  for (const st of stickers) {
    drawEmojiSticker(ctx, st.e, st.x, st.y, st.size, st.rot);
  }

  // === CTA impactant en haut à droite, penché et avec fond ===
  ctx.save();
  ctx.translate(W - 70, 185);
  ctx.rotate(6 * Math.PI / 180);

  // Dimensions du fond (sticker)
  const ctaW = 460;
  const ctaH = 150;
  const ctaR = 24;
  const ctaX = -ctaW;
  const ctaY = 0;

  // ombre empilée
  drawStackShadow(ctx, ctaX, ctaY, ctaW, ctaH, ctaR, [4, 8], [1, 0.25]);

  // fond crème façon papier
  ctx.fillStyle = '#fdf6e3';
  roundRectPath(ctx, ctaX, ctaY, ctaW, ctaH, ctaR);
  ctx.fill();
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  roundRectPath(ctx, ctaX, ctaY, ctaW, ctaH, ctaR);
  ctx.stroke();

  // scotch en haut (petite bande translucide jaune, légèrement inclinée)
  ctx.save();
  const tapeW = 150;
  const tapeH = 38;
  const tapeX = ctaX + ctaW / 2 - tapeW / 2;
  const tapeY = ctaY - tapeH / 2;
  ctx.translate(tapeX + tapeW / 2, tapeY + tapeH / 2);
  ctx.rotate(-4 * Math.PI / 180);
  ctx.fillStyle = 'rgba(255, 199, 0, 0.7)';
  ctx.fillRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
  // petites stries verticales pour effet scotch
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let i = -tapeW / 2 + 12; i < tapeW / 2; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, -tapeH / 2);
    ctx.lineTo(i, tapeH / 2);
    ctx.stroke();
  }
  ctx.restore();

  // texte
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 40px Fredoka, Nunito, sans-serif';
  ctx.fillText('Viens jouer sur', ctaX + ctaW / 2, ctaY + 60);
  ctx.fillStyle = '#1f5d90';
  ctx.font = 'bold 60px Fredoka, Nunito, sans-serif';
  ctx.fillText('onskone.fr !', ctaX + ctaW / 2, ctaY + 122);
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
