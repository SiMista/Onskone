import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
// Clé de signature des tokens admin. PAS de valeur par défaut codée en dur : sans secret
// réel, l'auth admin est DÉSACTIVÉE (fail-closed) au lieu d'être signée par une constante
// publique (sinon les tokens seraient forgeables par quiconque lit le code source).
const TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || ADMIN_PASSWORD || '';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours

// En dessous, un mot de passe reste à portée d'un bruteforce lent et distribué, même bridé.
const MIN_ADMIN_PASSWORD_LENGTH = 16;

if (process.env.NODE_ENV === 'production') {
  if (ADMIN_PASSWORD && ADMIN_PASSWORD.length < MIN_ADMIN_PASSWORD_LENGTH) {
    logger.warn(`SECURITY: ADMIN_PASSWORD fait moins de ${MIN_ADMIN_PASSWORD_LENGTH} caractères. Prends une phrase de passe longue et unique.`);
  }
  if (!TOKEN_SECRET) {
    logger.warn('SECURITY: ni ADMIN_TOKEN_SECRET ni ADMIN_PASSWORD ne sont définis en production — auth admin DÉSACTIVÉE (fail-closed).');
  } else if (!process.env.ADMIN_TOKEN_SECRET) {
    logger.warn('SECURITY: ADMIN_TOKEN_SECRET non défini ; repli sur ADMIN_PASSWORD comme clé de signature. Définissez un ADMIN_TOKEN_SECRET dédié (haute entropie).');
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
  // Fail-closed : aucun token n'est valide sans secret de signature réel configuré.
  if (!TOKEN_SECRET) return false;
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

// Comparaison sur des empreintes de taille fixe : comparer les mots de passe bruts
// sortait plus vite quand la longueur différait (fuite de la longueur du mot de passe).
const digest = (s: string): Buffer => crypto.createHash('sha256').update(s, 'utf8').digest();

export function checkPassword(password: string): boolean {
  if (!ADMIN_PASSWORD) return false;
  return crypto.timingSafeEqual(digest(password), digest(ADMIN_PASSWORD));
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
