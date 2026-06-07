import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || ADMIN_PASSWORD || 'change-me-dev-only';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours

// Avertissement sécurité au boot (comme pour ALLOWED_ORIGINS) : sans secret ni mot de
// passe admin en production, les tokens admin retombent sur un secret par défaut connu
// et seraient donc forgeables.
if (process.env.NODE_ENV === 'production') {
  if (!process.env.ADMIN_TOKEN_SECRET && !ADMIN_PASSWORD) {
    logger.warn('SECURITY WARNING: ADMIN_TOKEN_SECRET and ADMIN_PASSWORD are unset in production. Admin tokens fall back to a known default secret and are forgeable!');
  } else if (!process.env.ADMIN_TOKEN_SECRET) {
    logger.warn('SECURITY WARNING: ADMIN_TOKEN_SECRET is unset in production; falling back to ADMIN_PASSWORD as the token secret. Set a dedicated ADMIN_TOKEN_SECRET.');
  }
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
}

export function issueToken(): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `admin.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [scope, expiresAtStr, signature] = parts;
  if (scope !== 'admin') return false;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = sign(`${scope}.${expiresAtStr}`);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function checkPassword(password: string): boolean {
  if (!ADMIN_PASSWORD) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}
