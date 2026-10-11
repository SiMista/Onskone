import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateAvailability, AppUpdateResultCode } from '@capawesome/capacitor-app-update';
import socket, { announcedVersion } from './socket';
import { PLAY_NATIVE, APP_STORE_NATIVE, PLAY_WEB, APP_STORE_WEB } from './storeLinks';
import {
  webUpdateObtainable,
  androidUpdateObtainable,
  iosUpdateObtainable,
  createPolicyEvaluator,
  type VersionBlock,
} from './versionPolicy';
import { reportClientLog, describeError } from './clientLog';

// Maj forcée côté client. Règle (shared/src/version.ts) : bloqué SSI sous le plancher
// ET une version plus récente est réellement obtenable par CET appareil (son store,
// ou un rechargement sur le web). Personne n'est bloqué sans pouvoir se mettre à jour.
//   - Le serveur envoie la politique (`versionPolicy`) à chaque connexion, puis la
//     rediffuse quand le plancher change en admin (machine à états : versionPolicy.ts).
//   - Filet : un serveur qui refuse quand même le handshake (VERSION_TOO_OLD, ex.
//     backend antérieur à ce système) bascule aussi l'UI sur l'écran bloquant.

export type { VersionBlock };

let blocked: VersionBlock | null = null;
const listeners = new Set<() => void>();
const setBlocked = (next: VersionBlock | null) => {
  blocked = next;
  listeners.forEach((l) => l());
};

// socket.io expose la `data` attachée à l'erreur côté serveur via err.data.
socket.on('connect_error', (err: Error & { data?: { code?: string; minVersion?: string } }) => {
  if (err?.data?.code !== 'VERSION_TOO_OLD') return;
  // Inutile de retenter tant que l'app n'est pas à jour : on arrête la boucle.
  socket.disconnect();
  setBlocked({ minVersion: err.data.minVersion || '' });
});

// Web : version que donnerait un rechargement = /version.json réellement servi (sans
// cache). Illisible (hors ligne, build sans le fichier -> fallback SPA en HTML...) -> ''.
const fetchServedWebVersion = async (): Promise<string> => {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return '';
    const { version } = await res.json() as { version?: unknown };
    return typeof version === 'string' ? version : '';
  } catch {
    return '';
  }
};

// Une version plus récente est-elle obtenable ? Dans le doute (store injoignable,
// APK installé hors Play, services Google absents...) -> false : pas de blocage.
const isNewerVersionObtainable = async (currentVersion: string): Promise<boolean> => {
  const platform = Capacitor.getPlatform();
  if (platform !== 'android' && platform !== 'ios') {
    return webUpdateObtainable(currentVersion, await fetchServedWebVersion());
  }
  try {
    const info = await AppUpdate.getAppUpdateInfo();
    return platform === 'android' ? androidUpdateObtainable(info) : iosUpdateObtainable(info, navigator.userAgent);
  } catch (err) {
    reportClientLog('versionGate', 'Vérification du store impossible', describeError(err), 'warn');
    return false;
  }
};

const applyPolicy = createPolicyEvaluator({
  getCurrentVersion: announcedVersion,
  isNewerVersionObtainable,
  isBlocked: () => blocked !== null,
  setBlocked,
});

socket.on('versionPolicy', (policy) => { void applyPolicy(policy); });

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

// Hook : renvoie le blocage courant (ou null). Re-render quand l'état change.
export const useVersionBlock = (): VersionBlock | null =>
  useSyncExternalStore(subscribe, () => blocked, () => blocked);

// --- Liens magasins ---------------------------------------------------------
// Constantes et schemes centralisés dans ./storeLinks (partagés avec la
// monétisation premium). Ici on garde une logique propre au version-gate :
// sur web, on RECHARGE (pas de redirection store) car le web sert le dernier build.

// Ouvre la fiche du store (fallback web si l'app store est absente).
const openStorePage = (nativeUrl: string, webUrl: string): void => {
  window.location.href = nativeUrl;
  setTimeout(() => { window.location.href = webUrl; }, 800);
};

// Ouvre la mise à jour : store natif sur mobile, simple reload sur web (le web
// sert toujours le dernier build une fois rechargé).
export const openUpdate = async (): Promise<void> => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') {
    // Mise à jour "immédiate" Play Core (écran Google, sans quitter l'app) quand elle
    // est permise. Annulée par le joueur -> il peut re-cliquer ; échec -> fiche Play Store.
    try {
      const info = await AppUpdate.getAppUpdateInfo();
      if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE && info.immediateUpdateAllowed) {
        const { code } = await AppUpdate.performImmediateUpdate();
        if (code === AppUpdateResultCode.OK || code === AppUpdateResultCode.CANCELED) return;
      }
    } catch { /* repli sur la fiche Play Store */ }
    // market:// ouvre directement l'app Play Store ; fallback web si absente.
    openStorePage(PLAY_NATIVE, PLAY_WEB);
    return;
  }
  if (platform === 'ios') {
    // itms-apps:// ouvre directement l'app App Store ; fallback web si absente.
    openStorePage(APP_STORE_NATIVE, APP_STORE_WEB);
    return;
  }
  // Web : recharger force le navigateur à reprendre le dernier bundle déployé.
  window.location.reload();
};

export const isNativeUpdate = (): boolean => Capacitor.isNativePlatform();
