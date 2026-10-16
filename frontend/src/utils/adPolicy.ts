// Règles d'affichage des pubs AdMob, isolées du SDK pour être testables (cf.
// adPolicy.test.ts). L'orchestration (consentement, chargement, affichage) vit dans
// ads.ts. Principe : JAMAIS de pub pendant une partie, seulement entre les parties
// (pub d'ouverture au lancement + interstitiel en quittant l'écran de fin), et rien
// du tout pour un premium. Dans le doute -> pas de pub.

// Mémoire locale des pubs (studioStorage), versionnée façon playerStats.ts.
export const AD_MEMORY_VERSION = 1;

export interface AdMemory {
  version: typeof AD_MEMORY_VERSION;
  /** Lancements à froid de l'app déjà comptés (0 = jamais lancée avec les pubs). */
  launches: number;
  /** Dernier passage de l'app en arrière-plan (ms epoch), null si inconnu. */
  lastSeenAt: number | null;
  /** Dernière pub plein écran affichée (ms epoch), null si aucune. */
  lastAdAt: number | null;
}

export const EMPTY_AD_MEMORY: AdMemory = {
  version: AD_MEMORY_VERSION,
  launches: 0,
  lastSeenAt: null,
  lastAdAt: null,
};

const timestampOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** Relit la mémoire stockée ; toute valeur illisible ou d'une autre version repart de zéro. */
export const parseAdMemory = (raw: string | null): AdMemory => {
  if (!raw) return EMPTY_AD_MEMORY;
  try {
    const parsed = JSON.parse(raw) as Partial<AdMemory> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== AD_MEMORY_VERSION) return EMPTY_AD_MEMORY;
    const launches = typeof parsed.launches === 'number' && parsed.launches >= 0 ? Math.floor(parsed.launches) : 0;
    return {
      version: AD_MEMORY_VERSION,
      launches,
      lastSeenAt: timestampOrNull(parsed.lastSeenAt),
      lastAdAt: timestampOrNull(parsed.lastAdAt),
    };
  } catch {
    return EMPTY_AD_MEMORY;
  }
};

// Sur Android l'OS tue souvent l'app en arrière-plan : revenir de WhatsApp (code du
// salon partagé) relance l'app à froid. Une app quittée il y a moins de 10 min, c'est
// un retour, pas une ouverture : pas de pub d'ouverture.
export const RETURN_WINDOW_MS = 10 * 60 * 1000;

// Google interdit d'enchaîner deux pubs plein écran ; 2 min d'écart minimum entre
// la pub d'ouverture et l'interstitiel de fin de partie (et inversement).
export const AD_MIN_GAP_MS = 2 * 60 * 1000;

export type LaunchAdSkipReason =
  | 'premium'
  | 'firstLaunch'
  | 'gameToResume'
  | 'returning'
  | 'recentAd';

export interface LaunchContext {
  now: number;
  /** Mémoire telle qu'elle était AVANT ce lancement. */
  memory: AdMemory;
  premium: boolean;
  /** Partie en cours mémorisée (app tuée en pleine partie) : la relance, c'est "pendant une partie". */
  hasGameToResume: boolean;
}

/** Pourquoi on NE montre PAS la pub d'ouverture à ce lancement, ou null si on peut. */
export const launchAdSkipReason = (ctx: LaunchContext): LaunchAdSkipReason | null => {
  if (ctx.premium) return 'premium';
  // 1er lancement après installation, y compris via un lien d'invitation : la
  // première impression d'un nouveau joueur reste sans pub. Ensuite, un lien
  // d'invitation n'exempte de rien (un salon en attente, c'est entre les parties).
  if (ctx.memory.launches === 0) return 'firstLaunch';
  if (ctx.hasGameToResume) return 'gameToResume';
  const { lastSeenAt, lastAdAt } = ctx.memory;
  if (lastSeenAt !== null && ctx.now - lastSeenAt < RETURN_WINDOW_MS) return 'returning';
  if (lastAdAt !== null && ctx.now - lastAdAt < AD_MIN_GAP_MS) return 'recentAd';
  return null;
};

/** L'interstitiel de fin de partie peut-il s'afficher maintenant ? */
export const canShowEndGameAd = (ctx: { now: number; premium: boolean; lastAdAt: number | null }): boolean =>
  !ctx.premium && (ctx.lastAdAt === null || ctx.now - ctx.lastAdAt >= AD_MIN_GAP_MS);
