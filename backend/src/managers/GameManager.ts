import {Game} from "../models/Game";
import {ILobby} from "../types/ILobby";

export type GameCard = {
    category: string;
    question: string[];
}

export namespace GameManager {
    const loadGameCards = (questionsFilePath: string): GameCard[] => {
        const fs = require('fs');
        const questions = fs.readFileSync(questionsFilePath);
        return JSON.parse(questions) as GameCard[];
    }

    let questionsPool: GameCard[] = loadGameCards('src/data/questions.json');

    export const createGame = (lobby: ILobby): Game => {
        const game = new Game(lobby, questionsPool);
        game.start();
        return game;
    }

}