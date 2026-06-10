import * as LobbyManager from '../../managers/LobbyManager';
import { Lobby } from '../../models/Lobby';
import { Game } from '../../models/Game';
import { Player } from '../../models/Player';
import type { IGame } from '@onskone/shared';
import { ERROR_CODES } from '@onskone/shared';
import { validateLobbyCode, validatePlayerId } from '../../utils/validation.js';
import { Round } from '../../models/Round';
import { RateLimiter } from '../../utils/rateLimiter.js';
import { errMessage } from '../../utils/helpers.js';
import logger from '../../utils/logger.js';
import { ConnectionRegistry } from '../ConnectionRegistry.js';
import { emitLobbyDecksState, type IoServer, type AppSocket } from '../broadcasting.js';

/**
 * Contexte partagé injecté à chaque module de handlers via `register(socket, ctx)`.
 * Détient les dépendances communes (io, registry) — les fonctions de broadcasting
 * sont importées directement par chaque module (pures, sans `this`).
 */
export interface HandlerContext {
    io: IoServer;
    registry: ConnectionRegistry;
    /**
     * Nettoie les joueurs vraiment déconnectés du lobby (socket plus dans la room,
     * période de grâce expirée). Partagé par joinLobby et startGame.
     */
    cleanupDisconnectedPlayers: (lobby: Lobby | undefined, excludePlayerName?: string) => void;
}

export type { IoServer, AppSocket };

/**
 * Construit le contexte partagé une fois par instance de SocketHandler.
 */
export function createHandlerContext(io: IoServer, registry: ConnectionRegistry): HandlerContext {
    return {
        io,
        registry,
        cleanupDisconnectedPlayers: (lobby, excludePlayerName) =>
            cleanupDisconnectedPlayers(io, registry, lobby, excludePlayerName),
    };
}

/**
 * Nettoie les joueurs dont le socket est vraiment déconnecté (pas dans le lobby room)
 * et dont la période de grâce a expiré (pas de timeout actif).
 * Appelé quand quelqu'un rejoint ou quand on démarre une partie.
 * @param excludePlayerName - Nom du joueur à exclure du nettoyage (celui qui se reconnecte)
 */
export function cleanupDisconnectedPlayers(
    io: IoServer,
    registry: ConnectionRegistry,
    lobby: ReturnType<typeof LobbyManager.getLobby>,
    excludePlayerName?: string,
): void {
    if (!lobby) return;

    const room = io.sockets.adapter.rooms.get(lobby.code);
    const connectedSocketIds = room ? Array.from(room) : [];

    // Trouver les joueurs inactifs dont le socket n'est plus connecté au room
    // ET qui n'ont pas de timeout de reconnexion actif (période de grâce expirée)
    const playersToRemove = lobby.players.filter(p =>
        !p.isActive &&
        !connectedSocketIds.includes(p.socketId) &&
        p.name !== excludePlayerName &&
        // Ne pas supprimer si un timeout de reconnexion est actif (joueur en période de grâce)
        !registry.hasDisconnectTimeout(lobby.code, p.name)
    );

    for (const player of playersToRemove) {
        // Supprimer le joueur (pas besoin d'annuler le timeout car il n'existe pas)
        LobbyManager.removePlayer(lobby, player);
        logger.info(`Joueur déconnecté ${player.name} retiré du lobby ${lobby.code} (période de grâce expirée)`);
    }
}

/**
 * Vérifie que le socket est le pilier du round courant.
 * @returns true si c'est le pilier, false sinon (émet aussi l'erreur au socket).
 * Invariant : si true est renvoyé, `game` et `game.currentRound` sont garantis non-null.
 */
export function requireLeader(
    socket: AppSocket,
    game: IGame | null | undefined,
    action: string,
): boolean {
    if (!game?.currentRound) {
        socket.emit('error', { message: 'Partie ou round introuvable', code: ERROR_CODES.NOT_FOUND });
        return false;
    }
    if (socket.id !== game.currentRound.leader.socketId) {
        socket.emit('error', { message: `Seul le pilier peut ${action}`, code: ERROR_CODES.NOT_LEADER });
        return false;
    }
    return true;
}

/**
 * Miroir de requireLeader pour les actions réservées à l'hôte du lobby.
 * @returns true si le socket est l'hôte, false sinon (émet l'erreur appropriée).
 * `action` est inséré dans le message exact attendu par le front ("Seul l'hôte peut <action>").
 */
export function requireHost(
    socket: AppSocket,
    lobby: Lobby,
    action: string,
): boolean {
    const host = lobby.players.find(p => p.isHost);
    if (!host || host.socketId !== socket.id) {
        socket.emit('error', { message: `Seul l'hôte peut ${action}`, code: ERROR_CODES.NOT_HOST });
        return false;
    }
    return true;
}

