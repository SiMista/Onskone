import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Vitest tourne depuis le package frontend (import.meta.url n'est pas un file: sous jsdom).
const SRC = resolve(process.cwd(), 'src');
const PRELOAD = join(SRC, 'utils/imagePreload.ts');
const IMAGE_IMPORT = /from\s+['"](\.{1,2}\/[^'"]+\.(?:png|jpe?g|webp|gif|svg))['"]/g;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

/** Images importées par un fichier, en chemins absolus. */
const importedImages = (file: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(IMAGE_IMPORT)].map(m => resolve(dirname(file), m[1]));

describe('préchargement des images', () => {
  it("toute image importée par l'appli est préchargée (sinon elle apparaît en retard)", () => {
    const preloaded = new Set(importedImages(PRELOAD));
    // Outillage admin / studio exclu : pas sur le chemin des joueurs.
    const missing = walk(SRC)
      .filter(f => f !== PRELOAD && !/\.test\.tsx?$/.test(f) && !/[\\/]pages[\\/](admin|studio)[\\/]/.test(f))
      .flatMap(f => importedImages(f).filter(img => !preloaded.has(img)).map(img => `${relative(SRC, img)} (${relative(SRC, f)})`));
    expect(missing).toEqual([]);
  });

  it('le préchargement est branché au démarrage', () => {
    expect(readFileSync(join(SRC, 'index.tsx'), 'utf8')).toMatch(/import ['"]\.\/utils\/imagePreload['"]/);
  });
});
