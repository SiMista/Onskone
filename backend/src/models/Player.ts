import { IPlayer } from '@onskone/shared';
import {v4 as uuidv4} from 'uuid';

export class Player implements IPlayer {
    id: string;
    socketId: string;
    name: string;
    isHost: boolean;
    score: number;

    constructor(name: string, socketId: string = "", isHost: boolean = false) { // isHost is false by default
        this.id = uuidv4();
        this.socketId = socketId;
        this.name = name;
        this.isHost = isHost;
        this.score = 0;
    }
}