export interface ResolvedGuards {
    lobby: Lobby;
    game: Game | null;
    host: Player | null;
}

export interface GuardOptions {
    /** Rate limiter à appliquer en premier. Si absent, aucun rate-limit. */
    limiter?: RateLimiter;
    /** Clés supplémentaires pour isAllowedMultiple (en plus de socket.id). */
    extraRateKeys?: string[];
    /** Valider le lobbyCode (format) avant le lookup. */
    requireLobbyCode?: boolean;
    /** Le lobby doit exister (émet "Salon introuvable" sinon). */
    requireLobby?: boolean;
    /** Le lobby doit avoir une partie en cours (résout game, émet "Partie introuvable" sinon). */
    requireGame?: boolean;
    /** Action réservée à l'hôte (utilise requireHost). `requireHostAction` = texte du message. */
    requireHostAction?: string;
    /** Refuser si une partie est déjà IN_PROGRESS (réglages de lobby). `gameInProgressMessage` personnalise. */
    rejectIfInProgress?: boolean;
    /** Message personnalisé si rejectIfInProgress échoue (défaut: "La partie est déjà en cours"). */
    gameInProgressMessage?: string;
    /** Valider data.currentPlayerId / data.playerId via validatePlayerId. */
    requirePlayerId?: 'currentPlayerId' | 'playerId';
    /** Message d'erreur pour requireGame (défaut "Partie introuvable"). */
    gameNotFoundMessage?: string;
    /**
     * Action réservée au pilier du round courant (utilise requireLeader sur le game résolu).
     * `requireLeaderAction` = texte inséré dans "Seul le pilier peut <action>". Émet
     * "Partie ou round introuvable" (NOT_FOUND) si le round est absent, sinon vérifie le pilier.
     */
    requireLeaderAction?: string;
    /**
     * Canal alternatif d'échec : si fourni, est appelé À LA PLACE de chaque
     * `socket.emit('error', ...)` standard — aussi bien quand une garde échoue que
     * quand le corps du handler throw (catch interne). Permet à un handler comme
     * requestTimerState d'émettre `socket.emit('timerState', null)` plutôt qu'une
     * erreur générique. Quand absent, le comportement par défaut (emit error) s'applique.
     */
    onReject?: () => void;
}

interface GuardData {
    lobbyCode?: string;
    [key: string]: unknown;
}

/**
 * Préambule réutilisable : exécute rate-limit, validations de format,
 * résout lobby/game/host UNE fois et émet les erreurs standardisées avec leur ERROR_CODE
 * exact. Si une garde échoue, l'erreur est émise et `false` est retourné (le handler ne
 * doit alors rien faire). Sinon `handler(resolved)` est invoqué.
 *
 * Les messages et codes d'erreur ne doivent PAS être modifiés : le front discrimine
 * sur le texte localisé, donc les changer casserait sa logique d'affichage.
 */
