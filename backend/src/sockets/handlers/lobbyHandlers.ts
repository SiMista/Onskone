import * as LobbyManager from '../../managers/LobbyManager';
import { createGame } from '../../managers/GameManager.js';
import { sanitizeSelectedDecks, getDefaultSelectedDecks } from '../../data/questionsRepository.js';
import { readHandshakePremium } from '../../utils/premium.js';
import { Player } from '../../models/Player';
import { Lobby } from '../../models/Lobby';
import { GAME_CONSTANTS, GameStatus, DEFAULT_LOCALE, isLocale, isGameSpeed, ERROR_CODES } from '@onskone/shared';
import type { GameSpeed } from '@onskone/shared';
import { validatePlayerName, validateAvatarId, sanitizeInput } from '../../utils/validation.js';
import { rateLimiters } from '../../utils/rateLimiter.js';
import { errMessage } from '../../utils/helpers.js';
import { speedFromLegacyMultiplier, legacyMultiplierFromSpeed } from '../../utils/legacyTimeMultiplier.js';
import logger from '../../utils/logger.js';
import { serializeGame, serializeRound, serializePlayer, serializePlayers, emitLobbyDecksState, armServerTimerForPhase } from '../broadcasting.js';
import { scheduleLeaderSkipTimeout, armLeaderSkipIfDisconnected } from './disconnectHandler.js';
import type { Round } from '../../models/Round.js';
import {
    reconnectPlayerSlot,
    isSocketAlive,
    socketHoldsOtherSlot,
    listReclaimablePlayers,
    issueClaimToken,
    tokenMatches,
    revokeClaimIfProvenOwner,
} from './reconnection.js';
import {
    type HandlerContext,
    type AppSocket,
    withGuards,
} from './context.js';

/**
 * Applique un réglage de lobby réservé à l'hôte (decks, mode, vitesse de jeu).
 * Centralise le préambule quasi-identique des 3 handlers de réglages :
 * rate-limit lobbySettings + validation code + lobby + host (message personnalisé) +
 * refus si partie en cours, puis exécute `apply(lobby)`.
 */
function applyHostSetting(
    socket: AppSocket,
    data: { lobbyCode: string },
    hostAction: string,
    apply: (lobby: Lobby) => void,
): void {
    withGuards(
        socket,
        data,
        {
            limiter: rateLimiters.lobbySettings,
            requireLobbyCode: true,
            requireLobby: true,
            requireHostAction: hostAction,
            rejectIfInProgress: true,
        },
        ({ lobby }) => {
            // updateActivity() est appelé DANS chaque closure `apply`, sur le chemin de
            // succès uniquement : pas de bump d'activité quand le réglage est rejeté
            // (ex. 0 deck sélectionné).
            apply(lobby);
        },
    );
}

