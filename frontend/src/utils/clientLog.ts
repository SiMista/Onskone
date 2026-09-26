import { Capacitor } from '@capacitor/core';
import { SERVER_URL } from '../constants/game';

/**
 * Remonte une erreur de l'app vers le backend (`POST /api/client-logs`),
 * consultable dans l'admin (onglet « Logs »).
 *
 * Sert à diagnostiquer ce que l'appareil ne montre pas : sur un iPhone sans Mac,
 * la console de la WebView est inaccessible, donc un `console.error` est perdu.
 * Même code sur iOS, Android et web (c'est le JS de l'app qui envoie).
 *
 * Toujours best-effort : ne throw jamais, n'attend rien, et plafonne le nombre
 * d'envois par session pour ne pas spammer le serveur si une boucle d'erreurs part.
 */

export type ClientLogLevel = 'error' | 'warn' | 'info';

/** Plafond d'envois par session (le serveur limite aussi par IP). */
const MAX_LOGS_PER_SESSION = 20;
let sentCount = 0;

/** Sérialise une erreur quelconque (Error, erreur RevenueCat, string…) en objet lisible. */
export const describeError = (err: unknown): Record<string, unknown> => {
  if (err === null || err === undefined) return { error: String(err) };
  if (typeof err !== 'object') return { error: String(err) };
  const e = err as Record<string, unknown>;
  // Erreurs natives Capacitor : le détail RevenueCat (readableErrorCode,
  // underlyingErrorMessage, userCancelled) est rangé dans `data`, pas à la racine.
  const data = e.data && typeof e.data === 'object' ? (e.data as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  // Champs utiles des erreurs RevenueCat (code numérique + libellé) et des Error JS.
  for (const key of ['code', 'readableErrorCode', 'message', 'underlyingErrorMessage', 'userCancelled', 'name']) {
    const value = e[key] !== undefined ? e[key] : data[key];
    if (value !== undefined) out[key] = value;
  }
  if (Object.keys(out).length === 0) {
    try { out.raw = JSON.stringify(err).slice(0, 1000); } catch { out.raw = String(err); }
  }
  return out;
};

export const reportClientLog = (
  source: string,
  message: string,
  context?: Record<string, unknown>,
  level: ClientLogLevel = 'error',
): void => {
  if (sentCount >= MAX_LOGS_PER_SESSION) return;
  sentCount++;
  try {
    const base = SERVER_URL.replace(/\/$/, '');
    void fetch(`${base}/api/client-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // keepalive : l'envoi survit à une navigation ou une fermeture d'écran immédiate.
      keepalive: true,
      body: JSON.stringify({
        level,
        source,
        message,
        context,
        platform: Capacitor.getPlatform(),
        appVersion: __APP_VERSION__,
      }),
    }).catch(() => { /* best-effort */ });
  } catch {
    /* best-effort */
  }
};

/**
 * Capture globale des erreurs JS non gérées (exceptions et promesses rejetées).
 * À appeler une fois au boot. Filtre le bruit connu des navigateurs.
 */
let globalHandlersInstalled = false;
const NOISE = [/ResizeObserver loop/i, /^Script error\.?$/i];

export const installGlobalErrorLogging = (): void => {
  if (globalHandlersInstalled || typeof window === 'undefined') return;
  globalHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    const message = event.message || 'Erreur JS';
    if (NOISE.some((re) => re.test(message))) return;
    reportClientLog('window.error', message, {
      file: event.filename,
      line: event.lineno,
      col: event.colno,
      stack: event.error instanceof Error ? event.error.stack?.slice(0, 1500) : undefined,
      path: window.location.pathname,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : 'Promesse rejetée non gérée';
    if (NOISE.some((re) => re.test(message))) return;
    reportClientLog('window.unhandledrejection', message, {
      ...describeError(reason),
      stack: reason instanceof Error ? reason.stack?.slice(0, 1500) : undefined,
      path: window.location.pathname,
    });
  });
};
