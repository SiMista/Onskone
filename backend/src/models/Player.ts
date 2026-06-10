import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from 'crypto';
import type { ServerPlayer } from '../types/ServerPlayer.js';

export class Player implements ServerPlayer {
    id: string;
    socketId: string;
    name: string;
    isHost: boolean;
    isActive: boolean;
    avatarId: number;
    /**
     * Secret de reconnexion. SERVER-ONLY : jamais sérialisé vers les clients
     * (omis par serializePlayer) et émis UNIQUEMENT au propriétaire via
     * lobbyCreated/joinedLobby. Sert à autoriser une reconnexion sans dépendre
     * du nom / UUID publics (anti-usurpation pendant la fenêtre de déconnexion).
     */
    reconnectToken: string;
    // Note: score est optionnel dans IPlayer et n'est pas utilisé ici
    // Les scores sont stockés dans Round.scores pour chaque round

    constructor(name: string, socketId: string = "", isHost: boolean = false, avatarId: number = 0) {
        this.id = uuidv4();
        this.socketId = socketId;
        this.name = name;
        this.isHost = isHost;
        this.isActive = true; // Nouveau joueur est actif par défaut
        this.avatarId = avatarId;
        this.reconnectToken = randomUUID();
    }
}
