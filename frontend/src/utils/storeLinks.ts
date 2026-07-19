import { Capacitor } from '@capacitor/core';

// Constantes et helpers de redirection vers les stores (App Store / Play Store).
// Source unique : utilisée par le version-gate ("Mise à jour requise") ET par la
// monétisation premium (paywall web + bannière de téléchargement).

export const ANDROID_APP_ID = 'com.onskone.app';
// App Store ID (Apple ID numérique de la fiche App Store Connect), préfixé "id".
export const IOS_APP_ID = 'id6782334531';

export const PLAY_WEB = `https://play.google.com/store/apps/details?id=${ANDROID_APP_ID}`;
export const APP_STORE_WEB = `https://apps.apple.com/app/${IOS_APP_ID}`;

// Schemes natifs qui ouvrent directement l'app store installée (fallback web après délai).
const PLAY_NATIVE = `market://details?id=${ANDROID_APP_ID}`;
const APP_STORE_NATIVE = `itms-apps://apps.apple.com/app/${IOS_APP_ID}`;

export type MobileOS = 'ios' | 'android' | 'other';

/**
 * Détecte l'OS mobile depuis le user-agent - à utiliser sur le WEB pour choisir
 * le bon store. ⚠️ Distinct de `Capacitor.getPlatform()` qui renvoie 'web' dans
 * un navigateur mobile : `getPlatform()` dit si on est en natif (achat possible),
 * `detectMobileOS()` dit vers quel store rediriger depuis le site.
 */
export const detectMobileOS = (): MobileOS => {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS 13+ se présente comme un Mac tactile.
  if (/Macintosh/i.test(ua) && 'ontouchend' in document) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
};

/**
 * Ouvre la fiche store. En natif, tente le scheme app (market:// / itms-apps://)
 * avec fallback web. Sur le web, redirige selon le user-agent ; sur desktop
 * ('other') on ne peut pas choisir → retourne 'other' pour que l'appelant
 * affiche les deux liens.
 */
export const openStore = (): MobileOS => {
  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    window.location.href = PLAY_NATIVE;
    setTimeout(() => { window.location.href = PLAY_WEB; }, 800);
    return 'android';
  }
  if (platform === 'ios') {
    window.location.href = APP_STORE_NATIVE;
    setTimeout(() => { window.location.href = APP_STORE_WEB; }, 800);
    return 'ios';
  }

  // Web : choisir le store selon l'appareil.
  const os = detectMobileOS();
  if (os === 'ios') window.open(APP_STORE_WEB, '_blank', 'noopener');
  else if (os === 'android') window.open(PLAY_WEB, '_blank', 'noopener');
  // 'other' (desktop) : l'appelant affiche les deux liens, on n'ouvre rien.
  return os;
};
