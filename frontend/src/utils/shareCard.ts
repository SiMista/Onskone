import logoSloganImg from '../assets/logos/logo_slogan.png';
import bgImg from '../assets/images/interrogation_bg_transparent.png';

export interface ShareCardOptions {
  pct: number;
  verdictTitle: string;
  verdictMessage: string;
  color: string;
  topPlayers: { name: string; score: number }[];
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

export async function buildShareCard(opts: ShareCardOptions): Promise<Blob> {
  const W = 1080;
  const H = 1350;

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

  // Fond : gradient + pattern interrogation (même ambiance que le site)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1f5d90');
  bg.addColorStop(1, '#18bbed');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  try {
    const pattern = await loadImage(bgImg);
    const p = ctx.createPattern(pattern, 'repeat');
    if (p) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  } catch {
    /* ignore */
  }

  // Logo en haut
  try {
    const logo = await loadImage(logoSloganImg);
    const logoW = 420;
    const logoH = (logo.height / logo.width) * logoW;
    ctx.drawImage(logo, (W - logoW) / 2, 70, logoW, logoH);
  } catch {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px Fredoka, Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Onskoné', W / 2, 160);
  }

  // Anneau + pourcentage
  const cx = W / 2;
  const cy = 620;
  const radius = 230;
  const ringWidth = 36;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = ringWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const pctClamped = Math.max(0, Math.min(100, opts.pct));
  ctx.save();
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = ringWidth;
  ctx.lineCap = 'round';
  ctx.shadowColor = opts.color;
  ctx.shadowBlur = 30;
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

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 200px Fredoka, Nunito, sans-serif';
  ctx.fillText(`${pctClamped}`, cx - 25, cy);
  const pctMetrics = ctx.measureText(`${pctClamped}`);
  ctx.font = 'bold 100px Fredoka, Nunito, sans-serif';
  ctx.fillStyle = opts.color;
  ctx.textAlign = 'left';
  ctx.fillText('%', cx - 25 + pctMetrics.width / 2 + 20, cy + 8);

  // Verdict
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = opts.color;
  ctx.font = 'bold 72px Fredoka, Nunito, sans-serif';
  ctx.fillText(opts.verdictTitle, cx, cy + radius + 90);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 38px Nunito, sans-serif';
  const lines = wrapText(ctx, `« ${opts.verdictMessage} »`, W - 180);
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, cy + radius + 150 + i * 48);
  });

  // Podium top 3
  const podiumY = cy + radius + 260;
  const top = opts.topPlayers.slice(0, 3);
  if (top.length > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 28px Fredoka, Nunito, sans-serif';
    ctx.fillText('PODIUM', cx, podiumY);

    const medals = ['🥇', '🥈', '🥉'];
    const rowH = 78;
    top.forEach((p, i) => {
      const y = podiumY + 50 + i * rowH;
      // background row
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      const rowX = 140;
      const rowW = W - 280;
      ctx.beginPath();
      const r = 18;
      ctx.moveTo(rowX + r, y);
      ctx.arcTo(rowX + rowW, y, rowX + rowW, y + rowH - 10, r);
      ctx.arcTo(rowX + rowW, y + rowH - 10, rowX, y + rowH - 10, r);
      ctx.arcTo(rowX, y + rowH - 10, rowX, y, r);
      ctx.arcTo(rowX, y, rowX + rowW, y, r);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // medal
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '42px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(medals[i], rowX + 20, y + (rowH - 10) / 2);

      // name
      ctx.font = 'bold 40px Fredoka, Nunito, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(truncate(p.name, 18), rowX + 90, y + (rowH - 10) / 2);

      // score
      ctx.textAlign = 'right';
      ctx.font = 'bold 44px Fredoka, Nunito, sans-serif';
      ctx.fillStyle = opts.color;
      ctx.fillText(`${p.score} pt${p.score > 1 ? 's' : ''}`, rowX + rowW - 24, y + (rowH - 10) / 2);
    });
  }

  // Footer tag
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '26px Fredoka, Nunito, sans-serif';
  ctx.fillText('onskone — le jeu qui teste vos liens', cx, H - 50);

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
 * user gesture (onClick) — pas de await avant l'appel, sinon les navigateurs
 * refusent share() et clipboard.write().
 */
export async function shareBlob(blob: Blob, text: string): Promise<ShareResult> {
  const file = new File([blob], 'onskone.png', { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[]; title?: string; text?: string }) => boolean;
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };

  // 1) Web Share API avec fichier (iOS Safari, Android Chrome, Edge Windows)
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Onskoné', text });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }

  // 2) Presse-papier (desktop Chrome/Firefox/Safari modernes)
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

  // 3) Dernier recours : Web Share texte seul
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
