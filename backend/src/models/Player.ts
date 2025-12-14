import { IPlayer } from '@onskone/shared';
import {v4 as uuidv4} from 'uuid';

export class Player implements IPlayer {
    id: string;
    socketId: string;
    name: string;
    isHost: boolean;
    score: number;
    isActive: boolean;
    avatarId: number;

    constructor(name: string, socketId: string = "", isHost: boolean = false, avatarId: number = 0) {
        this.id = uuidv4();
        this.socketId = socketId;
        this.name = name;
        this.isHost = isHost;
        this.score = 0;
        this.isActive = true; // Nouveau joueur est actif par défaut
        this.avatarId = avatarId;
    }
}
