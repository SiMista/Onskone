/**
 * Versions de l'app et règle de maj forcée, partagées front/back (source unique).
 *
 * Règle (invariant) : un client n'est bloqué QUE si
 *   1. sa version est strictement sous le plancher posé en admin, ET
 *   2. une version plus récente lui est RÉELLEMENT obtenable (store de SON appareil
 *      sur mobile, simple rechargement sur le web).
 * => quelqu'un qui a déjà la dernière version qu'il peut obtenir n'est JAMAIS bloqué,
 *    même si son store est en retard sur le plancher (review Apple, rollout progressif,
 *    hotfix publié sur une seule plateforme...).
 */

type VersionParts = [number, number, number];

/** "v1.3.7" -> [1, 3, 7]. Segments manquants ou non numériques => 0. */
export const parseVersion = (v: string): VersionParts => {
  const seg = String(v ?? '').trim().replace(/^v/, '').split('.');
  const n = (i: number) => {
    const x = parseInt(seg[i] ?? '', 10);
    return Number.isFinite(x) ? x : 0;
  };
  return [n(0), n(1), n(2)];
};

/** true si la version `a` est strictement antérieure à `b`. */
export const isOlderVersion = (a: string, b: string): boolean => {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return true;
    if (pa[i] > pb[i]) return false;
  }
  return false;
};

/** "0.0.0" / vide = plancher inactif (aucune version ne lui est strictement inférieure). */
export const isActiveVersion = (v: string): boolean => parseVersion(v).some((x) => x > 0);

/**
 * LA règle de blocage. `updateObtainable` = une version plus récente que celle du
 * client lui est réellement accessible (c'est à l'appelant de le prouver ; dans le
 * doute il passe `false` : on préfère ne pas bloquer que bloquer sans issue).
 */
export const shouldBlockForUpdate = (
  currentVersion: string,
  minVersion: string,
  updateObtainable: boolean,
): boolean => isActiveVersion(minVersion) && isOlderVersion(currentVersion, minVersion) && updateObtainable;

/**
 * Valeur de `handshake.auth.versionPolicy` annoncée par les clients qui appliquent
 * eux-mêmes la règle (ils vérifient leur store). Le serveur ne les bloque plus au
 * handshake : il leur envoie la politique (`versionPolicy`) et ils tranchent.
 */
export const CLIENT_VERSION_POLICY = 1;

/**
 * Politique de maj forcée envoyée par le serveur (à la connexion, puis à chaque changement).
 * Pas de "version déployée" ici : sur le web, le client lit lui-même le /version.json
 * réellement servi (ce qu'un rechargement lui donnerait), seule source de vérité.
 */
export interface VersionPolicy {
  /** Plancher demandé en admin ; '' = aucun blocage. */
  minVersion: string;
  /**
   * 'connect' : envoyée à la (re)connexion -> le client applique la règle complète.
   * 'update'  : plancher modifié en admin pendant la session -> le client peut
   *             uniquement LEVER un blocage (jamais en poser un en pleine partie).
   */
  trigger: 'connect' | 'update';
}
