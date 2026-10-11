/**
 * Statut premium déclaré par le client au handshake socket (auto-déclaré, falsifiable,
 * enjeu faible assumé). Accepte le booléen `true` comme la chaîne `'true'` (selon la
 * sérialisation du transport). Centralise la lecture dupliquée dans createLobby/joinLobby.
 */
export const readHandshakePremium = (
  socket: { handshake: { auth?: Record<string, unknown> } },
): boolean => socket.handshake.auth?.premium === true || socket.handshake.auth?.premium === 'true';
