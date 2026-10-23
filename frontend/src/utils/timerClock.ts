/**
 * Échéance locale (epoch ms, horloge du client) d'un timer annoncé par le serveur.
 *
 * `startedAt` est un timestamp SERVEUR : le comparer à `Date.now()` du client
 * décale tout le compte à rebours de l'écart entre les deux horloges (un PC mal
 * réglé voyait un timer faux, voire déjà expiré). On calcule donc le temps restant
 * sur l'horloge serveur (`serverNow`, joint à l'émission), puis on le replaque sur
 * l'horloge locale. Seule l'erreur est la latence aller (quelques dizaines de ms,
 * côté « un peu plus long » : jamais d'expiration en avance).
 * Sans `serverNow` (ancien serveur), repli sur l'ancien calcul.
 */
export const localTimerEnd = (
  data: { startedAt: number; duration: number; serverNow?: number },
  localNow: number = Date.now(),
): number => {
  const serverEnd = data.startedAt + data.duration * 1000;
  if (typeof data.serverNow !== 'number') return serverEnd;
  return localNow + (serverEnd - data.serverNow);
};
