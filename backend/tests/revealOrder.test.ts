import { describe, it, expect } from '@jest/globals';
import { buildRevealOrder, tableTurnFrom } from '@onskone/shared';
import type { RevealResult } from '@onskone/shared';
import * as GameManager from '../src/managers/GameManager';
import { TestHelper } from '../src/utils/TestHelper';
import { Round } from '../src/models/Round';
import { getRevealOrder } from '../src/sockets/broadcasting';

/** Résultat minimal : `author` a écrit la réponse, le pilier l'a attribuée à `guessed`. */
function makeResult(author: string, guessed: string): RevealResult {
    return {
        playerId: author,
        playerName: author,
        answer: `réponse de ${author}`,
        guessedPlayerId: guessed,
        guessedPlayerName: guessed,
        correct: author === guessed,
    };
}

const personne = (author: string): RevealResult => ({
    ...makeResult(author, ''),
    guessedPlayerName: 'Personne',
});

// Autour de la table, dans le sens du jeu : A → B → C → D → E (→ A).
const SEATS = ['A', 'B', 'C', 'D', 'E'];

describe('tableTurnFrom', () => {
    it('part du voisin du pilier et le pilier ferme le tour', () => {
        expect(tableTurnFrom(SEATS, 'C')).toEqual(['D', 'E', 'A', 'B', 'C']);
    });

    it('fait le tour quand le pilier est à la dernière place', () => {
        expect(tableTurnFrom(SEATS, 'E')).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it("garde l'ordre des places si le pilier n'y est pas", () => {
        expect(tableTurnFrom(SEATS, 'Z')).toEqual(SEATS);
    });
});

describe('buildRevealOrder', () => {
    it("révèle place par place en partant du voisin du pilier, pas dans l'ordre des réponses", () => {
        // Pilier C. Réponses arrivées dans le désordre ; chaque carte attribuée à un joueur.
        const results = [
            makeResult('B', 'B'), // 0 → carte de B
            makeResult('E', 'A'), // 1 → carte de A
            makeResult('A', 'E'), // 2 → carte de E
            makeResult('D', 'D'), // 3 → carte de D
        ];
        // Tour depuis C : D, E, A, B.
        expect(buildRevealOrder(results, 'C', SEATS)).toEqual([3, 2, 1, 0]);
    });

    it('change de point de départ avec le pilier de la manche', () => {
        const results = [makeResult('A', 'A'), makeResult('C', 'C'), makeResult('E', 'E'), makeResult('D', 'D')];
        // Pilier B : C, D, E, A.
        expect(buildRevealOrder(results, 'B', SEATS)).toEqual([1, 3, 2, 0]);
        // Pilier D (une carte lui est attribuée) : E, A, B, C … puis D en dernier.
        expect(buildRevealOrder(results, 'D', SEATS)).toEqual([2, 0, 1, 3]);
    });

    it("garde la carte que le pilier s'est attribuée pour la fin (Devine ma réponse)", () => {
        const results = [
            makeResult('S', 'C'), // 0 → le pilier C se l'est attribuée
            makeResult('D', 'D'), // 1
            makeResult('B', 'B'), // 2
        ];
        expect(buildRevealOrder(results, 'C', SEATS)).toEqual([1, 2, 0]);
    });

    it('écarte les ciblages "Personne" (révélés en silence)', () => {
        const results = [personne('A'), makeResult('B', 'B'), personne('D')];
        expect(buildRevealOrder(results, 'C', SEATS)).toEqual([1]);
    });

    it("garde la carte d'un joueur qui s'appelle « Personne » ou « Aucun »", () => {
        const named = (author: string, guessedName: string): RevealResult => ({
            ...makeResult(author, 'D'),
            guessedPlayerName: guessedName,
        });
        expect(buildRevealOrder([named('A', 'Personne'), named('B', 'Aucun')], 'C', SEATS)).toEqual([0, 1]);
    });

    it('place un joueur deviné hors des places après le tour, avant le pilier', () => {
        const results = [makeResult('X', 'C'), makeResult('Y', 'Z'), makeResult('A', 'A')];
        expect(buildRevealOrder(results, 'C', SEATS)).toEqual([2, 1, 0]);
    });

    it("départage deux cartes attribuées au même joueur par l'ordre des résultats", () => {
        const results = [makeResult('B', 'D'), makeResult('E', 'A'), makeResult('A', 'D')];
        expect(buildRevealOrder(results, 'C', SEATS)).toEqual([0, 2, 1]);
    });

    it("sans places : l'ordre des réponses, pilier deviné en dernier", () => {
        const results = [makeResult('S', 'C'), makeResult('D', 'D'), makeResult('B', 'B')];
        expect(buildRevealOrder(results, 'C', [])).toEqual([1, 2, 0]);
    });
});

describe('getRevealOrder (serveur)', () => {
    it('suit les places du salon et reste figé sur la manche', () => {
        const lobby = TestHelper.createLobbyWithPlayers(['A', 'B', 'C']);
        const [host, a, b, c] = lobby.players;
        // Le pilier est tiré au hasard (Game.nextRound) : on exclut les autres pour
        // que ce soit forcément l'hôte, sinon le test ne passe qu'une fois sur 4.
        lobby.excludedLeaderIds = [a.id, b.id, c.id];
        const game = GameManager.createGame(lobby);
        game.nextRound(); // manche 1 : seul pilier possible = l'hôte
        const round = game.currentRound as Round;
        expect(round.leader.id).toBe(host.id);

        const results = [makeResult(c.id, c.id), makeResult(a.id, a.id), makeResult(b.id, b.id)];
        // Tour depuis l'hôte : A, B, C.
        expect(getRevealOrder(lobby, round, results)).toEqual([1, 2, 0]);

        // Les places bougent après coup : l'ordre de la manche ne change plus.
        lobby.seatOrder = [host.id, c.id, b.id, a.id];
        expect(getRevealOrder(lobby, round, results)).toEqual([1, 2, 0]);
    });
});
