import {Game} from "../models/Game";
import { ILobby, GameCard } from '@onskone/shared';

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

    export const getRandomQuestions = (count: number): GameCard[] => {
        // Créer une copie du pool pour ne pas modifier l'original
        const poolCopy = [...questionsPool];
        const selectedQuestions: GameCard[] = [];

        // Sélectionner 'count' questions aléatoires
        for (let i = 0; i < Math.min(count, poolCopy.length); i++) {
            const randomIndex = Math.floor(Math.random() * poolCopy.length);
            selectedQuestions.push(poolCopy[randomIndex]);
            poolCopy.splice(randomIndex, 1); // Éviter les doublons
        }

        return selectedQuestions;
    }

}