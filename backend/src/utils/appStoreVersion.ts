// Version publiée sur l'App Store, via l'API publique d'Apple (la même que le plugin
// app-update interroge sur les iPhone). AFFICHAGE ADMIN UNIQUEMENT : la décision de
// blocage se fait sur chaque appareil (cf. frontend/src/utils/versionGate.ts).
// Pas d'équivalent Play Store : Google n'expose pas de version publique sans compte
// de service (API Play Developer).

const BUNDLE_ID = 'com.onskone.app';
const LOOKUP_URL = `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}`;
const TIMEOUT_MS = 5000;
// Succès gardé 10 min (une sortie se voit vite), échec 1 min (Apple injoignable).
const CACHE_OK_MS = 10 * 60 * 1000;
const CACHE_FAIL_MS = 60 * 1000;

export interface AppStoreVersion {
  version: string;
  /** ISO 8601, date de sortie de cette version sur l'App Store. */
  releasedAt: string;
  minimumOsVersion: string;
}

// Réponse brute du lookup -> version, ou null si l'app n'y figure pas / format inattendu.
export const parseAppStoreLookup = (json: unknown): AppStoreVersion | null => {
  const result = (json as { results?: unknown[] } | null)?.results?.[0] as Record<string, unknown> | undefined;
  const version = result?.version;
  const releasedAt = result?.currentVersionReleaseDate;
  const minimumOsVersion = result?.minimumOsVersion;
  if (typeof version !== 'string' || typeof releasedAt !== 'string' || typeof minimumOsVersion !== 'string') {
    return null;
  }
  return { version, releasedAt, minimumOsVersion };
};

let cache: { at: number; value: AppStoreVersion | null } | null = null;

// null = inconnue (Apple injoignable, app absente du store...) : l'admin affiche "?".
export const getAppStoreVersion = async (): Promise<AppStoreVersion | null> => {
  if (cache && Date.now() - cache.at < (cache.value ? CACHE_OK_MS : CACHE_FAIL_MS)) {
    return cache.value;
  }
  let value: AppStoreVersion | null = null;
  try {
    // `date` contourne le cache CDN d'Apple (même astuce que le plugin natif).
    const res = await fetch(`${LOOKUP_URL}&date=${Date.now()}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) value = parseAppStoreLookup(await res.json());
  } catch {
    value = null;
  }
  cache = { at: Date.now(), value };
  return value;
};
