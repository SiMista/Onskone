/**
 * Extrait des emojis Fluent Flat réellement utilisés (src/ + themes.json)
 * dans src/generated/fluentEmoji.json. Embarqués dans le bundle et enregistrés
 * au boot (utils/iconPreload.ts) : plus de fetch Iconify => plus de décalage
 * de mise en page quand l'emoji arrive, et ça marche hors-ligne (mobile).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getIcons } from '@iconify/utils';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = 'fluent-emoji-flat';
const re = new RegExp(`${PREFIX}:([a-z0-9-]+)`, 'g');

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (p.includes('generated')) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|json)$/.test(p) ? [p] : [];
  });

const files = [...walk(join(root, 'src')), join(root, '../backend/src/data/themes.json')];
const names = new Set();
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(re)) names.add(m[1]);

const collection = JSON.parse(
  readFileSync(join(root, 'node_modules/@iconify-json/fluent-emoji-flat/icons.json'), 'utf8'),
);
const subset = getIcons(collection, [...names].sort());
const missing = [...names].filter((n) => !subset?.icons[n] && !subset?.aliases?.[n]);
if (!subset || missing.length) {
  console.error(`Emojis introuvables dans ${PREFIX} :`, missing);
  process.exit(1);
}

mkdirSync(join(root, 'src/generated'), { recursive: true });
writeFileSync(join(root, 'src/generated/fluentEmoji.json'), JSON.stringify(subset));
console.log(`fluentEmoji.json : ${names.size} emojis`);
