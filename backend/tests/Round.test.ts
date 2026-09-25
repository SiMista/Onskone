import { describe, it, expect } from '@jest/globals';
import { Round } from '../src/models/Round';
import { RoundPhase, IPlayer, GameCard } from '@onskone/shared';

const leader: IPlayer = {
  id: 'leader-1',
  name: 'Leader',
  isHost: true,
  isActive: true,
  avatarId: 0,
};

const card: GameCard = {
  category: 'FUN',
  theme: 'THEME',
  subject: 'Subject',
  questions: ['q1', 'q2', 'q3'],
};

/** Drive nextPhase() until it stops advancing, collecting the phase sequence. */
function walkPhases(round: Round): RoundPhase[] {
  const seq: RoundPhase[] = [round.phase];
  // Cap iterations well above the longest chain to guard against an infinite loop.
  for (let i = 0; i < 20; i++) {
    const before = round.phase;
    round.nextPhase();
    if (round.phase === before) break;
    seq.push(round.phase);
  }
  return seq;
}

describe('Round.nextPhase phase machine', () => {
  it('starts in QUESTION_SELECTION', () => {
    expect(new Round(1, leader, card).phase).toBe(RoundPhase.QUESTION_SELECTION);
    expect(new Round(1, leader, card, true).phase).toBe(RoundPhase.QUESTION_SELECTION);
  });

  it('walks the Classique sequence (no substitute)', () => {
    const round = new Round(1, leader, card, false);
    expect(walkPhases(round)).toEqual([
      RoundPhase.QUESTION_SELECTION,
      RoundPhase.ANSWERING,
      RoundPhase.GUESSING,
      RoundPhase.REVEAL,
    ]);
  });

  it('walks the "Devine ma réponse" sequence (with substitute)', () => {
    const round = new Round(1, leader, card, true);
    expect(walkPhases(round)).toEqual([
      RoundPhase.QUESTION_SELECTION,
      RoundPhase.SUBSTITUTE_SELECTION,
      RoundPhase.ANSWERING,
      RoundPhase.SUBSTITUTE_ANSWERING,
      RoundPhase.GUESSING,
      RoundPhase.REVEAL,
    ]);
  });

  it('is idempotent once REVEAL is reached', () => {
    const round = new Round(1, leader, card, false);
    walkPhases(round);
    expect(round.phase).toBe(RoundPhase.REVEAL);
    round.nextPhase();
    round.nextPhase();
    expect(round.phase).toBe(RoundPhase.REVEAL);
  });

  it('resets the per-phase timer bookkeeping on each transition', () => {
    const round = new Round(1, leader, card, false);
    round.timerEnd = new Date();
    round.timerStartedAt = 123456;
    round.timerDuration = 45;

    round.nextPhase();

    expect(round.phase).toBe(RoundPhase.ANSWERING);
    expect(round.timerEnd).toBeNull();
    expect(round.timerStartedAt).toBeUndefined();
    expect(round.timerDuration).toBeUndefined();
  });
});

describe('Round.patchAnswerSlotText (réponse tardive en fenêtre de grâce)', () => {
  const players: IPlayer[] = [
    leader,
    { id: 'p1', name: 'Alice', isHost: false, isActive: true, avatarId: 1 },
    { id: 'p2', name: 'Bob', isHost: false, isActive: true, avatarId: 2 },
  ];

  /** Round arrivé en GUESSING avec un joueur resté sans réponse (placeholder). */
  function roundInGuessing(): Round {
    const round = new Round(1, leader, card, false);
    round.selectedQuestion = 'q1';
    round.addAnswer('p1', 'la réponse de Alice');
    round.fillMissingAnswers(
      players.filter(p => p.id !== leader.id),
      "n'a pas répondu à temps",
    );
    round.nextPhase(); // QUESTION_SELECTION -> ANSWERING
    round.nextPhase(); // ANSWERING -> GUESSING
    round.prepareGuessing();
    return round;
  }

  it('corrige le texte sans changer le slotId ni l\'ordre du pool', () => {
    const round = roundInGuessing();
    const before = round.getOrderedGuessingAnswers();
    const slotBefore = before.find(a => a.ownerId === 'p2');
    expect(slotBefore).toBeDefined();

    expect(round.patchAnswerSlotText('p2', 'ma vraie réponse')).toBe(true);

    const after = round.getOrderedGuessingAnswers();
    expect(after.map(a => a.id)).toEqual(before.map(a => a.id));
    expect(after.find(a => a.id === slotBefore!.id)?.text).toBe('ma vraie réponse');
  });

  it("cesse de révéler l'auteur une fois le placeholder remplacé", () => {
    const round = roundInGuessing();
    const slotId = round.slotForAuthor('p2');
    expect(round.getOrderedGuessingAnswers().find(a => a.id === slotId)?.ownerId).toBe('p2');

    round.patchAnswerSlotText('p2', 'ma vraie réponse');

    expect(round.getOrderedGuessingAnswers().find(a => a.id === slotId)?.ownerId).toBeUndefined();
    // Le slot reste attribuable : l'auteur réel est toujours connu côté serveur.
    expect(round.authorForSlot(slotId!)).toBe('p2');
  });

  it('renvoie false si le pool n\'est pas encore construit', () => {
    const round = new Round(1, leader, card, false);
    round.addAnswer('p2', 'réponse');
    expect(round.patchAnswerSlotText('p2', 'autre')).toBe(false);
  });
});

