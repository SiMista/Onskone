import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AdminTab } from './shared';

// URLs de l'admin, pour pouvoir s'envoyer un lien direct vers un écran :
//   /admin                         Accueil
//   /admin/<onglet>                ex. /admin/budget, /admin/access (Accès joueurs)
//   /admin/<onglet>/<sous-page>    ex. /admin/tickets/42, /admin/decks/qui-es-tu,
//                                  /admin/content/drawingIdeas, /admin/stats/questions
// Logique pure (parseAdminPath / adminPath) testée dans routes.test.ts.

export const ADMIN_ROOT = '/admin';

/** Segment d'URL de chaque onglet (lisible : « Accès joueurs » = access, pas « danger »). */
const TAB_SLUGS: Record<AdminTab, string> = {
  overview: '',
  tickets: 'tickets',
  lobbies: 'lobbies',
  stats: 'stats',
  budget: 'budget',
  decks: 'decks',
  content: 'content',
  logs: 'logs',
  danger: 'access',
};
const TAB_BY_SLUG = new Map(Object.entries(TAB_SLUGS).map(([tab, slug]) => [slug, tab as AdminTab]));

export interface AdminRoute {
  tab: AdminTab;
  /** Sous-page de l'onglet (ticket ouvert, thème, section…), décodée. */
  sub: string | null;
}

/** null = adresse inconnue sous /admin (à renvoyer vers l'accueil). */
export const parseAdminPath = (pathname: string): AdminRoute | null => {
  if (pathname !== ADMIN_ROOT && !pathname.startsWith(`${ADMIN_ROOT}/`)) return null;
  const [slug = '', rawSub, ...rest] = pathname.slice(ADMIN_ROOT.length).split('/').filter(Boolean);
  const tab = TAB_BY_SLUG.get(slug);
  if (!tab || rest.length > 0 || (tab === 'overview' && rawSub)) return null;
  let sub: string | null = null;
  if (rawSub) {
    try { sub = decodeURIComponent(rawSub); } catch { return null; }
  }
  return { tab, sub };
};

export const adminPath = (tab: AdminTab, sub?: string | null): string => {
  const slug = TAB_SLUGS[tab];
  if (!slug) return ADMIN_ROOT;
  return sub ? `${ADMIN_ROOT}/${slug}/${encodeURIComponent(sub)}` : `${ADMIN_ROOT}/${slug}`;
};

/** « QUI ES-TU ? » → « qui-es-tu » : identifiant d'URL lisible d'un thème. */
export const slugify = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

type GoOptions = { replace?: boolean };

/** Onglet + sous-page courants, et de quoi y aller (historique du navigateur : « Retour » marche). */
export const useAdminRoute = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const route = parseAdminPath(pathname);
  const go = useCallback((tab: AdminTab, sub?: string | null, opts?: GoOptions) => {
    navigate(adminPath(tab, sub), { replace: opts?.replace });
  }, [navigate]);
  return { route, go };
};
