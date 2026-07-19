/**
 * Index O(1) `socketId -> lobbyCode`.
 *
 * Permet à `disconnectHandler` de retrouver le lobby d'un socket qui tombe sans
 * balayer TOUS les lobbies × tous les joueurs. La clé est le `socketId`, qui est
 * globalement unique et jamais réutilisé par Socket.IO — deux lobbies ne peuvent
 * donc pas se disputer une même clé.
 *
 * ── Invariant critique ──
 * Tout `socketId` d'un joueur VIVANT présent dans un lobby possède une entrée
 * pointant vers son lobby. Il n'est mis à jour QU'aux points où l'association
 * `socketId <-> joueur` change, tous funnelés :
 *   - `Lobby.addPlayer`      -> registerSocket   (un joueur entre dans un lobby)
 *   - `Lobby.removePlayer`   -> unregisterSocket (un joueur quitte un lobby)
 *   - `reconnectPlayerSlot`  -> reassignSocket   (réassociation ancien -> nouveau socket)
 *   - `cleanupInactiveLobbies` -> unregisterSocket (purge d'un lobby supprimé en masse)
 *
 * `Lobby.players` n'est muté QUE par `addPlayer` (push) et `removePlayer` (filter),
 * et `player.socketId` n'est réassigné QUE par `reconnectPlayerSlot` : la couverture
 * de ces quatre points est donc exhaustive. Une entrée obsolète (socket mort dont le
 * joueur a déjà été retiré/réassocié) ne peut jamais provoquer un mauvais lookup —
 * seule une entrée MANQUANTE pour un socket vivant serait un bug (disconnect no-op).
 */
const socketToLobby = new Map<string, string>();

/** Associe un socket à son lobby (entrée d'un joueur). */
export function registerSocket(socketId: string, lobbyCode: string): void {
    if (!socketId) return;
    socketToLobby.set(socketId, lobbyCode);
}

/** Retire l'association d'un socket (sortie d'un joueur). */
export function unregisterSocket(socketId: string): void {
    if (!socketId) return;
    socketToLobby.delete(socketId);
}

/**
 * Réassocie un joueur à un nouveau socket (reconnexion) : supprime l'ancienne
 * entrée puis pose la nouvelle. No-op de suppression si l'id est identique.
 */
export function reassignSocket(oldSocketId: string, newSocketId: string, lobbyCode: string): void {
    if (oldSocketId && oldSocketId !== newSocketId) {
        socketToLobby.delete(oldSocketId);
    }
    if (newSocketId) {
        socketToLobby.set(newSocketId, lobbyCode);
    }
}

/** Retrouve le lobby d'un socket, ou `undefined` s'il n'appartient à aucun. */
export function getLobbyCodeForSocket(socketId: string): string | undefined {
    return socketToLobby.get(socketId);
}

/** Taille courante de l'index — réservé aux tests. */
export function _indexSize(): number {
    return socketToLobby.size;
}
