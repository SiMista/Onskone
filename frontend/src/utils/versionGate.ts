import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import socket from './socket';

// Détecte un refus de connexion "version trop vieille" émis par le backend
// (versionGate). Quand ça arrive, on coupe le retry infini et on bascule l'UI
// sur un écran bloquant "mets à jour pour continuer".

export interface VersionBlock {
  minVersion: string;
}

let blocked: VersionBlock | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// socket.io expose la `data` attachée à l'erreur côté serveur via err.data.
socket.on('connect_error', (err: Error & { data?: { code?: string; minVersion?: string } }) => {
  if (err?.data?.code !== 'VERSION_TOO_OLD') return;
  blocked = { minVersion: err.data.minVersion || '' };
  // Inutile de retenter tant que l'app n'est pas à jour : on arrête la boucle.
  socket.disconnect();
  emit();
});

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

// Hook : renvoie le blocage courant (ou null). Re-render quand l'état change.
export const useVersionBlock = (): VersionBlock | null =>
  useSyncExternalStore(subscribe, () => blocked, () => blocked);

// --- Liens magasins ---------------------------------------------------------
const ANDROID_APP_ID = 'com.onskone.app';
// App Store ID (Apple ID numérique de la fiche App Store Connect), préfixé "id".
const IOS_APP_ID = 'id6782334531';
const PLAY_WEB = `https://play.google.com/store/apps/details?id=${ANDROID_APP_ID}`;
const APP_STORE_WEB = `https://apps.apple.com/app/${IOS_APP_ID}`;

// Ouvre la mise à jour : store natif sur mobile, simple reload sur web (le web
// sert toujours le dernier build une fois rechargé).
export const openUpdate = (): void => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') {
    // market:// ouvre directement l'app Play Store ; fallback web si absente.
    window.location.href = `market://details?id=${ANDROID_APP_ID}`;
    setTimeout(() => { window.location.href = PLAY_WEB; }, 800);
    return;
  }
  if (platform === 'ios') {
    // itms-apps:// ouvre directement l'app App Store ; fallback web si absente.
    window.location.href = `itms-apps://apps.apple.com/app/${IOS_APP_ID}`;
    setTimeout(() => { window.location.href = APP_STORE_WEB; }, 800);
    return;
  }
  // Web : recharger force le navigateur à reprendre le dernier bundle déployé.
  window.location.reload();
};

export const isNativeUpdate = (): boolean => Capacitor.isNativePlatform();
