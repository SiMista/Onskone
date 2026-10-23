import { describe, it, expect } from '@jest/globals';
import type { GameCard } from '@onskone/shared';
import { Game } from '../src/models/Game';
import { TestHelper } from '../src/utils/TestHelper';

const card = (theme: string, ...questions: string[]): GameCard => ({
    category: 'FUN',
    theme,
    subject: theme,
    questions,
});

const newGame = (cards: GameCard[]) => new Game(TestHelper.createLobbyWithPlayers(['A', 'B']), cards);

describe('Questions déjà jouées', () => {
    it('propose toutes les cartes tant que rien n\'a été joué', () => {
        const cards = [card('a', 'a1', 'a2'), card('b', 'b1', 'b2')];
        expect(newGame(cards).getSelectableCards()).toEqual(cards);
    });

    it('garde une carte dont une seule question a été jouée (l\'autre reste dispo)', () => {
        const a = card('a', 'a1', 'a2');
        const b = card('b', 'b1', 'b2');
        const game = newGame([a, b]);
        game.usedQuestions.add('a1');
        expect(game.getSelectableCards()).toEqual([a, b]);
    });

    it('retire une carte dont les deux questions ont été jouées', () => {
        const a = card('a', 'a1', 'a2');
        const b = card('b', 'b1', 'b2');
        const game = newGame([a, b]);
        game.usedQuestions.add('a1');
        game.usedQuestions.add('a2');
        expect(game.getSelectableCards()).toEqual([b]);
    });

    it('recycle le deck quand tout est joué (jamais de pool vide)', () => {
        const cards = [card('a', 'a1', 'a2')];
        const game = newGame(cards);
        game.usedQuestions.add('a1');
        game.usedQuestions.add('a2');
        expect(game.getSelectableCards()).toEqual(cards);
        expect(game.usedQuestions.size).toBe(0);
    });

    it('une question partagée par deux cartes est jouée pour les deux', () => {
        const a = card('a', 'same', 'a2');
        const b = card('b', 'same', 'b2');
        const game = newGame([a, b]);
        game.usedQuestions.add('same');
        game.usedQuestions.add('a2');
        expect(game.getSelectableCards()).toEqual([b]);
    });
});
