import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

type KeepAwakeModule = typeof import('@capacitor-community/keep-awake');

// Import dynamique (comme ads.ts / premium.ts) : plugin natif absent du build web,
// et une panne du plugin ne doit jamais casser la partie.
let nativeModule: Promise<KeepAwakeModule | null> | null = null;
const loadNative = (): Promise<KeepAwakeModule | null> => {
  if (!nativeModule) {
    nativeModule = import('@capacitor-community/keep-awake').catch(() => null);
  }
  return nativeModule;
};

/**
 * Empêche l'écran de se mettre en veille tant que le composant est monté (façon appli GPS) :
 * en partie on attend le pilier ou on montre l'écran aux autres, sans toucher l'appareil
 * pendant des dizaines de secondes. Veille normale rétablie au démontage.
 *  - natif : plugin Capacitor KeepAwake ;
 *  - web : Screen Wake Lock API (relâché par le navigateur quand l'onglet passe en
 *    arrière-plan, donc ré-acquis au retour). Silencieux si non supporté.
 */
export function useKeepAwake(): void {
  useEffect(() => {
    let cancelled = false;

    if (Capacitor.isNativePlatform()) {
      void loadNative().then((mod) => {
        if (cancelled || !mod) return;
        void mod.KeepAwake.keepAwake().catch(() => {});
      });
      return () => {
        cancelled = true;
        void loadNative().then((mod) => mod?.KeepAwake.allowSleep().catch(() => {}));
      };
    }

    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || sentinel) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // Refusé (économie d'énergie, permission) : on joue sans.
      }
    };
    const onVisible = () => { void acquire(); };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, []);
}
