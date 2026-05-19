import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from '../db/database.js';
import { requireAdmin, checkPassword, issueToken } from './admin.js';
import { RateLimiter } from '../utils/rateLimiter.js';
import logger from '../utils/logger.js';

const router = Router();

const TICKET_TYPES = new Set(['question_report', 'bug', 'suggestion']);
const STATUSES = new Set(['new', 'in_progress', 'resolved', 'wont_fix']);
const MAX_MESSAGE = 2000;
const MAX_CONTEXT = 4000;
const MAX_PSEUDO = 50;
const MAX_LOBBY = 20;

// 5 tickets / 10 min par IP
const ticketLimiter = new RateLimiter({ windowMs: 10 * 60 * 1000, maxRequests: 5 });
// 10 essais login / 15 min par IP
const loginLimiter = new RateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 10 });

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
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

// --- PUBLIC ---

router.post('/tickets', (req: Request, res: Response) => {
  const ip = clientIp(req);
  if (!ticketLimiter.isAllowed(ip)) {
    res.status(429).json({ error: 'too_many_requests' });
    return;
  }

  const { type, message, context, pseudo, lobbyCode } = req.body ?? {};
  if (typeof type !== 'string' || !TICKET_TYPES.has(type)) {
    res.status(400).json({ error: 'invalid_type' });
    return;
  }
  const cleanMessage = clip(message, MAX_MESSAGE);
  if (!cleanMessage || cleanMessage.length < 3) {
    res.status(400).json({ error: 'invalid_message' });
    return;
  }

  const now = Date.now();
  const userAgent = clip(req.headers['user-agent'], 500);

  try {
    const stmt = db.prepare(`
      INSERT INTO tickets (type, status, message, context, pseudo, lobby_code, user_agent, ip_hash, created_at, updated_at)
      VALUES (?, 'new', ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      type,
      cleanMessage,
      clip(context, MAX_CONTEXT),
      clip(pseudo, MAX_PSEUDO),
      clip(lobbyCode, MAX_LOBBY),
      userAgent,
      hashIp(ip),
      now,
      now,
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    logger.error('Failed to insert ticket', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'internal_error' });
  }
});

// --- ADMIN AUTH ---

router.post('/admin/login', (req: Request, res: Response) => {
  const ip = clientIp(req);
  if (!loginLimiter.isAllowed(ip)) {
    res.status(429).json({ error: 'too_many_requests' });
    return;
  }
  const { password } = req.body ?? {};
  if (typeof password !== 'string' || !checkPassword(password)) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }
  res.json({ token: issueToken() });
});

router.get('/admin/me', requireAdmin, (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// --- ADMIN TICKETS ---

router.get('/admin/tickets', requireAdmin, (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const type = typeof req.query.type === 'string' ? req.query.type : '';

  let sql = 'SELECT * FROM tickets';
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status && STATUSES.has(status)) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (type && TICKET_TYPES.has(type)) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT 500';

  const rows = db.prepare(sql).all(...params);
  res.json({ tickets: rows });
});

router.patch('/admin/tickets/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  const { status } = req.body ?? {};
  if (typeof status !== 'string' || !STATUSES.has(status)) {
    res.status(400).json({ error: 'invalid_status' });
    return;
  }
  const result = db.prepare('UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, Date.now(), id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});

router.delete('/admin/tickets/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid_id' });
    return;
  }
  const result = db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});

export default router;
