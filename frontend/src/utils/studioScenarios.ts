import { RoundPhase, type IPlayer } from '@onskone/shared';

// =====================================================================
// Scénarios de la Régie du Studio (DEV) : une VRAIE partie (vrai serveur), jouée par
// les bots avec des réponses et des attributions préparées, jusqu'au point d'arrêt
// choisi ; là, les bots s'arrêtent et rendent la main.
//
// Le pilier est tiré au hasard par le serveur : le script raisonne en RÔLES. A, B,
// C… = les joueurs non-piliers dans l'ordre des places (le même chez tous les
// clients). Le pilier ne connaît pas les auteurs (réponses anonymes) : son bot les
// retrouve par le texte, d'où des réponses toutes différentes.
// =====================================================================

/** Moment où les bots rendent la main. */
export type StudioStop = 'questionSelection' | 'answering' | 'guessing' | 'reveal' | 'similarity' | 'roundEnd' | 'never';

export const STUDIO_STOPS: Record<StudioStop, string> = {
  questionSelection: 'Tableau de dessin (le pilier choisit sa question)',
  answering: 'Pendant les réponses',
  guessing: 'Avant les attributions du pilier',
  reveal: 'Début du reveal',
  similarity: 'Popup de similarité ouverte',
  roundEnd: 'Fin du reveal (avant manche suivante)',
  never: 'Jamais (toute la partie)',
};

/** Rôle d'un joueur non-pilier (index dans l'ordre des places), ou le pilier. */
export type ScenarioRole = number | 'leader';

export interface StudioScenario {
  id: string;
  /** Phase de jeu du cas testé : rubrique du menu de la Régie (scénarios rangés dans l'ordre du jeu). */
  group: string;
  label: string;
  /** Ce qui se passe, en termes de rôles. */
  description: string;
  /** Nombre de joueurs, pilier compris (la Régie ajuste les slots). */
  players: number;
  /** Mode « Devine ma réponse » (activé par l'hôte avant le lancement). */
  guessMyAnswerMode?: boolean;
  /** Réponse de chaque rôle (A, B, C…). Toutes différentes. */
  answers: string[];
  /** « Devine ma réponse » : substitut et réponse qu'il écrit pour le pilier. */
  substitute?: { role: number; answer: string };
  /** Où le pilier pose chaque carte : auteur → joueur désigné (null = personne). */
  guesses: { author: ScenarioRole; holder: ScenarioRole | null }[];
  /** Décisions du pilier sur les similarités, dans l'ordre d'apparition (Oui par défaut). */
  similarityDecisions?: ('confirm' | 'dismiss')[];
  /** Points d'arrêt proposés ; le premier est celui par défaut. */
  stops: StudioStop[];
}

