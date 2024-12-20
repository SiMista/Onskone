import {IPlayer} from '../types/IPlayer';
import {v4 as uuidv4} from 'uuid';

export class Player implements IPlayer {
    id: string;
    name: string;
    isHost: boolean;
    score: number;

    constructor(name: string, isHost: boolean = false) { // isHost is false by default
        this.id = uuidv4();
        this.name = name;
        this.isHost = isHost;
        this.score = 0;
    }
}
