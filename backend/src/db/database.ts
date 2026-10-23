import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'onskone.db');

const db: Database.Database = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('question_report', 'bug', 'suggestion')),
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'resolved', 'wont_fix')),
    message TEXT NOT NULL,
    context TEXT,
    pseudo TEXT,
    lobby_code TEXT,
    user_agent TEXT,
    ip_hash TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);
  CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);

  -- Erreurs remontées par l'app (natif iOS/Android + web) : diagnostic à distance
  -- sans accès aux logs de l'appareil (pas de Mac pour l'inspecteur Safari).
  -- Volume borné par le rate-limit et une purge à l'insertion (cf clientLogs.ts).
  CREATE TABLE IF NOT EXISTS client_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL DEFAULT 'error' CHECK(level IN ('error', 'warn', 'info')),
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    context TEXT,
    platform TEXT,
    app_version TEXT,
    user_agent TEXT,
    ip_hash TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_client_logs_created_at ON client_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_client_logs_source ON client_logs(source);

  -- Config runtime modifiable depuis l'admin (ex: plancher de maj forcée).
  -- Survit aux restarts ET aux redéploiements git (le .db vit hors du repo).
  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Stats de popularité des decks : à chaque tirage, +1 "shown" (proposé au pilier) ;
  -- à chaque choix, +1 "picked". Taux de choix = picked / shown (un thème tiré plus
  -- souvent n'est pas pour autant plus apprécié). kind = 'theme' | 'question' ;
  -- theme/question sont stockés tels quels (par locale), question = '' pour un thème.
  CREATE TABLE IF NOT EXISTS deck_stats (
    kind TEXT NOT NULL CHECK(kind IN ('theme', 'question')),
    locale TEXT NOT NULL,
    category TEXT NOT NULL,
    theme TEXT NOT NULL,
    question TEXT NOT NULL DEFAULT '',
    shown INTEGER NOT NULL DEFAULT 0,
    picked INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (kind, locale, theme, question)
  );
`);

export default db;
