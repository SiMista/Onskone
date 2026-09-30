import { isStudioFrame } from './studioStorage';

// Plateforme native SIMULÉE d'un slot Studio (`?platform=ios|android`), pour
// tester le paywall natif (prix, achat, restauration) sans téléphone.
//
// Volontairement limitée au Premium (cf. premium.ts) : on ne simule PAS
// Capacitor en entier, sinon l'URL backend, le partage, les haptics… partiraient
// sur leurs branches natives et casseraient le slot.
//
// Capturée une fois au chargement du module, comme `studioSlot` : survit aux
// navigations SPA qui perdent le paramètre d'URL.
export type SimulatedPlatform = 'ios' | 'android';

const detect = (): SimulatedPlatform | null => {
  if (!isStudioFrame || typeof window === 'undefined') return null;
  try {
    const p = new URLSearchParams(window.location.search).get('platform');
    return p === 'ios' || p === 'android' ? p : null;
  } catch {
    return null;
  }
};

export const simulatedPlatform = detect();
