import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from '../db/database.js';
import { requireAdmin } from './admin.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import logger from '../utils/logger.js';

/**
 * Logs d'erreurs remontés par l'app (natif iOS/Android + web).
 *
 * But : diagnostiquer à distance ce que l'appareil ne montre pas (ex. l'erreur
 * RevenueCat exacte d'un achat raté sur TestFlight, sans Mac ni inspecteur
 * Safari). Route publique (l'app n'est pas authentifiée), donc bornée :
 * rate-limit par IP, champs tronqués, et purge des plus anciens à l'insertion.
 * Lecture et purge réservées à l'admin.
 */
const router: Router = Router();

const LEVELS = new Set(['error', 'warn', 'info']);
const MAX_SOURCE = 60;
const MAX_MESSAGE = 1000;
const MAX_CONTEXT = 4000;
const MAX_PLATFORM = 20;
const MAX_VERSION = 40;
/** Nombre de logs conservés : au-delà, les plus anciens sont supprimés. */
const MAX_ROWS = 2000;

// 30 logs / 10 min par IP : assez pour un vrai diagnostic, trop peu pour remplir la base.
const logLimiter = new RateLimiter({ windowMs: 10 * 60 * 1000, maxRequests: 30 });

function clientIp(req: Request): string {
  // Cf tickets.ts : req.ip est résolu selon `trust proxy`, ne pas lire le header brut.
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Le contexte arrive en objet : on le re-sérialise (jamais d'objet brut en base). */
function clipContext(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    return json ? json.slice(0, MAX_CONTEXT) : null;
  } catch {
    return null;
  }
}

// --- PUBLIC ---

router.post('/client-logs', (req: Request, res: Response) => {
  const ip = clientIp(req);
  if (!logLimiter.isAllowed(ip)) {
    res.status(429).json({ error: 'too_many_requests' });
    return;
  }

  const { level, source, message, context, platform, appVersion } = req.body ?? {};
  const cleanSource = clip(source, MAX_SOURCE);
  const cleanMessage = clip(message, MAX_MESSAGE);
  if (!cleanSource || !cleanMessage) {
    res.status(400).json({ error: 'invalid_log' });
    return;
  }
  const cleanLevel = typeof level === 'string' && LEVELS.has(level) ? level : 'error';

  try {
    const result = db.prepare(`
      INSERT INTO client_logs (level, source, message, context, platform, app_version, user_agent, ip_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cleanLevel,
      cleanSource,
      cleanMessage,
      clipContext(context),
      clip(platform, MAX_PLATFORM),
      clip(appVersion, MAX_VERSION),
      clip(req.headers['user-agent'], 500),
      hashIp(ip),
      Date.now(),
    );
    // Purge des plus anciens : la table ne dépasse jamais MAX_ROWS lignes.
    db.prepare('DELETE FROM client_logs WHERE id <= ?').run(Number(result.lastInsertRowid) - MAX_ROWS);
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error('Failed to insert client log', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'internal_error' });
  }
});

// --- ADMIN ---

router.get('/admin/client-logs', requireAdmin, (req: Request, res: Response) => {
  const source = typeof req.query.source === 'string' ? req.query.source.slice(0, MAX_SOURCE) : '';
  const platform = typeof req.query.platform === 'string' ? req.query.platform.slice(0, MAX_PLATFORM) : '';

  let sql = 'SELECT * FROM client_logs';
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (source) {
    conditions.push('source = ?');
    params.push(source);
  }
  if (platform) {
    conditions.push('platform = ?');
    params.push(platform);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC, id DESC LIMIT 500';

  res.json({ logs: db.prepare(sql).all(...params) });
});

router.delete('/admin/client-logs', requireAdmin, (_req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM client_logs').run();
  res.json({ ok: true, deleted: result.changes });
});

export default router;