describe('phaseEndedAt — fenêtre de grâce des phases de saisie', () => {
  it('horodate la sortie de ANSWERING (mode classique)', () => {
    const round = new Round(1, leader, card, false);
    round.nextPhase(); // -> ANSWERING
    expect(round.phaseEndedAt).toBeUndefined();

    round.nextPhase(); // ANSWERING -> GUESSING
    expect(round.phase).toBe(RoundPhase.GUESSING);
    expect(round.phaseEndedAt).toEqual(expect.any(Number));
  });

  it("horodate AUSSI la sortie de SUBSTITUTE_ANSWERING (mode « Devine ma réponse »)", () => {
    // Régression : seule la sortie d'ANSWERING était horodatée. Le substitut qui
    // validait au moment de la bascule voyait donc sa réponse rejetée (hors fenêtre
    // de grâce), et le PILIER héritait d'un « n'a pas répondu à temps » à la place
    // de sa propre réponse.
    const round = new Round(1, leader, card, true);
    round.nextPhase(); // -> SUBSTITUTE_SELECTION
    round.nextPhase(); // -> ANSWERING
    round.nextPhase(); // -> SUBSTITUTE_ANSWERING
    expect(round.phase).toBe(RoundPhase.SUBSTITUTE_ANSWERING);

    // On neutralise l'horodatage laissé par la sortie d'ANSWERING : sans ça le test
    // passerait même si SUBSTITUTE_ANSWERING n'horodatait rien (valeur héritée).
    round.phaseEndedAt = undefined;

    round.nextPhase(); // SUBSTITUTE_ANSWERING -> GUESSING
    expect(round.phase).toBe(RoundPhase.GUESSING);
    expect(round.phaseEndedAt).toEqual(expect.any(Number));
  });

  it("n'horodate pas les phases sans saisie", () => {
    const round = new Round(1, leader, card, false);
    round.nextPhase(); // QUESTION_SELECTION -> ANSWERING
    expect(round.phaseEndedAt).toBeUndefined();
  });

  it('un nouveau round repart sans fenêtre de grâce ouverte', () => {
    expect(new Round(2, leader, card, true).phaseEndedAt).toBeUndefined();
  });
});

describe('patchAnswerSlotText — réponse tardive du substitut', () => {
  it("corrige le slot du PILIER (c'est en son nom que le substitut écrit)", () => {
    const round = new Round(1, leader, card, true);
    round.addAnswer('p2', 'réponse de p2');
    round.setSubstitutePlayer('p2');
    round.setSubstituteAnswer('[NO_RESPONSE] Bob n\'a pas répondu à temps');
    round.prepareGuessing();

    // Le pool porte bien une entrée au nom du pilier.
    const leaderSlot = round.slotForAuthor(leader.id);
    expect(leaderSlot).toBeDefined();

    expect(round.patchAnswerSlotText(leader.id, 'la vraie réponse')).toBe(true);
    expect(round.getOrderedGuessingAnswers().find(a => a.id === leaderSlot)?.text)
      .toBe('la vraie réponse');
  });
});
