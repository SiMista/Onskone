import { describe, it, expect } from 'vitest';
import { adminPath, parseAdminPath, slugify } from './routes';

describe('routes admin', () => {
  it("lit l'onglet et la sous-page", () => {
    expect(parseAdminPath('/admin')).toEqual({ tab: 'overview', sub: null });
    expect(parseAdminPath('/admin/')).toEqual({ tab: 'overview', sub: null });
    expect(parseAdminPath('/admin/budget')).toEqual({ tab: 'budget', sub: null });
    expect(parseAdminPath('/admin/access')).toEqual({ tab: 'danger', sub: null });
    expect(parseAdminPath('/admin/tickets/42')).toEqual({ tab: 'tickets', sub: '42' });
    expect(parseAdminPath('/admin/content/drawingIdeas')).toEqual({ tab: 'content', sub: 'drawingIdeas' });
  });

  it('refuse les adresses inconnues', () => {
    expect(parseAdminPath('/admin/nope')).toBeNull();
    expect(parseAdminPath('/admin/danger')).toBeNull();
    expect(parseAdminPath('/admin/tickets/1/2')).toBeNull();
    expect(parseAdminPath('/admin/overview')).toBeNull();
    expect(parseAdminPath('/admin/tickets/%E0%A4%A')).toBeNull();
    expect(parseAdminPath('/adminx')).toBeNull();
  });

  it('aller-retour adminPath → parseAdminPath', () => {
    expect(adminPath('overview')).toBe('/admin');
    expect(adminPath('danger')).toBe('/admin/access');
    expect(parseAdminPath(adminPath('decks', 'qui-es-tu'))).toEqual({ tab: 'decks', sub: 'qui-es-tu' });
    expect(parseAdminPath(adminPath('decks', 'a/b ?'))).toEqual({ tab: 'decks', sub: 'a/b ?' });
  });

  it('slugify : lisible, sans accents ni ponctuation', () => {
    expect(slugify('QUI ES-TU ?')).toBe('qui-es-tu');
    expect(slugify('AMOUR & SÉDUCTION')).toBe('amour-et-seduction');
    expect(slugify('ÉMOTIONS & FEELINGS')).toBe('emotions-et-feelings');
  });
});
