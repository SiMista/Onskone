import { IPlayer } from '@onskone/shared';
import {v4 as uuidv4} from 'uuid';

export class Player implements IPlayer {
    id: string;
    socketId: string;
    name: string;
    isHost: boolean;
    isActive: boolean;
    avatarId: number;
    // Note: score est optionnel dans IPlayer et n'est pas utilisé ici
    // Les scores sont stockés dans Round.scores pour chaque round

    constructor(name: string, socketId: string = "", isHost: boolean = false, avatarId: number = 0) {
        this.id = uuidv4();
        this.socketId = socketId;
        this.name = name;
        this.isHost = isHost;
        this.isActive = true; // Nouveau joueur est actif par défaut
        this.avatarId = avatarId;
    }
}
