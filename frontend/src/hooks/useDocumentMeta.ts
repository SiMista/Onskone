import { useEffect } from 'react';

// Origine canonique du site (sans slash final). Utilisée pour construire l'URL
// absolue de <link rel="canonical"> à partir d'un chemin relatif.
const SITE_ORIGIN = 'https://onskone.fr';

export interface DocumentMetaOptions {
  /** <title> de la page. */
  title: string;
  /** Contenu de <meta name="description">. Laisser vide pour ne pas y toucher. */
  description?: string;
  /** Chemin (ex: '/', '/privacy') -> href = SITE_ORIGIN + canonicalPath. */
  canonicalPath?: string;
  /** Contenu de <meta name="robots"> (ex: 'noindex, nofollow'). */
  robots?: string;
}

/** Retourne le <meta name={name}> existant, ou le crée dans <head>. */
function ensureMeta(name: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  return el;
}

/** Retourne le <link rel="canonical"> existant, ou le crée dans <head>. */
function ensureCanonical(): HTMLLinkElement {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Pose le titre, la description, le canonical et (optionnellement) la balise
 * robots pour la page courante, puis restaure les valeurs précédentes au
 * démontage. Même pattern que le document.title d'Admin/Studio, étendu aux
 * balises SEO : le SPA sert le même index.html partout, ce hook rend donc
 * chaque route auto-descriptive (Googlebot exécute le JS avant de lire le head).
 */
export function useDocumentMeta({ title, description, canonicalPath, robots }: DocumentMetaOptions): void {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const descEl = description !== undefined ? ensureMeta('description') : null;
    const prevDesc = descEl ? descEl.getAttribute('content') : null;
    if (descEl && description !== undefined) descEl.setAttribute('content', description);

    const canonicalEl = canonicalPath !== undefined ? ensureCanonical() : null;
    const prevCanonical = canonicalEl ? canonicalEl.getAttribute('href') : null;
    if (canonicalEl && canonicalPath !== undefined) canonicalEl.setAttribute('href', SITE_ORIGIN + canonicalPath);

    const robotsEl = robots !== undefined ? ensureMeta('robots') : null;
    const prevRobots = robotsEl ? robotsEl.getAttribute('content') : null;
    if (robotsEl && robots !== undefined) robotsEl.setAttribute('content', robots);

    return () => {
      document.title = prevTitle;
      if (descEl && prevDesc !== null) descEl.setAttribute('content', prevDesc);
      if (canonicalEl && prevCanonical !== null) canonicalEl.setAttribute('href', prevCanonical);
      if (robotsEl && prevRobots !== null) robotsEl.setAttribute('content', prevRobots);
    };
  }, [title, description, canonicalPath, robots]);
}

export default useDocumentMeta;
