/**
 * Échéance locale (epoch ms, horloge du client) d'un timer annoncé par le serveur.
 *
 * `startedAt` est un timestamp SERVEUR : le comparer à `Date.now()` du client
 * décale tout le compte à rebours de l'écart entre les deux horloges (un PC mal
 * réglé voyait un timer faux, voire déjà expiré). On calcule donc le temps restant
 * sur l'horloge serveur (`serverNow`, joint à l'émission), puis on le replaque sur
 * l'horloge locale. Seule l'erreur est la latence aller (quelques dizaines de ms,
 * côté « un peu plus long » : jamais d'expiration en avance).
 */
export const localTimerEnd = (
  data: { startedAt: number; duration: number; serverNow: number },
  localNow: number = Date.now(),
): number => {
  const serverEnd = data.startedAt + data.duration * 1000;
  return localNow + (serverEnd - data.serverNow);
};

/**
 * Départ local (epoch ms, horloge du client) d'un timer annoncé par le serveur, même
 * calcul que `localTimerEnd`. Dans le futur pendant le décalage d'une intro de phase
 * (cf. armServerTimer `leadInMs`).
 */
export const localTimerStart = (
  data: { startedAt: number; serverNow: number },
  localNow: number = Date.now(),
): number => localNow + (data.startedAt - data.serverNow);
