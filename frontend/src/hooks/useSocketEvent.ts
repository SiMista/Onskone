import { useEffect, useRef } from 'react';
import socket from '../utils/socket';
import type { ServerToClientEvents } from '@onskone/shared';

/**
 * Abonnement typé à un évènement serveur avec nettoyage ciblé.
 *
 * Implémentation ref-based : on s'abonne UNE seule fois par `event` (le wrapper
 * passé à `socket.on` reste stable tant que `event` ne change pas), et le handler
 * courant est conservé dans une ref rafraîchie à CHAQUE render. Ainsi le listener
 * voit toujours la dernière closure SANS dépendre d'un tableau de deps : pas de
 * réabonnement par render, et surtout pas de footgun de closure périmée si un
 * appelant oublie une dépendance (il n'y en a plus à fournir).
 *
 * INVARIANT CRITIQUE : au cleanup on ne détache QUE notre propre handler
 * (`socket.off(event, wrapped)`), pas tous les listeners de l'évènement, sinon
 * on supprimerait aussi ceux du useStudioBot (et de tout autre consommateur du
 * même évènement).
 *
 * @param event - Le nom de l'évènement socket
 * @param handler - Le callback qui traite l'évènement (toujours rafraîchi)
 */
export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K],
) {
  const handlerRef = useRef(handler);
  // Rafraîchi à chaque render → le listener invoque toujours la closure la plus
  // récente, quelles que soient les deps passées par l'appelant.
  handlerRef.current = handler;

  useEffect(() => {
    const wrapped = ((...args: unknown[]) =>
      (handlerRef.current as (...a: unknown[]) => void)(...args)) as ServerToClientEvents[K];
    socket.on(event, wrapped as never);
    return () => {
      socket.off(event, wrapped as never);
    };
  }, [event]);
}