export function withGuards<TData extends GuardData>(
    socket: AppSocket,
    data: TData,
    options: GuardOptions,
    handler: (resolved: ResolvedGuards, data: TData) => void,
): void {
    // Canal d'échec : `onReject` se substitue à TOUT emit('error') (gardes + catch
    // interne). Quand il est défini, on n'émet AUCUNE erreur standard — le handler
    // décide (ex. `socket.emit('timerState', null)`). Renvoie `false` pour que les
    // gardes retournent comme avant.
    const reject = (message: string, code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES]): false => {
        if (options.onReject) {
            options.onReject();
        } else {
            socket.emit('error', { message, code });
        }
        return false;
    };

    // 1) Rate limiting
    if (options.limiter) {
        const keys = [socket.id, ...(options.extraRateKeys ?? [])];
        const allowed = keys.length > 1
            ? options.limiter.isAllowedMultiple(keys)
            : options.limiter.isAllowed(socket.id);
        if (!allowed) {
            reject('Trop de requêtes. Veuillez patienter.', ERROR_CODES.RATE_LIMITED);
            return;
        }
    }

    // 2) Validate lobbyCode format
    if (options.requireLobbyCode) {
        const codeValidation = validateLobbyCode(data.lobbyCode ?? '');
        if (!codeValidation.isValid) {
            reject(codeValidation.error || 'Code invalide', ERROR_CODES.INVALID);
            return;
        }
    }

    // 3) Validate playerId format
    if (options.requirePlayerId) {
        const raw = data[options.requirePlayerId];
        const validation = validatePlayerId(typeof raw === 'string' ? raw : '');
        if (!validation.isValid) {
            reject(validation.error || 'ID joueur invalide', ERROR_CODES.INVALID);
            return;
        }
    }

    // 4) Resolve lobby
    const lobby = LobbyManager.getLobby(data.lobbyCode ?? '');
    if (options.requireLobby && !lobby) {
        reject('Salon introuvable', ERROR_CODES.NOT_FOUND);
        return;
    }

    // 5) Resolve game
    const game = lobby?.game ?? null;
    if (options.requireGame && !game) {
        reject(options.gameNotFoundMessage || 'Partie introuvable', ERROR_CODES.NOT_FOUND);
        return;
    }

    // 6) Host check
    let host: Player | null = null;
    if (options.requireHostAction !== undefined) {
        // requireLobby is implied for host actions
        if (!lobby) {
            reject('Salon introuvable', ERROR_CODES.NOT_FOUND);
            return;
        }
        if (options.onReject) {
            // En mode canal alternatif, on ne peut pas déléguer à requireHost (qui
            // emit l'erreur directement). On reproduit sa garde en passant par reject.
            const hostPlayer = lobby.players.find(p => p.isHost);
            if (!hostPlayer || hostPlayer.socketId !== socket.id) {
                reject(`Seul l'hôte peut ${options.requireHostAction}`, ERROR_CODES.NOT_HOST);
                return;
            }
        } else if (!requireHost(socket, lobby, options.requireHostAction)) {
            return;
        }
        host = lobby.players.find(p => p.isHost) ?? null;
    }

    // 7) Reject if game already in progress (lobby settings)
    if (options.rejectIfInProgress && lobby?.game && lobby.game.status === 'IN_PROGRESS') {
        reject(options.gameInProgressMessage || 'La partie est déjà en cours', ERROR_CODES.GAME_IN_PROGRESS);
        return;
    }

    // 8) Leader check (action réservée au pilier du round courant)
    if (options.requireLeaderAction !== undefined) {
        if (options.onReject) {
            // Cf. host check : reproduire requireLeader via reject en mode canal alternatif.
            if (!game?.currentRound) {
                reject('Partie ou round introuvable', ERROR_CODES.NOT_FOUND);
                return;
            }
            if (socket.id !== game.currentRound.leader.socketId) {
                reject(`Seul le pilier peut ${options.requireLeaderAction}`, ERROR_CODES.NOT_LEADER);
                return;
            }
        } else if (!requireLeader(socket, game, options.requireLeaderAction)) {
            return;
        }
    }

    // 9) Exécution du handler sous un try/catch interne : centralise le postambule
    // d'erreur (logger.error + emit INTERNAL) que chaque handler dupliquait. Les
    // handlers n'ont donc plus besoin de leur propre try/catch + emit INTERNAL.
    try {
        handler({ lobby: lobby as Lobby, game: game as Game | null, host }, data);
    } catch (error) {
        logger.error('Erreur inattendue dans un handler socket', { error: errMessage(error) });
        reject('Une erreur inattendue est survenue', ERROR_CODES.INTERNAL);
    }
}

/**
 * Garde résolue pour les actions du pilier : `game` et `round` sont garantis
 * non-null ET typés sur les classes concrètes (`Game`/`Round`), ce qui supprime
 * les `game!`, `game!.currentRound!`, `as Round`, `as Game` dans les handlers.
 * Réutilise `withGuards` (requireLeaderAction) : la résolution + les gardes +
 * le try/catch interne sont mutualisés. `requireLeaderAction` garantit que le
 * round existe et que le socket est le pilier, donc le cast est sûr.
 */
export function withLeaderGuards<TData extends GuardData>(
    socket: AppSocket,
    data: TData,
    options: Omit<GuardOptions, 'requireLeaderAction' | 'requireGame'> & { requireLeaderAction: string },
    handler: (resolved: { lobby: Lobby; game: Game; round: Round; host: Player | null }, data: TData) => void,
): void {
    withGuards(socket, data, options, ({ lobby, game, host }, d) => {
        // requireLeaderAction garantit game.currentRound non-null + pilier vérifié.
        const resolvedGame = game as Game;
        handler({ lobby, game: resolvedGame, round: resolvedGame.currentRound as Round, host }, d);
    });
}

/**
 * Variante typée pour les actions nécessitant un game non-null SANS exiger que le
 * socket soit le pilier (utilise `requireGame`). Résout et type `game: Game`,
 * supprimant les `game!` / `as Game` dans les handlers. Le round n'est PAS exposé :
 * les handlers qui en ont besoin font leur propre vérification (`game.currentRound`).
 */
export function withGameGuards<TData extends GuardData>(
    socket: AppSocket,
    data: TData,
    options: Omit<GuardOptions, 'requireGame'>,
    handler: (resolved: { lobby: Lobby; game: Game; host: Player | null }, data: TData) => void,
): void {
    withGuards(socket, data, { ...options, requireGame: true }, ({ lobby, game, host }, d) => {
        // requireGame garantit game non-null.
        handler({ lobby, game: game as Game, host }, d);
    });
}

export { emitLobbyDecksState };
