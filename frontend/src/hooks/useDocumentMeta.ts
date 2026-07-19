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

    // Canonical résolu avant la boucle (chemin relatif -> URL absolue).
    const canonicalHref = canonicalPath !== undefined ? SITE_ORIGIN + canonicalPath : undefined;

    // Balises pilotées : élément cible + attribut + valeur souhaitée. On ne
    // pilote que celles dont la valeur est fournie (les autres restent intactes).
    const targets: Array<{ el: Element; attr: string; value: string }> = [];
    if (description !== undefined) targets.push({ el: ensureMeta('description'), attr: 'content', value: description });
    if (canonicalHref !== undefined) targets.push({ el: ensureCanonical(), attr: 'href', value: canonicalHref });
    if (robots !== undefined) targets.push({ el: ensureMeta('robots'), attr: 'content', value: robots });

    // Sauvegarde de l'ancienne valeur, puis application de la nouvelle.
    const restores = targets.map(({ el, attr, value }) => {
      const prev = el.getAttribute(attr);
      el.setAttribute(attr, value);
      return { el, attr, prev };
    });

    return () => {
      document.title = prevTitle;
      restores.forEach(({ el, attr, prev }) => {
        if (prev !== null) el.setAttribute(attr, prev);
      });
    };
  }, [title, description, canonicalPath, robots]);
}

export default useDocumentMeta;
