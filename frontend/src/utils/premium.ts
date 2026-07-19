import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { studioStorage } from './studioStorage';
import socket, { setAnnouncedPremium } from './socket';

// Statut premium de l'utilisateur (achat unique à vie "premium").
//
// Source de vérité = RevenueCat (SDK natif). Le backend n'a pas de compte user
// stable, donc on ne persiste PAS le premium côté serveur : le SDK expose
// customerInfo.entitlements, et on le relaie au backend au handshake socket pour
// le gating des thèmes premium ("l'host débloque pour la table").
//
// Le SDK ne fonctionne QU'EN NATIF (Capacitor). Sur web (PC + navigateur mobile),
// il n'y a pas d'achat : le paywall bascule en "va sur le store" (cf. PremiumModal).

// Identifiant de l'entitlement configuré côté RevenueCat.
const ENTITLEMENT_ID = 'premium';

// Clés API publiques RevenueCat, par plateforme (injectées au build via Vite).
const RC_APPLE_KEY = import.meta.env.VITE_RC_APPLE_KEY as string | undefined;
const RC_GOOGLE_KEY = import.meta.env.VITE_RC_GOOGLE_KEY as string | undefined;

// --- Cache local (optimisation d'affichage, JAMAIS la vérité) ----------------
// Versionné façon playerStats.ts. En web/Studio, sert aussi d'override de test.
const CACHE_KEY = 'onskone_premium';
const CACHE_VERSION = 1;

const readCache = (): boolean => {
  try {
    const raw = studioStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CACHE_VERSION) return false;
    return parsed.premium === true;
  } catch {
    return false;
  }
};

const writeCache = (premium: boolean): void => {
  try {
    studioStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, premium }));
  } catch {
    /* silent */
  }
};

// --- Store réactif (même pattern que versionGate.ts) -------------------------
let isPremium = readCache();
// Synchro immédiate du flag annoncé au handshake avec le cache : sinon le tout
// premier createLobby/joinLobby annoncerait premium=false même si l'appareil est
// déjà premium (cache/override Studio écrit avant l'ouverture du socket).
setAnnouncedPremium(isPremium);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const setPremium = (next: boolean): void => {
  if (next === isPremium) return;
  isPremium = next;
  writeCache(next);
  setAnnouncedPremium(next);
  // Réannoncer au backend : le handshake auth est réévalué à la reconnexion.
  try {
    socket.disconnect();
    socket.connect();
  } catch {
    /* silent */
  }
  emit();
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** Hook React : renvoie true si l'utilisateur est premium. Re-render au changement. */
export const usePremium = (): boolean =>
  useSyncExternalStore(subscribe, () => isPremium, () => isPremium);

/** Lecture synchrone hors composant (ex. buildSlotUrl). */
export const getIsPremium = (): boolean => isPremium;

/** true si l'achat in-app est possible (natif uniquement). Sinon → redirection store. */
export const canPurchase = (): boolean => Capacitor.isNativePlatform();

// --- Override de test (web / Studio) -----------------------------------------
// Permet de tester le déblocage sans vrai achat (pas de SDK sur web).
export const setPremiumOverride = (v: boolean): void => setPremium(v);

// --- SDK RevenueCat ----------------------------------------------------------
// Import dynamique : le module premium.ts reste chargeable même si le plugin
// n'est pas (encore) installé, et le web ne touche jamais au SDK natif.
//
// Contrat minimal du SDK qu'on utilise (évite un couplage de type dur au paquet,
// et laisse le build passer tant que le plugin n'est pas installé). Cf. doc
// RevenueCat Capacitor : https://www.revenuecat.com/docs/getting-started
interface RCCustomerInfo {
  entitlements: { active: Record<string, unknown> };
}
interface RCPackage { identifier: string }
interface RCPurchasesApi {
  configure(opts: { apiKey: string }): Promise<void>;
  getCustomerInfo(): Promise<{ customerInfo: RCCustomerInfo }>;
  getOfferings(): Promise<{ current?: { availablePackages?: RCPackage[] } }>;
  purchasePackage(opts: { aPackage: RCPackage }): Promise<{ customerInfo: RCCustomerInfo }>;
  restorePurchases(): Promise<{ customerInfo: RCCustomerInfo }>;
}
type PurchasesModule = { Purchases: RCPurchasesApi };

let purchasesPromise: Promise<PurchasesModule | null> | null = null;
const loadPurchases = (): Promise<PurchasesModule | null> => {
  if (!purchasesPromise) {
    // @vite-ignore + cast : le paquet est résolu au runtime natif uniquement.
    purchasesPromise = import(/* @vite-ignore */ '@revenuecat/purchases-capacitor')
      .then((m) => m as unknown as PurchasesModule)
      .catch(() => null);
  }
  return purchasesPromise;
};

const readEntitlement = (customerInfo: { entitlements: { active: Record<string, unknown> } }): boolean =>
  Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);

/** Configure le SDK et rafraîchit le statut. À appeler une fois au boot (App.tsx). */
export const initPremium = async (): Promise<void> => {
  // Web/Studio : pas de SDK. On garde le cache/override en place.
  if (!Capacitor.isNativePlatform()) {
    setAnnouncedPremium(isPremium);
    return;
  }
  const platform = Capacitor.getPlatform();
  const apiKey = platform === 'ios' ? RC_APPLE_KEY : RC_GOOGLE_KEY;
  if (!apiKey) return;

  const mod = await loadPurchases();
  if (!mod) return;
  try {
    await mod.Purchases.configure({ apiKey });
    await refreshPremiumStatus();
  } catch {
    /* silent : on garde le dernier statut connu (cache) */
  }
};

/** Relit le statut depuis le SDK et met à jour le store. */
export const refreshPremiumStatus = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return isPremium;
  const mod = await loadPurchases();
  if (!mod) return isPremium;
  try {
    const { customerInfo } = await mod.Purchases.getCustomerInfo();
    const active = readEntitlement(customerInfo);
    setPremium(active);
    return active;
  } catch {
    return isPremium;
  }
};

/**
 * Lance l'achat premium (feuille native Play/StoreKit). Ne DOIT être appelé
 * qu'en natif (cf. canPurchase). Renvoie true si l'utilisateur est premium après.
 */
export const purchasePremium = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  const mod = await loadPurchases();
  if (!mod) return false;
  try {
    const offerings = await mod.Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) return false;
    const { customerInfo } = await mod.Purchases.purchasePackage({ aPackage: pkg });
    const active = readEntitlement(customerInfo);
    setPremium(active);
    return active;
  } catch {
    // Achat annulé ou échoué : on ne change rien.
    return isPremium;
  }
};

/** Restaure les achats (obligatoire Apple). Renvoie le statut premium après. */
export const restorePurchases = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  const mod = await loadPurchases();
  if (!mod) return false;
  try {
    const { customerInfo } = await mod.Purchases.restorePurchases();
    const active = readEntitlement(customerInfo);
    setPremium(active);
    return active;
  } catch {
    return isPremium;
  }
};
