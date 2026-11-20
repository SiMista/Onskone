import { randomInt } from 'crypto';
import { DRAWING_IDEA_IDS, DRAWING_PORTRAIT_EVERY, DRAWING_PORTRAIT_ID, type DrawingIdeaPick } from '@onskone/shared';

type RandomInt = (max: number) => number;

/** Fisher-Yates (copie). */
const shuffle = <T>(items: readonly T[], rand: RandomInt): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Tirage des idées de dessin d'une partie (une instance par partie, tenue par Game) :
 * - un portrait de joueur par tranche de DRAWING_PORTRAIT_EVERY manches, à une place
 *   tirée au hasard dans la tranche (pas toujours la 1re manche) ; la tranche est bornée
 *   au nombre de manches de la partie, donc même une partie courte a son portrait. Les
 *   joueurs y passent à tour de rôle (tout le monde avant que quelqu'un y repasse) ;
 * - les autres piochent dans les idées simples mélangées, sans redite tant que la
 *   pioche n'est pas vide.
 */
export class DrawingIdeaPicker {
  private deck: string[] = [];
  private roster: string[] = [];
  /** Manche du portrait de chaque tranche (index de tranche → numéro de manche). */
  private readonly portraitRounds = new Map<number, number>();

  constructor(
    private readonly ideas: readonly string[] = DRAWING_IDEA_IDS,
    private readonly rand: RandomInt = (max) => randomInt(0, max),
  ) {}

  /**
   * `playerIds` : joueurs ACTIFS au moment du tirage (un joueur parti n'est jamais dessiné).
   * `totalRounds` : manches prévues (borne la dernière tranche ; inconnu = tranche pleine).
   */
  pick(roundNumber: number, playerIds: readonly string[], totalRounds = Infinity): DrawingIdeaPick {
    if (roundNumber === this.portraitRoundOf(roundNumber, totalRounds) && playerIds.length > 0) {
      const present = new Set(playerIds);
      this.roster = this.roster.filter(id => present.has(id));
      if (this.roster.length === 0) this.roster = shuffle(playerIds, this.rand);
      return { id: DRAWING_PORTRAIT_ID, playerId: this.roster.shift()! };
    }
    if (this.deck.length === 0) this.deck = shuffle(this.ideas, this.rand);
    return { id: this.deck.shift()! };
  }

  /** Manche du portrait de la tranche de `roundNumber`, tirée à la première manche de la tranche. */
  private portraitRoundOf(roundNumber: number, totalRounds: number): number {
    const block = Math.floor((roundNumber - 1) / DRAWING_PORTRAIT_EVERY);
    let chosen = this.portraitRounds.get(block);
    if (chosen === undefined) {
      const first = block * DRAWING_PORTRAIT_EVERY + 1;
      // Jamais avant la manche en cours (déjà passée), jamais après la fin de la partie.
      const from = Math.max(first, roundNumber);
      const to = Math.max(from, Math.min(first + DRAWING_PORTRAIT_EVERY - 1, totalRounds));
      chosen = from + this.rand(to - from + 1);
      this.portraitRounds.set(block, chosen);
    }
    return chosen;
  }
}
