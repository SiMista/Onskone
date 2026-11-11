import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import '../utils/iconPreload';
import { Icon } from './Icon';

// Vitest tourne depuis le package frontend (import.meta.url n'est pas un file: sous jsdom).
const SRC = resolve(process.cwd(), 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

describe('<Icon> (wrapper Iconify)', () => {
  it('rend un emoji embarqué dès le premier rendu (sans attendre le montage)', () => {
    // renderToStaticMarkup ne lance aucun effet : sans `ssr`, Iconify rendrait une <span> vide.
    const html = renderToStaticMarkup(<Icon icon="fluent-emoji-flat:crown" />);
    expect(html).toMatch(/^<svg/);
  });

  it("aucun composant n'importe <Icon> directement depuis @iconify/react", () => {
    const offenders = walk(SRC)
      .filter(f => !/[\\/]components[\\/]Icon(\.test)?\.tsx$/.test(f))
      .filter(f => /import\s*\{[^}]*\bIcon\b[^}]*\}\s*from\s*['"]@iconify\/react['"]/.test(readFileSync(f, 'utf8')))
      .map(f => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
