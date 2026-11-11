import { describe, it, expect } from 'vitest';
import { dragSteps, moveAround, seatPositionAt } from './seatDrag';

const SIX = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('moveAround', () => {
  it('vers un voisin : échange les deux, personne d\'autre ne bouge', () => {
    expect(moveAround(SIX, 2, 1)).toEqual(['a', 'b', 'd', 'c', 'e', 'f']);
    expect(moveAround(SIX, 2, -1)).toEqual(['a', 'c', 'b', 'd', 'e', 'f']);
  });

  it('pas de bord à la place n°1 : la dernière place et la première sont voisines', () => {
    // Avant : la table entière tournait d'une place.
    expect(moveAround(SIX, 0, -1)).toEqual(['f', 'b', 'c', 'd', 'e', 'a']);
    expect(moveAround(SIX, 5, 1)).toEqual(['f', 'b', 'c', 'd', 'e', 'a']);
  });

  it('plus loin : seuls les joueurs croisés reculent d\'une place, même à travers la place n°1', () => {
    expect(moveAround(SIX, 1, 3)).toEqual(['a', 'c', 'd', 'e', 'b', 'f']);
    // b recule de 2 en passant par la place n°1 : a et f, croisés, avancent d'une place.
    expect(moveAround(SIX, 1, -2)).toEqual(['f', 'a', 'c', 'd', 'e', 'b']);
  });

  it('ne modifie pas le tableau reçu, et 0 pas = même ordre', () => {
    const ids = [...SIX];
    expect(moveAround(ids, 3, 0)).toEqual(SIX);
    moveAround(ids, 3, 2);
    expect(ids).toEqual(SIX);
  });
});

describe('dragSteps', () => {
  it('reste en place tant que la frontière n\'est pas franchie avec de la marge', () => {
    expect(dragSteps(2, 2, 6)).toBe(0);
    expect(dragSteps(2, 2.6, 6)).toBe(0);
    expect(dragSteps(2, 1.4, 6)).toBe(0);
  });

  it('bascule d\'une place une fois la marge passée, dans le bon sens', () => {
    expect(dragSteps(2, 2.7, 6)).toBe(1);
    expect(dragSteps(2, 1.3, 6)).toBe(-1);
  });

  it('prend le chemin le plus court autour de la table', () => {
    // De la place n°1 vers la dernière : 1 pas en arrière, pas 5 en avant.
    expect(dragSteps(0, 5, 6)).toBe(-1);
    expect(dragSteps(5, 0, 6)).toBe(1);
    expect(dragSteps(1, 5, 6)).toBe(-2);
  });
});

describe('seatPositionAt', () => {
  const C = 160;
  it('0 en bas, puis sens horaire à l\'écran (gauche, haut, droite)', () => {
    expect(seatPositionAt(C, C + 100, C, 4)).toBeCloseTo(0);
    expect(seatPositionAt(C - 100, C, C, 4)).toBeCloseTo(1);
    expect(seatPositionAt(C, C - 100, C, 4)).toBeCloseTo(2);
    expect(seatPositionAt(C + 100, C, C, 4)).toBeCloseTo(3);
  });
});
