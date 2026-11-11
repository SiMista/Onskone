import { describe, it, expect } from 'vitest';
import { RoundPhase } from '@onskone/shared';
import {
  shouldPlayPhaseIntro,
  introEndsAt,
  PHASE_INTRO_MS,
  isFreshGameStart,
  gameStartNavState,
  GAME_START_FRESH_MS,
} from './phaseIntro';

const { QUESTION_SELECTION, SUBSTITUTE_SELECTION, ANSWERING, SUBSTITUTE_ANSWERING, GUESSING, REVEAL } = RoundPhase;
const at = (round: number, phase: RoundPhase) => ({ round, phase });

describe('shouldPlayPhaseIntro', () => {
  describe('GUESSING (« Tu es PILIER / JOUEUR »)', () => {
    it('en venant des réponses de la même manche', () => {
      expect(shouldPlayPhaseIntro(at(2, ANSWERING), at(2, GUESSING), false)).toBe(true);
      expect(shouldPlayPhaseIntro(at(2, SUBSTITUTE_ANSWERING), at(2, GUESSING), false)).toBe(true);
    });

    it('jamais à un montage direct dans la phase (reconnexion), même au lancement', () => {
      expect(shouldPlayPhaseIntro(null, at(2, GUESSING), false)).toBe(false);
      expect(shouldPlayPhaseIntro(null, at(1, GUESSING), true)).toBe(false);
    });

    it("jamais en arrivant d'une autre manche (resync qui saute des écrans)", () => {
      expect(shouldPlayPhaseIntro(at(1, ANSWERING), at(2, GUESSING), false)).toBe(false);
      expect(shouldPlayPhaseIntro(at(1, REVEAL), at(2, GUESSING), false)).toBe(false);
    });
  });

  describe('QUESTION_SELECTION (« À ton tour d\'être PILIER »)', () => {
    it('à la manche suivante, après le reveal', () => {
      expect(shouldPlayPhaseIntro(at(1, REVEAL), at(2, QUESTION_SELECTION), false)).toBe(true);
    });

    it("quand le pilier précédent est sauté (nouvelle manche, sans passer par le reveal)", () => {
      expect(shouldPlayPhaseIntro(at(3, QUESTION_SELECTION), at(4, QUESTION_SELECTION), false)).toBe(true);
      expect(shouldPlayPhaseIntro(at(3, GUESSING), at(4, QUESTION_SELECTION), false)).toBe(true);
    });

    it('au premier écran d\'une partie qui vient d\'être lancée', () => {
      expect(shouldPlayPhaseIntro(null, at(1, QUESTION_SELECTION), true)).toBe(true);
    });

    it('jamais à un montage direct sans lancement frais (reconnexion, reprise)', () => {
      expect(shouldPlayPhaseIntro(null, at(1, QUESTION_SELECTION), false)).toBe(false);
      expect(shouldPlayPhaseIntro(null, at(3, QUESTION_SELECTION), false)).toBe(false);
      // Un lancement « frais » ne vaut que pour la manche 1.
      expect(shouldPlayPhaseIntro(null, at(3, QUESTION_SELECTION), true)).toBe(false);
    });
  });

  it("aucune intro pour les autres phases", () => {
    expect(shouldPlayPhaseIntro(at(1, QUESTION_SELECTION), at(1, SUBSTITUTE_SELECTION), false)).toBe(false);
    expect(shouldPlayPhaseIntro(at(1, QUESTION_SELECTION), at(1, ANSWERING), false)).toBe(false);
    expect(shouldPlayPhaseIntro(at(1, GUESSING), at(1, REVEAL), false)).toBe(false);
  });
});

describe('isFreshGameStart', () => {
  const NOW = Date.parse('2026-11-11T20:00:00Z');

  it('vrai juste après le lancement posé par le salon', () => {
    expect(isFreshGameStart(gameStartNavState(NOW), NOW)).toBe(true);
    expect(isFreshGameStart(gameStartNavState(NOW - GAME_START_FRESH_MS + 1), NOW)).toBe(true);
  });

  it('faux une fois la fenêtre passée (rechargement de la page plus tard)', () => {
    expect(isFreshGameStart(gameStartNavState(NOW - GAME_START_FRESH_MS), NOW)).toBe(false);
  });

  it("faux sans état de lancement (reprise depuis l'accueil, lien direct)", () => {
    expect(isFreshGameStart(null, NOW)).toBe(false);
    expect(isFreshGameStart(undefined, NOW)).toBe(false);
    expect(isFreshGameStart({}, NOW)).toBe(false);
    expect(isFreshGameStart({ gameStartedAt: 'hier' }, NOW)).toBe(false);
  });

  it("faux pour un horodatage dans le futur (horloge qui a sauté)", () => {
    expect(isFreshGameStart(gameStartNavState(NOW + 5_000), NOW)).toBe(false);
  });
});

describe('introEndsAt', () => {
  const SHOWN = 1_000_000;
  const QS_MS = PHASE_INTRO_MS[QUESTION_SELECTION]!;
  const intro = { round: 2, phase: QUESTION_SELECTION, shownAt: SHOWN };

  it('durée nominale tant que le départ du timer est inconnu', () => {
    expect(introEndsAt(intro, null)).toBe(SHOWN + QS_MS);
  });

  it("s'arrête au départ du timer quand on arrive en retard sur la phase", () => {
    // /game chargé 2 s après le début de la manche : il ne reste que 1,5 s d'intro.
    const start = SHOWN + QS_MS - 2_000;
    expect(introEndsAt(intro, { round: 2, phase: QUESTION_SELECTION, at: start })).toBe(start);
  });

  it('se termine aussitôt si le timer a déjà démarré', () => {
    const start = SHOWN - 5_000;
    expect(introEndsAt(intro, { round: 2, phase: QUESTION_SELECTION, at: start })).toBe(start);
  });

  it('ne dépasse jamais la durée nominale', () => {
    expect(introEndsAt(intro, { round: 2, phase: QUESTION_SELECTION, at: SHOWN + 60_000 })).toBe(SHOWN + QS_MS);
  });

  it("ignore le timer d'une autre manche ou d'une autre phase", () => {
    expect(introEndsAt(intro, { round: 1, phase: QUESTION_SELECTION, at: SHOWN - 60_000 })).toBe(SHOWN + QS_MS);
    expect(introEndsAt(intro, { round: 2, phase: GUESSING, at: SHOWN - 60_000 })).toBe(SHOWN + QS_MS);
  });
});
