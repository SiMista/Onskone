import { describe, it, expect } from 'vitest';
import { RoundPhase } from '@onskone/shared';
import {
  STUDIO_SCENARIOS, findStudioScenario, isPhaseStop, scenarioAuthorOf, scenarioGuesses,
  scenarioRoleLabel, scenarioRolePlayers,
} from './studioScenarios';

const players = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }, { id: 'p3' }];

describe('scénarios de Régie : cohérence des scripts', () => {
  for (const sc of STUDIO_SCENARIOS) {
    it(`${sc.label} : jouable tel quel`, () => {
      // Le pilier retrouve les auteurs par le texte : toutes les réponses doivent différer.
      const texts = [...sc.answers, ...(sc.substitute ? [sc.substitute.answer] : [])].map((t) => t.toLowerCase());
      expect(new Set(texts).size).toBe(texts.length);
      // Une réponse par joueur non-pilier.
      expect(sc.answers).toHaveLength(sc.players - 1);
      // Le serveur refuse deux cartes devant le même joueur.
      const holders = sc.guesses.map((g) => g.holder).filter((h) => h !== null);
      expect(new Set(holders).size).toBe(holders.length);
      // Chaque auteur a une consigne (sinon sa carte partirait « à personne » sans le vouloir).
      const authors = new Set(sc.guesses.map((g) => g.author));
      sc.answers.forEach((_, role) => expect(authors.has(role)).toBe(true));
      if (sc.substitute) expect(authors.has('leader')).toBe(true);
      expect(sc.stops.length).toBeGreaterThan(0);
    });
  }
});

describe('scénarios de Régie : logique des bots', () => {
  const sim = findStudioScenario('similarity')!;

  it('rôles A, B, C = non-piliers dans l’ordre des places, quel que soit le pilier', () => {
    expect(scenarioRolePlayers(players, 'p2').map((p) => p.id)).toEqual(['p0', 'p1', 'p3']);
    expect(scenarioRoleLabel(sim, players, 'p2', 'p2')).toBe('Pilier');
    expect(scenarioRoleLabel(sim, players, 'p2', 'p3')).toBe('C · Hamburger');
  });

  it('le pilier retrouve les auteurs par le texte et pose les cartes comme le script', () => {
    // Pilier p0 : A=p1 « Pizza », B=p2 « Pizzas », C=p3 « Hamburger ».
    const received = [{ id: 's1', text: 'Hamburger' }, { id: 's2', text: ' pizza ' }, { id: 's3', text: 'Pizzas' }, { id: 's4', text: 'inconnue' }];
    expect(scenarioGuesses(sim, received, scenarioRolePlayers(players, 'p0'), 'p0'))
      .toEqual({ s2: 'p2', s3: 'p3', s1: 'p1' });
  });

  it('« Devine ma réponse » : la réponse du substitut est celle du pilier', () => {
    const lc = findStudioScenario('leader-card')!;
    expect(scenarioAuthorOf(lc, 'Pizza')).toBe('leader');
    const guesses = scenarioGuesses(lc, [{ id: 'x', text: 'Pizzas' }, { id: 'y', text: 'Pizza' }], scenarioRolePlayers(players, 'p0'), 'p0');
    expect(guesses).toEqual({ x: 'p0', y: 'p3' });
  });

  it('une carte « à personne » reste sans attribution', () => {
    const un = findStudioScenario('unassigned')!;
    expect(scenarioGuesses(un, [{ id: 'b', text: 'Pizzas' }], scenarioRolePlayers(players, 'p0'), 'p0')).toEqual({});
  });

  it('points d’arrêt de phase atteints en arrivant dans la phase, ou après', () => {
    expect(isPhaseStop('guessing', RoundPhase.ANSWERING)).toBe(false);
    expect(isPhaseStop('guessing', RoundPhase.GUESSING)).toBe(true);
    expect(isPhaseStop('guessing', RoundPhase.REVEAL)).toBe(true);
    expect(isPhaseStop('answering', RoundPhase.SUBSTITUTE_SELECTION)).toBe(false);
    // Popup et fin de reveal : tranchés par la boucle du pilier, jamais à l'entrée de phase.
    expect(isPhaseStop('similarity', RoundPhase.REVEAL)).toBe(false);
    expect(isPhaseStop('never', RoundPhase.REVEAL)).toBe(false);
  });
});