export const STUDIO_SCENARIOS: StudioScenario[] = [
  {
    id: 'whiteboard',
    group: 'Choix de la question',
    label: "Tableau de dessin d'attente",
    description: "Le pilier (tiré au hasard) arrive sur ses cartes, les autres sur le tableau blanc partagé : les bots rendent la main tout de suite, dessine dans plusieurs téléphones. Astuce : vitesse debug, sinon le sablier choisit la question au bout de 45 s. Si tu relances les bots : A « Plage », B « Montagne », C « Ville », sans faute.",
    players: 4,
    answers: ['Plage', 'Montagne', 'Ville'],
    guesses: [{ author: 0, holder: 0 }, { author: 1, holder: 1 }, { author: 2, holder: 2 }],
    stops: ['questionSelection', 'answering', 'never'],
  },
  {
    id: 'similarity',
    group: 'Reveal · similarités',
    label: 'Similarité simple',
    description: "A « Pizza », B « Pizzas », C « Hamburger ». Le pilier pose la carte de A devant B, celle de B devant C, celle de C devant A. En révélant B : raté, mais « Pizza » ressemble à « Pizzas » posé devant C → popup chez le pilier, écrans de B et C allumés.",
    players: 4,
    answers: ['Pizza', 'Pizzas', 'Hamburger'],
    guesses: [{ author: 0, holder: 1 }, { author: 1, holder: 2 }, { author: 2, holder: 0 }],
    similarityDecisions: ['confirm'],
    stops: ['similarity', 'reveal', 'guessing', 'answering', 'roundEnd', 'never'],
  },
  {
    id: 'similarity-swap',
    group: 'Reveal · similarités',
    label: 'Deux similarités (échange)',
    description: "A « Chocolat », B « Du chocolat », C « Vanille ». Le pilier échange A et B, C est juste. Deux popups : le bot dit Oui à la première, Non à la seconde.",
    players: 4,
    answers: ['Chocolat', 'Du chocolat', 'Vanille'],
    guesses: [{ author: 0, holder: 1 }, { author: 1, holder: 0 }, { author: 2, holder: 2 }],
    similarityDecisions: ['confirm', 'dismiss'],
    stops: ['similarity', 'reveal', 'roundEnd', 'never'],
  },
  {
    id: 'unassigned',
    group: 'Reveal · similarités',
    label: 'Carte donnée à personne',
    description: "A « Pizza », B « Pizzas », C « Sushi ». Le pilier pose A devant B, ne donne la carte de B à personne, pose C devant A : C n'a aucune carte, et la popup sur B ne peut citer aucun écran (texte seul).",
    players: 4,
    answers: ['Pizza', 'Pizzas', 'Sushi'],
    guesses: [{ author: 0, holder: 1 }, { author: 1, holder: null }, { author: 2, holder: 0 }],
    similarityDecisions: ['confirm'],
    stops: ['similarity', 'reveal', 'roundEnd', 'never'],
  },
  {
    id: 'leader-card',
    group: 'Reveal · similarités',
    label: 'Devine ma réponse : le pilier juge sa carte',
    description: "Mode « Devine ma réponse », A est substitut et écrit « Pizza » pour le pilier. Réponses : A « Sushi », B « Pizzas », C « Tacos ». Le pilier se donne la carte de B et pose la sienne devant C → popup en fin de tour, sur la carte du pilier, qui cite l'écran de C.",
    players: 4,
    guessMyAnswerMode: true,
    answers: ['Sushi', 'Pizzas', 'Tacos'],
    substitute: { role: 0, answer: 'Pizza' },
    guesses: [
      { author: 1, holder: 'leader' },
      { author: 'leader', holder: 2 },
      { author: 0, holder: 1 },
      { author: 2, holder: 0 },
    ],
    similarityDecisions: ['confirm'],
    stops: ['similarity', 'reveal', 'roundEnd', 'never'],
  },
  {
    id: 'all-wrong',
    group: 'Reveal · résultats',
    label: 'Tout faux, aucune ressemblance',
    description: 'A « Plage », B « Montagne », C « Ville », cartes tournées d\'un cran : que des écrans rouges, aucune popup.',
    players: 4,
    answers: ['Plage', 'Montagne', 'Ville'],
    guesses: [{ author: 0, holder: 1 }, { author: 1, holder: 2 }, { author: 2, holder: 0 }],
    stops: ['reveal', 'roundEnd', 'guessing', 'never'],
  },
  {
    id: 'all-right',
    group: 'Reveal · résultats',
    label: 'Sans faute',
    description: 'A « Plage », B « Montagne », C « Ville », chaque carte devant son auteur : que des écrans verts et des confettis.',
    players: 4,
    answers: ['Plage', 'Montagne', 'Ville'],
    guesses: [{ author: 0, holder: 0 }, { author: 1, holder: 1 }, { author: 2, holder: 2 }],
    stops: ['reveal', 'roundEnd', 'never'],
  },
];

export const findStudioScenario = (id: string | null | undefined): StudioScenario | null =>
  STUDIO_SCENARIOS.find((s) => s.id === id) ?? null;

