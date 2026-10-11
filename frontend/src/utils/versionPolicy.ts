import { AppUpdateAvailability, type AppUpdateInfo } from '@capawesome/capacitor-app-update';
import { isOlderVersion, shouldBlockForUpdate, type VersionPolicy } from '@onskone/shared';

// "Une version plus récente est-elle RÉELLEMENT obtenable par cet appareil ?" :
// 2e moitié de la règle de maj forcée (shouldBlockForUpdate, cf. shared/src/version.ts).
// Fonctions pures (testées dans versionPolicy.test.ts). Dans le doute -> false :
// on préfère ne pas bloquer que bloquer quelqu'un sans issue.

// Web : `servedVersion` = /version.json réellement servi, donc ce qu'un rechargement
// donnerait. '' (illisible) -> jamais "plus récente".
export const webUpdateObtainable = (currentVersion: string, servedVersion: string): boolean =>
  isOlderVersion(currentVersion, servedVersion);

// Android : verdict de Play Core, qui tient déjà compte du rollout progressif, du pays
// et de la compatibilité de l'appareil. Versions comparées en versionCode (entiers).
export const androidUpdateObtainable = (info: AppUpdateInfo): boolean =>
  info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
  && Number(info.availableVersionCode) > Number(info.currentVersionCode);

// "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) ..." -> "17.4.1". null si
// introuvable (ex. iPad en UA "desktop" Macintosh) : OS inconnu -> on ne bloque pas.
// Depuis iOS 26 l'UA est figé (18_6) : on sous-estime l'OS, ce qui ne peut que
// faire renoncer à un blocage, jamais en créer un à tort.
export const parseIosVersion = (userAgent: string): string | null => {
  const m = /\bOS (\d+)[_.](\d+)(?:[_.](\d+))? like Mac OS X/.exec(userAgent);
  return m ? `${m[1]}.${m[2]}.${m[3] ?? '0'}` : null;
};

// L'API lookup d'Apple annonce une version AVANT que l'App Store de l'appareil la
// propose (propagation du binaire : plusieurs heures). Sans ce délai, un joueur serait
// bloqué face à une fiche store qui n'affiche encore que "Ouvrir".
export const IOS_RELEASE_GRACE_MS = 24 * 60 * 60 * 1000;

// iOS : fiche App Store (lookup iTunes fait par le plugin). On compare NOUS-MÊMES
// (une build TestFlight plus récente que le store n'est pas "en retard"), on vérifie
// que l'iOS de l'appareil peut installer cette version (sinon un vieil iPhone serait
// bloqué sans pouvoir se mettre à jour), et que la version est sortie depuis 24 h.
// `minimumOsVersion` est renvoyé par le plugin natif mais absent de ses types.
export const iosUpdateObtainable = (
  info: AppUpdateInfo & { minimumOsVersion?: string },
  userAgent: string,
  now: number = Date.now(),
): boolean => {
  const available = info.availableVersionName;
  const deviceOs = parseIosVersion(userAgent);
  const minOs = info.minimumOsVersion;
  const releasedAt = Date.parse(info.availableVersionReleaseDate ?? '');
  if (!available || !deviceOs || !minOs || !Number.isFinite(releasedAt)) return false;
  return isOlderVersion(info.currentVersionName, available)
    && !isOlderVersion(deviceOs, minOs)
    && now - releasedAt >= IOS_RELEASE_GRACE_MS;
};

export interface VersionBlock {
  minVersion: string;
}

// Machine à états de la maj forcée, isolée de socket/plugin pour être testable.
// Renvoie le handler à brancher sur l'event `versionPolicy`.
export const createPolicyEvaluator = (deps: {
  getCurrentVersion: () => string;
  isNewerVersionObtainable: (currentVersion: string) => Promise<boolean>;
  isBlocked: () => boolean;
  setBlocked: (block: VersionBlock | null) => void;
}) => {
  // Toute nouvelle politique invalide l'évaluation en cours (la vérification store est
  // asynchrone) : son résultat sera ignoré. Annuler va toujours dans le sens "pas de
  // blocage" (ex. "Désactiver" pendant une vérification lente ne peut pas être perdu).
  let seq = 0;
  return async (policy: VersionPolicy): Promise<void> => {
    const mySeq = ++seq;
    // Plancher changé en admin pendant la session : ne peut que LEVER un blocage,
    // jamais en poser un (il s'appliquera à la prochaine connexion).
    if (policy.trigger === 'update' && !deps.isBlocked()) return;
    const currentVersion = deps.getCurrentVersion();
    // Au-dessus du plancher (ou plancher inactif) : inutile d'interroger le store.
    const underFloor = shouldBlockForUpdate(currentVersion, policy.minVersion, true);
    const block = underFloor && await deps.isNewerVersionObtainable(currentVersion);
    if (mySeq !== seq) return;
    deps.setBlocked(block ? { minVersion: policy.minVersion } : null);
  };
};
