import db from './database.js';

// Petit magasin clé/valeur générique (table app_config). Persiste la config
// runtime posée depuis l'admin (ex: plancher de maj forcée).

const getStmt = db.prepare('SELECT value FROM app_config WHERE key = ?');
const setStmt = db.prepare(
  `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
);

export const getConfig = (key: string): string | null => {
  const row = getStmt.get(key) as { value: string } | undefined;
  return row ? row.value : null;
};

export const setConfig = (key: string, value: string): void => {
  setStmt.run(key, value, Date.now());
};