export function registerLobbyHandlers(socket: AppSocket, ctx: HandlerContext): void {
    const { io, registry } = ctx;

    // Event: Create Lobby with player name as host
    // withGuards pour le rate-limit + try/catch interne. La validation de playerName
    // et la création du lobby (pas de lobby préexistant à résoudre) restent dans le
    // corps — aucune garde requireLobby* ne s'applique à un createLobby.
    socket.on('createLobby', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.createLobby,
        }, (_resolved, data) => {
            // Sanitize PUIS valider le résultat : un nom vidé/raccourci par la sanitisation
            // ne doit pas passer une validation faite sur l'input brut.
            const sanitizedName = sanitizeInput(data.playerName);
            const nameValidation = validatePlayerName(sanitizedName);
            if (!nameValidation.isValid) {
                socket.emit('error', { message: nameValidation.error || 'Nom invalide', code: ERROR_CODES.INVALID });
                return;
            }

            const avatarId = validateAvatarId(data.avatarId);
            const locale = isLocale(data.locale) ? data.locale : DEFAULT_LOCALE;
            const lobbyCode = LobbyManager.create(locale);
            const lobby = LobbyManager.getLobby(lobbyCode);
            // Statut premium de l'host, déclaré au handshake (cf. front socket.ts).
            // Gating "l'host débloque pour la table" : autorise les thèmes premium
            // pour tout le lobby. Auto-déclaré (falsifiable, enjeu faible assumé).
            const hostPremium = readHandshakePremium(socket);
            if (lobby) {
                lobby.hostIsPremium = hostPremium;
                // Host premium : les thèmes premium sont sélectionnés d'office
                // (recalcul de la sélection par défaut, qui excluait les premium au constructeur).
                if (lobby.hostIsPremium) {
                    lobby.selectedDecks = getDefaultSelectedDecks(lobby.locale, true);
                }
            }
            const hostPlayer = new Player(sanitizedName, socket.id, true, avatarId, hostPremium);
            lobby?.addPlayer(hostPlayer);
            if (lobby && (data.gameMode === 'local' || data.gameMode === 'remote')) {
                lobby.gameMode = data.gameMode;
            }
            socket.join(lobbyCode);
            // reconnectToken émis UNIQUEMENT au socket du host (secret de reconnexion).
            socket.emit('lobbyCreated', { lobbyCode, reconnectToken: hostPlayer.reconnectToken });
            emitLobbyDecksState(io, socket, lobby!);
            logger.game.created(lobbyCode, sanitizedName);
        });
    });

    // Event: Join Lobby with player name
    // withGuards : rate-limit + lobbyCode + try/catch interne. La validation de
    // playerName (spécifique) reste dans le corps AVANT le check lobby pour préserver
    // l'ordre des erreurs (nom invalide avant "Salon introuvable"). On ne peut donc
    // pas utiliser requireLobby (qui émettrait avant la validation du nom).
    socket.on('joinLobby', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.joinLobby,
            requireLobbyCode: true,
        }, ({ lobby }, data) => {
            // Sanitize PUIS valider le résultat (cf. createLobby).
            const sanitizedName = sanitizeInput(data.playerName);
            const nameValidation = validatePlayerName(sanitizedName);
            if (!nameValidation.isValid) {
                socket.emit('error', { message: nameValidation.error || 'Nom invalide', code: ERROR_CODES.INVALID });
                return;
            }

            if (!lobby) {
                socket.emit('error', { message: 'Salon introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }

            // Update lobby activity
            lobby.updateActivity();

            // Statut premium déclaré au handshake (rafraîchi à chaque (re)connexion :
            // achat ou override Studio peut avoir changé depuis le 1er join).
            const joinerPremium = readHandshakePremium(socket);

            // Nettoyer les joueurs vraiment déconnectés (ceux qui ont quitté l'onglet)
            // IMPORTANT: Exclure le joueur qui se reconnecte pour ne pas le supprimer
            ctx.cleanupDisconnectedPlayers(lobby, sanitizedName);

            // Vérifier si le joueur a été kické récemment
            if (registry.isPlayerKicked(data.lobbyCode, sanitizedName)) {
                socket.emit('error', { message: 'Vous avez été expulsé de ce salon', code: ERROR_CODES.KICKED });
                logger.debug(`Joueur ${sanitizedName} bloqué - a été kické du lobby ${data.lobbyCode}`);
                return;
            }

            // Vérifie si le joueur avec ce socket.id est déjà dans le lobby
            const existingPlayerBySocket = lobby.players.find(p => p.socketId === socket.id);
            if (existingPlayerBySocket) {
                logger.debug(`Player ${existingPlayerBySocket.name} déjà dans le lobby ${lobby.code}`);
                // Annuler les timeouts de déconnexion et d'inactivité s'ils existent
                registry.cancelDisconnectTimeout(lobby.code, existingPlayerBySocket.name);
                registry.cancelInactiveTimeout(lobby.code, existingPlayerBySocket.name);
                existingPlayerBySocket.isActive = true; // Marquer comme actif (rejouer)
                // Rafraîchir le statut premium depuis le handshake (peut avoir changé,
                // ex. achat/override Studio en cours de session).
                existingPlayerBySocket.isPremium = joinerPremium;
                socket.join(lobby.code);
                socket.emit('joinedLobby', { player: serializePlayer(existingPlayerBySocket), reconnectToken: existingPlayerBySocket.reconnectToken });
                emitLobbyDecksState(io, socket, lobby);
                io.to(lobby.code).emit('updatePlayersList', { players: serializePlayers(lobby.players) });

                // Si une partie est en cours, envoyer gameStarted pour rediriger vers la page de jeu
                if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                    socket.emit('gameStarted', { game: serializeGame(lobby) });
                    logger.info(`Partie en cours détectée, envoi gameStarted à ${existingPlayerBySocket.name}`);
                }
                return;
            }

            // Vérifie si un joueur avec ce nom existe déjà (reconnexion après refresh).
            // Comparaison insensible à la casse : "Loic" et "loic" = même joueur.
            const existingPlayerByName = lobby.players.find(p => p.name.toLowerCase() === sanitizedName.toLowerCase());
            if (existingPlayerByName) {
                // Chemin sûr : le client présente un reconnectToken qui correspond au
                // secret du joueur cible → reconnexion prouvée, on contourne la garde de
                // liveness (le slot lui appartient légitimement même si l'ancien socket
                // n'est pas encore tombé).
                if (!tokenMatches(existingPlayerByName, data.reconnectToken)) {
                    // Pas de token (ou token erroné) : le joueur cible possède un secret
                    // défini, donc une reconnexion non prouvée n'est jamais autorisée à
                    // reprendre le slot — ni pendant la fenêtre de déconnexion. Les noms
                    // sont publics (getLobbyInfo/updatePlayersList) : sans ce refus, un
                    // attaquant rejoignant sous le nom de l'hôte/pilier récupérerait son
                    // socketId — donc ses privilèges (host/leader takeover).
                    socket.emit('error', { message: 'Reconnexion non autorisée', code: ERROR_CODES.CONFLICT, sessionLost: true });
                    logger.warn('Prise de contrôle par nom refusée (token de reconnexion absent/invalide)', {
                        lobbyCode: lobby.code,
                        name: sanitizedName,
                        attackerSocketId: socket.id,
                        tokenProvided: !!data.reconnectToken,
                    });
                    return;
                }

                // Ancien socket encore vu comme vivant (mobile revenu au premier plan
                // avant que le serveur ait constaté la mort de l'ancien socket, ou vrai
                // double-onglet). Le token prouve que c'est le propriétaire : on REPREND
                // le slot et on évince l'ancien socket après la réassociation — même
                // politique que getGameState. Le refuser laissait le joueur dehors
                // jusqu'à 45 s (ping timeout) avec « Ce nom est déjà utilisé ».
                const existingSocket = io.sockets.sockets.get(existingPlayerByName.socketId);
                const staleSocket = existingSocket && existingSocket.connected && existingSocket.id !== socket.id
                    ? existingSocket
                    : null;

                // Vérifier si une reconnexion est déjà en cours
                if (registry.hasReconnectionLock(lobby.code, sanitizedName)) {
                    logger.debug(`Reconnexion déjà en cours pour ${sanitizedName}`);
                    socket.emit('error', { message: 'Reconnexion en cours, veuillez patienter.', code: ERROR_CODES.CONFLICT });
                    return;
                }

                // Acquérir le lock
                registry.acquireReconnectionLock(lobby.code, sanitizedName);

                try {
                    // C'est une reconnexion - mettre à jour le socketId
                    logger.info(`Player ${sanitizedName} reconnecte au lobby ${lobby.code}`);
                    // Rafraîchir le premium AVANT le cœur partagé pour que l'emit
                    // updatePlayersList (ci-dessous) reflète le statut à jour.
                    existingPlayerByName.isPremium = joinerPremium; // rafraîchir le premium
                    // Cœur partagé : cancel timeouts + réassociation slot/socket + pilier.
                    reconnectPlayerSlot(registry, lobby, existingPlayerByName, socket);
                    // Propriétaire prouvé de retour : toute reprise sans preuve est révoquée.
                    revokeClaimIfProvenOwner(existingPlayerByName, data.reconnectToken);
                    // Éviction APRÈS la réassociation : le handler `disconnect` de l'ancien
                    // socket ne retrouve plus son id dans l'index et n'arme aucun timeout.
                    if (staleSocket) {
                        logger.info('Ancien socket évincé (slot repris avec token valide)', {
                            lobbyCode: lobby.code, playerId: existingPlayerByName.id,
                            evictedSocketId: staleSocket.id, newSocketId: socket.id,
                        });
                        staleSocket.disconnect();
                    }

                    socket.emit('joinedLobby', { player: serializePlayer(existingPlayerByName), reconnectToken: existingPlayerByName.reconnectToken });
                    emitLobbyDecksState(io, socket, lobby);
                    io.to(lobby.code).emit('updatePlayersList', { players: serializePlayers(lobby.players) });

                    // Si une partie est en cours, envoyer gameStarted pour rediriger vers la page de jeu
                    if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                        socket.emit('gameStarted', { game: serializeGame(lobby) });
                        logger.info(`Partie en cours détectée, envoi gameStarted à ${existingPlayerByName.name}`);
                    }
                } finally {
                    // Relâcher le lock
                    registry.releaseReconnectionLock(lobby.code, sanitizedName);
                }
                return;
            }

            // Vérifier si une partie est déjà en cours (empêcher les nouveaux joueurs de rejoindre)
            if (lobby.game && lobby.game.status === 'IN_PROGRESS') {
                socket.emit('gameAlreadyStarted', { message: 'La partie a déjà été lancée' });
                logger.info(`Nouveau joueur ${sanitizedName} refusé - partie déjà en cours dans ${lobby.code}`);
                return;
            }

            // Nouveau joueur
            const avatarId = validateAvatarId(data.avatarId);
            const newPlayer = new Player(sanitizedName, socket.id, false, avatarId, joinerPremium);
            LobbyManager.addPlayer(lobby, newPlayer);

            socket.join(lobby.code);
            // reconnectToken émis UNIQUEMENT au socket du nouveau joueur (secret de reconnexion).
            socket.emit('joinedLobby', { player: serializePlayer(newPlayer), reconnectToken: newPlayer.reconnectToken });
            emitLobbyDecksState(io, socket, lobby);
            io.to(lobby.code).emit('updatePlayersList', { players: serializePlayers(lobby.players) });
            logger.info(`${sanitizedName} a rejoint le lobby ${lobby.code}`, { playerCount: lobby.players.length });
        });
    });

    // Reprise d'un slot SANS secret de reconnexion (session perdue : crash, appli
    // tuée, stockage vidé). Le joueur a choisi « c'était moi » dans la liste des
    // déconnectés (cf. lobbyInfo.reclaimablePlayers). Garde-fous :
    //   - partie EN COURS uniquement (en attente, un slot tombé est purgé après la
    //     grâce et on rejoint à neuf ; ouvrir la reprise là n'apporterait rien et
    //     permettrait de récupérer les droits de l'hôte) ;
    //   - le slot visé doit être réellement sans connexion vivante — un joueur présent
    //     n'est jamais délogeable sans son secret ;
    //   - le secret D'ORIGINE reste valide : le vrai propriétaire qui revient reprend
    //     son slot et révoque la reprise (cf. issueClaimToken) ;
    //   - rate-limit par salon en plus du socket (un nouveau socket = budget neuf).
    socket.on('reclaimPlayer', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.joinLobby,
            extraRateKeys: [`${data?.lobbyCode ?? ''}_reclaim`],
            requireLobbyCode: true,
            requirePlayerId: 'playerId',
            requireLobby: true,
        }, ({ lobby }, data) => {
            if (lobby.game?.status !== GameStatus.IN_PROGRESS) {
                socket.emit('error', { message: 'Aucune partie en cours à reprendre', code: ERROR_CODES.INVALID });
                return;
            }
            const player = lobby.getPlayer(data.playerId);
            if (!player) {
                socket.emit('error', { message: 'Joueur introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }
            if (registry.isPlayerKicked(lobby.code, player.name)) {
                socket.emit('error', { message: 'Vous avez été expulsé de ce salon', code: ERROR_CODES.KICKED });
                return;
            }
            // Un socket ne tient qu'UN slot : s'il est déjà rattaché à un autre joueur du
            // salon (joueur connecté qui rouvre le lien d'invitation et tape sur le nom
            // d'un ami déconnecté), deux joueurs partageraient le même socketId et le
            // handler `disconnect`, qui résout le joueur par socketId, n'en verrait qu'un.
            if (socketHoldsOtherSlot(lobby, socket.id, player.id)) {
                socket.emit('error', { message: 'Vous occupez déjà une place dans ce salon', code: ERROR_CODES.FORBIDDEN });
                logger.warn('Reprise de slot refusée (socket déjà rattaché à un autre joueur)', {
                    lobbyCode: lobby.code, playerId: player.id, requesterSocketId: socket.id,
                });
                return;
            }
            if (player.socketId !== socket.id && isSocketAlive(io, player.socketId)) {
                socket.emit('error', { message: 'Ce joueur est déjà connecté', code: ERROR_CODES.CONFLICT });
                logger.warn('Reprise de slot refusée (joueur encore connecté)', {
                    lobbyCode: lobby.code, playerId: player.id, requesterSocketId: socket.id,
                });
                return;
            }

            lobby.updateActivity();
            const reconnectToken = issueClaimToken(player);
            player.isPremium = readHandshakePremium(socket);
            reconnectPlayerSlot(registry, lobby, player, socket);

            const gameStatus = lobby.game?.status ?? GameStatus.WAITING;
            socket.emit('playerReclaimed', { player: serializePlayer(player), reconnectToken, gameStatus });
            emitLobbyDecksState(io, socket, lobby);
            io.to(lobby.code).emit('updatePlayersList', { players: serializePlayers(lobby.players) });
            logger.info(`Slot de ${player.name} repris sans secret (session perdue) dans ${lobby.code}`, { gameStatus });
        });
    });

    // Get lobby info (for invite links)
    socket.on('getLobbyInfo', (data: { lobbyCode: string }) => {
        try {
            // Rate limiting. Toujours faire écho du code, même ici : Home route la
            // réponse dessus (URL / popup « Rejoindre » / reprise de partie).
            if (!rateLimiters.general.isAllowed(socket.id)) {
                socket.emit('lobbyInfo', { exists: false, lobbyCode: data?.lobbyCode });
                return;
            }

            const lobby = LobbyManager.getLobby(data.lobbyCode);
            if (!lobby) {
                socket.emit('lobbyInfo', { exists: false, lobbyCode: data.lobbyCode });
                return;
            }
            const host = lobby.getHost();
            socket.emit('lobbyInfo', {
                exists: true,
                lobbyCode: data.lobbyCode,
                hostName: host?.name || null,
                locale: lobby.locale,
                gameStatus: lobby.game?.status ?? GameStatus.WAITING,
                // Slots libres à reprendre (session perdue) : proposés par l'accueil.
                reclaimablePlayers: listReclaimablePlayers(io, lobby),
            });
        } catch (error) {
            logger.error('Error getting lobby info', { error: errMessage(error) });
            socket.emit('lobbyInfo', { exists: false, lobbyCode: data?.lobbyCode });
        }
    });

    // Update selected decks (host only)
    socket.on('updateSelectedDecks', (data) => {
        // Pas de try/catch externe : applyHostSetting → withGuards possède déjà son
        // propre try/catch interne (emit INTERNAL, jamais rethrow), donc ce wrapper
        // serait mort.
        applyHostSetting(socket, data, 'modifier les decks', (lobby) => {
            const sanitized = sanitizeSelectedDecks(data.selected || {}, lobby.locale, lobby.hostIsPremium);
            const totalSelected = Object.values(sanitized).reduce((acc, arr) => acc + arr.length, 0);
            if (totalSelected === 0) {
                socket.emit('error', { message: 'Au moins un thème doit être sélectionné', code: ERROR_CODES.INVALID });
                return;
            }

            lobby.selectedDecks = sanitized;
            lobby.updateActivity();

            emitLobbyDecksState(io, null, lobby);
        });
    });

    // Update Guess My Answer Mode (host only)
    socket.on('updateGuessMyAnswerMode', (data) => {
        // Cf. updateSelectedDecks : le try/catch interne de withGuards suffit.
        applyHostSetting(socket, data, 'modifier ce mode', (lobby) => {
            lobby.guessMyAnswerMode = !!data.guessMyAnswerMode;
            lobby.updateActivity();

            emitLobbyDecksState(io, null, lobby);
            io.to(lobby.code).emit('guessMyAnswerModeUpdated', {
                guessMyAnswerMode: lobby.guessMyAnswerMode,
            });
        });
    });

    // Applique une vitesse de jeu au lobby et la diffuse (event courant + pendant legacy).
    const applyGameSpeed = (lobby: Lobby, requested: unknown): void => {
        // Vitesse de debug : acceptée UNIQUEMENT si le backend tourne en développement.
        // En production elle retombe sur la vitesse par défaut — sans quoi n'importe
        // quel client pourrait imposer des phases interminables à la table.
        const isAllowed = isGameSpeed(requested)
            && (requested !== GAME_CONSTANTS.GAME_SPEED_DEBUG || process.env.NODE_ENV !== 'production');
        const speed: GameSpeed = isAllowed ? requested : GAME_CONSTANTS.GAME_SPEED_DEFAULT;
        lobby.gameSpeed = speed;
        lobby.updateActivity();

        emitLobbyDecksState(io, null, lobby);
        io.to(lobby.code).emit('gameSpeedUpdated', { gameSpeed: speed });
        io.to(lobby.code).emit('timeMultiplierUpdated', { timeMultiplier: legacyMultiplierFromSpeed(speed) });
    };

    // Update game speed (host only)
    socket.on('updateGameSpeed', (data) => {
        // Cf. updateSelectedDecks : le try/catch interne de withGuards suffit.
        applyHostSetting(socket, data, 'modifier ce réglage', (lobby) => {
            applyGameSpeed(lobby, data.gameSpeed);
        });
    });

    // Update excluded leaders (host only) : joueurs qui ne seront jamais pilier.
    socket.on('updateExcludedLeaders', (data) => {
        // Cf. updateSelectedDecks : le try/catch interne de withGuards suffit.
        applyHostSetting(socket, data, 'modifier ce réglage', (lobby) => {
            const raw: unknown = data.excludedLeaderIds;
            // Payload mal formé (pas un tableau, ou plus long qu'un salon plein) : ignoré.
            if (!Array.isArray(raw) || raw.length > GAME_CONSTANTS.MAX_PLAYERS) return;
            const present = new Set(lobby.players.map(p => p.id));
            const excluded = [...new Set(raw.filter((id): id is string => typeof id === 'string' && present.has(id)))];
            // Au moins un joueur du salon doit rester pilier possible : on refuse et on
            // renvoie l'état courant à l'hôte (réconcilie son UI optimiste). On ne regarde
            // pas `isActive` ici (un hôte exclu revenu le premier doit pouvoir régler) :
            // startGame revérifie qu'un pilier possible est bien actif au lancement.
            if (!lobby.players.some(p => !excluded.includes(p.id))) {
                emitLobbyDecksState(io, socket, lobby);
                return;
            }
            lobby.excludedLeaderIds = excluded;
            lobby.updateActivity();

            emitLobbyDecksState(io, null, lobby);
        });
    });

    // Legacy : apps d'avant gameSpeed (cf. utils/legacyTimeMultiplier).
    socket.on('updateTimeMultiplier', (data) => {
        applyHostSetting(socket, data, 'modifier ce réglage', (lobby) => {
            applyGameSpeed(lobby, speedFromLegacyMultiplier(data.timeMultiplier));
        });
    });

    // Check player name before joining lobby
    // withGuards : rate-limit + lobbyCode + try/catch interne. La validation de
    // playerName (spécifique) reste dans le corps, AVANT le lookup lobby, pour
    // préserver l'ordre des erreurs (nom invalide avant "Salon introuvable").
    socket.on('checkPlayerName', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.general,
            requireLobbyCode: true,
        }, ({ lobby }, data) => {
            // Sanitize PUIS valider le résultat (cf. createLobby).
            const sanitizedName = sanitizeInput(data.playerName);
            const nameValidation = validatePlayerName(sanitizedName);
            if (!nameValidation.isValid) {
                socket.emit('error', { message: nameValidation.error || 'Nom invalide', code: ERROR_CODES.INVALID });
                return;
            }

            if (!lobby) {
                socket.emit('error', { message: 'Salon introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }
            // Insensible à la casse : "Loic" bloque "loic" (cf. joinLobby).
            if (lobby.players.find(p => p.name.toLowerCase() === sanitizedName.toLowerCase())) {
                socket.emit('playerNameExists', { playerName: sanitizedName });
            } else {
                socket.emit('playerNameValid');
            }
        });
    });

    // Leave Lobby
    socket.on('leaveLobby', (data: { lobbyCode: string; currentPlayerId: string; }) => {
        withGuards(socket, data, {
            limiter: rateLimiters.general,
            requireLobbyCode: true,
            requirePlayerId: 'currentPlayerId',
            requireLobby: true,
        }, ({ lobby }, data) => {
            logger.debug('leaveLobby', { playerId: data.currentPlayerId, lobbyCode: data.lobbyCode });
            const player = lobby.getPlayer(data.currentPlayerId);
            if (!player) {
                socket.emit('error', { message: 'Joueur introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }

            // Vérifier que le socket correspond au joueur (anti-usurpation)
            if (player.socketId !== socket.id) {
                logger.warn(`Tentative d'usurpation leaveLobby: socket ${socket.id} essaie de quitter pour ${player.name}`);
                socket.emit('error', { message: 'Action non autorisée', code: ERROR_CODES.FORBIDDEN });
                return;
            }

            const lobbyCode = lobby.code;

            // Parité avec kickPlayer : pendant une partie EN COURS, on ne RETIRE pas le
            // joueur de lobby.players. `getLeaderboard` itère sur lobby.players → le retirer
            // lui ferait perdre ses points au calcul final ; et si c'est le pilier, le round
            // figerait faute de saut armé. On le marque donc inactif (comme une déconnexion)
            // et, s'il est pilier, on arme le saut de round différé. Son slot est conservé
            // jusqu'à gameEnded, où le lobby est nettoyé normalement.
            if (lobby.game?.status === GameStatus.IN_PROGRESS) {
                player.isActive = false;
                io.to(lobbyCode).emit('updatePlayersList', { players: serializePlayers(lobby.players) });
                logger.info(`${player.name} a quitté pendant la partie (marqué inactif) dans ${lobbyCode}`);

                const game = lobby.game;
                if (game.currentRound && game.currentRound.leader.id === player.id) {
                    registry.cancelLeaderDisconnectTimeout(lobbyCode);
                    scheduleLeaderSkipTimeout(io, registry, lobbyCode, player.id, player.name);
                    logger.info(`Pilier ${player.name} a quitté, délai avant saut de round`, { lobbyCode });
                }
                socket.leave(lobbyCode);
                return;
            }

            const isLobbyRemoved = LobbyManager.removePlayer(lobby, player);
            io.to(lobbyCode).emit('updatePlayersList', { players: serializePlayers(lobby.players) });
            logger.info(`${player.name} a quitté le lobby ${lobbyCode}`);
            if (isLobbyRemoved) {
                registry.cleanupLobbyResources(lobbyCode);
                socket.leave(lobbyCode);
                logger.info(`Lobby ${lobbyCode} supprimé`);
            }
        });
    });

    // Kick Player from Lobby
    // withGuards fournit rate-limit + lobbyCode + playerId + lobby + host (via
    // requireHostAction, `host` récupéré du ResolvedGuards). Le corps garde son
    // PROPRE try/catch : son message INTERNAL est SPÉCIFIQUE ('Erreur lors de
    // l'expulsion du joueur') et doit être préservé — le catch interne générique de
    // withGuards ne se déclenche donc jamais ici (le inner catch absorbe tout).
    socket.on('kickPlayer', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.kickPlayer,
            requireLobbyCode: true,
            requirePlayerId: 'playerId',
            requireLobby: true,
            requireHostAction: 'expulser des joueurs',
        }, ({ lobby, host }, { lobbyCode, playerId }) => {
            try {
                const kickedPlayer = lobby.getPlayer(playerId);
                if (!kickedPlayer) {
                    socket.emit('error', { message: 'Joueur introuvable', code: ERROR_CODES.NOT_FOUND });
                    return;
                }

                // L'hôte ne peut pas se kick lui-même
                if (kickedPlayer.isHost) {
                    socket.emit('error', { message: 'Impossible d\'expulser l\'hôte', code: ERROR_CODES.FORBIDDEN });
                    return;
                }

                // Pendant qu'une partie est en cours, on refuse TOUT kick :
                // retirer un joueur de lobby.players lui ferait perdre ses scores au
                // calcul du leaderboard (getLeaderboard itère sur lobby.players), et
                // kicker le pilier gèlerait le round. Le host devra attendre la fin de
                // partie ; un joueur déconnecté reste géré par le mécanisme d'inactivité.
                if (lobby.game?.status === GameStatus.IN_PROGRESS) {
                    socket.emit('error', { message: 'Impossible d\'expulser un joueur pendant une partie. Attends la fin de la partie.', code: ERROR_CODES.GAME_IN_PROGRESS });
                    return;
                }

                // Sauvegarder les infos avant suppression
                const kickedSocketId = kickedPlayer.socketId;
                const kickedPlayerName = kickedPlayer.name;

                // Annuler tous les timeouts associés au joueur
                registry.cancelDisconnectTimeout(lobbyCode, kickedPlayerName);
                registry.cancelInactiveTimeout(lobbyCode, kickedPlayerName);

                // Bloquer le joueur pour empêcher la reconnexion immédiate
                registry.blockKickedPlayer(lobbyCode, kickedPlayerName);

                // Retirer le joueur du lobby
                lobby.removePlayer(kickedPlayer);

                // Notifier le joueur kické AVANT de le retirer de la room
                io.to(kickedSocketId).emit('kickedFromLobby', { hostName: host!.name });

                // Retirer le socket de la room Socket.IO
                const kickedSocket = io.sockets.sockets.get(kickedSocketId);
                if (kickedSocket) {
                    kickedSocket.leave(lobbyCode);
                    logger.debug(`Socket ${kickedSocketId} retiré de la room ${lobbyCode}`);
                }

                // Mettre à jour la liste des joueurs pour les autres
                io.to(lobbyCode).emit('updatePlayersList', { players: serializePlayers(lobby.players) });

                logger.info(`Player ${kickedPlayerName} expulsé du lobby ${lobbyCode}`);
            } catch (error) {
                logger.error('Error kicking player', { error: errMessage(error) });
                socket.emit('error', { message: 'Erreur lors de l\'expulsion du joueur', code: ERROR_CODES.INTERNAL });
            }
        });
    });

    // Promote Player to Host
    socket.on('promotePlayer', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.gameAction,
            requireLobbyCode: true,
            requirePlayerId: 'playerId',
            requireLobby: true,
            requireHostAction: 'promouvoir des joueurs',
        }, ({ lobby }, { lobbyCode, playerId }) => {
            const playerToPromote = lobby.getPlayer(playerId);
            if (!playerToPromote) {
                socket.emit('error', { message: 'Joueur introuvable', code: ERROR_CODES.NOT_FOUND });
                return;
            }

            // Ne peut pas se promouvoir soi-même (déjà hôte)
            if (playerToPromote.isHost) {
                socket.emit('error', { message: 'Ce joueur est déjà l\'hôte', code: ERROR_CODES.CONFLICT });
                return;
            }

            // Promote player to host
            lobby.setHost(playerToPromote);
            io.to(lobbyCode).emit('updatePlayersList', { players: serializePlayers(lobby.players) });
            logger.info(`Player ${playerToPromote.name} promu hôte dans ${lobbyCode}`);
        });
    });

    // Start Game
    socket.on('startGame', (data) => {
        withGuards(socket, data, {
            limiter: rateLimiters.gameAction,
            requireLobbyCode: true,
            requireLobby: true,
            requireHostAction: 'lancer la partie',
        }, ({ lobby }, data) => {
            // Vérifier qu'il y a assez de joueurs
            const activePlayers = lobby.players.filter(p => p.isActive);
            if (activePlayers.length < 3) {
                socket.emit('error', { message: 'Il faut au moins 3 joueurs pour lancer la partie', code: ERROR_CODES.INVALID });
                return;
            }

            // Update lobby activity
            lobby.updateActivity();

            // Nettoyer les joueurs vraiment déconnectés avant de démarrer
            ctx.cleanupDisconnectedPlayers(lobby);

            // Revérifier le nombre de joueurs après le nettoyage
            const activePlayersAfterCleanup = lobby.players.filter(p => p.isActive);
            if (activePlayersAfterCleanup.length < 3) {
                socket.emit('error', { message: 'Il faut au moins 3 joueurs pour lancer la partie', code: ERROR_CODES.INVALID });
                return;
            }

            // Au moins un pilier possible : l'hôte a pu exclure tout le monde sauf des
            // joueurs qui ont quitté depuis.
            const excludedLeaders = new Set(lobby.excludedLeaderIds);
            if (!activePlayersAfterCleanup.some(p => !excludedLeaders.has(p.id))) {
                socket.emit('error', { message: 'Au moins un joueur doit pouvoir être pilier', code: ERROR_CODES.INVALID });
                return;
            }

            const game = createGame(lobby);
            lobby.game = game; // Assigner le jeu au lobby

            // Démarrer le premier round automatiquement
            game.nextRound();

            // Envoyer les événements aux clients
            io.to(data.lobbyCode).emit('gameStarted', { game: serializeGame(lobby) });
            if (game.currentRound) {
                io.to(data.lobbyCode).emit('roundStarted', { round: serializeRound(game.currentRound)! });
                armServerTimerForPhase(io, data.lobbyCode, lobby, game.currentRound as Round);
                armLeaderSkipIfDisconnected(io, registry, data.lobbyCode, game.currentRound as Round);
            }
            logger.game.started(data.lobbyCode, activePlayers.length);
        });
    });
}