/** Scénarios rangés par phase de jeu, dans l'ordre de la liste (= l'ordre du jeu). */
export const studioScenarioGroups = (): [group: string, scenarios: StudioScenario[]][] => {
  const groups = new Map<string, StudioScenario[]>();
  STUDIO_SCENARIOS.forEach((sc) => groups.set(sc.group, [...(groups.get(sc.group) ?? []), sc]));
  return [...groups.entries()];
};

/** Lettre d'un rôle : 0 → A, 1 → B… */
export const roleLetter = (role: number): string => String.fromCharCode(65 + role);

/** Joueurs non-piliers dans l'ordre des places (= rôles A, B, C…), identique chez tous. */
export const scenarioRolePlayers = <P extends Pick<IPlayer, 'id'>>(players: P[], leaderId: string): P[] =>
  players.filter((p) => p.id !== leaderId);

/** Libellé du rôle d'un joueur dans le scénario, pour la Régie (« Pilier », « A · Pizza »). */
export const scenarioRoleLabel = (
  scenario: StudioScenario,
  players: Pick<IPlayer, 'id'>[],
  leaderId: string,
  playerId: string,
): string | null => {
  if (playerId === leaderId) return 'Pilier';
  const role = scenarioRolePlayers(players, leaderId).findIndex((p) => p.id === playerId);
  if (role < 0) return null;
  const answer = scenario.answers[role];
  const sub = scenario.substitute?.role === role ? ' · substitut' : '';
  return `${roleLetter(role)}${answer ? ` · ${answer}` : ''}${sub}`;
};

const PHASE_RANK: Record<RoundPhase, number> = {
  [RoundPhase.QUESTION_SELECTION]: 0,
  [RoundPhase.SUBSTITUTE_SELECTION]: 1,
  [RoundPhase.ANSWERING]: 2,
  [RoundPhase.SUBSTITUTE_ANSWERING]: 3,
  [RoundPhase.GUESSING]: 4,
  [RoundPhase.REVEAL]: 5,
};
const STOP_PHASE: Partial<Record<StudioStop, RoundPhase>> = {
  questionSelection: RoundPhase.QUESTION_SELECTION,
  answering: RoundPhase.ANSWERING,
  guessing: RoundPhase.GUESSING,
  reveal: RoundPhase.REVEAL,
};

/**
 * Le point d'arrêt est-il atteint en arrivant dans `phase` ? (Les arrêts pendant le
 * reveal, popup et fin de reveal, sont tranchés par la boucle du pilier.)
 */
export const isPhaseStop = (stop: StudioStop, phase: RoundPhase): boolean => {
  const target = STOP_PHASE[stop];
  return target !== undefined && PHASE_RANK[phase] >= PHASE_RANK[target];
};

/** Auteur (rôle) d'une réponse reçue par le pilier, retrouvé par son texte. */
export const scenarioAuthorOf = (scenario: StudioScenario, text: string): ScenarioRole | null => {
  const norm = (s: string) => s.trim().toLowerCase();
  if (scenario.substitute && norm(scenario.substitute.answer) === norm(text)) return 'leader';
  const role = scenario.answers.findIndex((a) => norm(a) === norm(text));
  return role >= 0 ? role : null;
};

/**
 * Attributions du pilier pour les réponses reçues (slot opaque → joueur), d'après le
 * script. Une réponse inconnue du script (joueur en trop) reste sans attribution.
 */
export const scenarioGuesses = (
  scenario: StudioScenario,
  answers: { id: string; text: string }[],
  rolePlayers: Pick<IPlayer, 'id'>[],
  leaderId: string,
): Record<string, string> => {
  const idOf = (role: ScenarioRole): string | undefined => (role === 'leader' ? leaderId : rolePlayers[role]?.id);
  const guesses: Record<string, string> = {};
  for (const a of answers) {
    const author = scenarioAuthorOf(scenario, a.text);
    if (author === null) continue;
    const holder = scenario.guesses.find((g) => g.author === author)?.holder;
    if (holder === null || holder === undefined) continue;
    const holderId = idOf(holder);
    if (holderId) guesses[a.id] = holderId;
  }
  return guesses;
};
