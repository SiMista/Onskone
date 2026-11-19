import {
  WHITEBOARD, buildRevealOrder, isPersonneGuess, isWhiteboardLocalId, whiteboardStrokeId,
  type GameMode, type RevealResult, type WhiteboardStroke,
} from '@onskone/shared';

// =====================================================================
// Aperçu d'écrans du Studio (DEV) : scénarios figés + faux serveur.
//
// Chaque scénario décrit l'état d'une table à un instant donné. Le Studio l'affiche
// sur un ou plusieurs téléphones (iframes /studio/screen), et rejoue les actions des
// écrans (Révéler, Oui/Non, Suivant…) avec `applyScreenEmit`, un mini-serveur qui
// suit les mêmes règles que le vrai (backend/src/sockets/similarityArbitration.ts) :
// on voit les transitions sans lancer de partie ni de backend.
// =====================================================================

export interface ScreenPlayer {
  id: string;
  name: string;
  avatarId: number;
}

/** État de la table, tel que le serveur le diffuse pendant le reveal. */
export interface RevealScreenState {
  results: RevealResult[];
  revealOrder: number[];
  revealed: number[];
  pending: number | null;
  corrections: number[];
  /** Tableau blanc (scénarios `screen: 'whiteboard'`), dans l'ordre de dessin. */
  board?: WhiteboardStroke[];
}

export interface ScreenScenario {
  id: string;
  /** Rubrique de la liste. */
  group: string;
  title: string;
  /** Ce que montre l'écran et ce qu'il faut y vérifier. */
  note: string;
  leader: ScreenPlayer;
  /** Joueurs non-piliers (spectateurs possibles, avec le pilier). */
  players: ScreenPlayer[];
  /** Spectateur affiché par défaut ('table' = tous les téléphones côte à côte). */
  viewer: string;
  mode: GameMode;
  /**
   * Cartes (indices de results) que le serveur jugerait similaires à leur révélation.
   * Le vrai serveur le calcule (areAnswersSimilar) ; ici c'est écrit dans le scénario.
   */
  similarCards: number[];
  initial: RevealScreenState;
  /** Écran montré : le reveal (défaut) ou l'attente du choix de question (tableau blanc). */
  screen?: 'reveal' | 'whiteboard';
}

export const TABLE_VIEWER = 'table';

// ----- Table de référence ---------------------------------------------------
// Léa est pilier. Alice et Bob ont écrit pizza, Charlie hamburger. Léa a posé la
// carte d'Alice devant Bob, celle de Bob devant Charlie, celle de Charlie devant Alice.
const LEA: ScreenPlayer = { id: 'lea', name: 'Léa', avatarId: 4 };
const ALICE: ScreenPlayer = { id: 'alice', name: 'Alice', avatarId: 1 };
const BOB: ScreenPlayer = { id: 'bob', name: 'Bob', avatarId: 2 };
const CHARLIE: ScreenPlayer = { id: 'charlie', name: 'Charlie', avatarId: 3 };
const SEATS = [LEA.id, BOB.id, CHARLIE.id, ALICE.id];

/** `author` a écrit `answer`, le pilier l'a posée devant `holder` (null = « Personne »). */
const card = (author: ScreenPlayer, holder: ScreenPlayer | null, answer: string): RevealResult => ({
  playerId: author.id,
  playerName: author.name,
  playerAvatarId: author.avatarId,
  answer,
  guessedPlayerId: holder?.id ?? '',
  guessedPlayerName: holder?.name ?? 'Aucun',
  guessedPlayerAvatarId: holder?.avatarId ?? 0,
  correct: !!holder && holder.id === author.id,
});

const state = (results: RevealResult[], patch: Partial<RevealScreenState> = {}): RevealScreenState => ({
  results,
  // Même calcul que le serveur : tour de table en partant de la gauche du pilier.
  revealOrder: buildRevealOrder(results, LEA.id, SEATS),
  revealed: results.flatMap((r, i) => (isPersonneGuess(r) ? [i] : [])), // révélés d'office, en silence
  pending: null,
  corrections: [],
  ...patch,
});

// Tour : Bob (0), Charlie (1), Alice (2). Seule la carte de Bob est « similaire ».
const PIZZA_TABLE = [card(ALICE, BOB, 'Pizza'), card(BOB, CHARLIE, 'Pizzas'), card(CHARLIE, ALICE, 'Hamburger')];
// Devine ma réponse : Léa a gardé pour elle la carte de Bob ; la sienne (écrite par
// le substitut) est devant Alice.
const LEADER_KEPT_TABLE = [card(ALICE, BOB, 'Pizza'), card(BOB, LEA, 'Pizzas'), card(LEA, ALICE, 'Sushi')];
// Devine ma réponse, le pilier juge SA carte : Léa s'est donné « Pizzas » (écrit par Bob)
// alors que sa vraie réponse (écrite par le substitut) est devant Alice.
const LEADER_CARD_TABLE = [card(BOB, LEA, 'Pizzas'), card(LEA, ALICE, 'Pizza'), card(ALICE, BOB, 'Sushi')];
// La carte de Bob n'a été donnée à personne : Charlie n'a reçu aucune carte.
const UNASSIGNED_TABLE = [card(ALICE, BOB, 'Pizza'), card(BOB, null, 'Pizzas'), card(CHARLIE, ALICE, 'Hamburger')];

const PIZZA_CAST = { leader: LEA, players: [ALICE, BOB, CHARLIE], similarCards: [0] };

// ----- Tableau blanc --------------------------------------------------------
// Couleur de stylo fixe par joueur de l'aperçu (le vrai serveur la tire au hasard).
const PREVIEW_CAST = [LEA, ALICE, BOB, CHARLIE];
export const previewWhiteboardColor = (playerId: string): number =>
  (Math.max(0, PREVIEW_CAST.findIndex((p) => p.id === playerId)) * 3 + 1) % WHITEBOARD.PRIMARY_COLOR_COUNT;

/** Cercle (rond à l'écran : le tableau est 3:4, d'où l'axe y écrasé). */
const ring = (cx: number, cy: number, r: number, from = 0, to = 2 * Math.PI, n = 32): number[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * 0.75 * Math.sin(a))];
  }).flat();

const drawn = (author: ScreenPlayer, localId: string, points: number[]): WhiteboardStroke => {
  const color = previewWhiteboardColor(author.id);
  return { id: whiteboardStrokeId(color, localId), color, points };
};

/** Un soleil (Alice), une maison (Charlie), un smiley (Bob). */
function busyBoard(): WhiteboardStroke[] {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * 2 * Math.PI;
    return drawn(ALICE, `ray${i}`, [
      Math.round(250 + 120 * Math.cos(a)), Math.round(200 + 90 * Math.sin(a)),
      Math.round(250 + 165 * Math.cos(a)), Math.round(200 + 124 * Math.sin(a)),
    ]);
  });
  return [
    drawn(ALICE, 'sun', ring(250, 200, 90)),
    ...rays,
    drawn(CHARLIE, 'house', [560, 760, 560, 560, 715, 450, 870, 560, 870, 760, 560, 760]),
    drawn(CHARLIE, 'door', [680, 760, 680, 660, 750, 660, 750, 760]),
    drawn(BOB, 'face', ring(300, 680, 130)),
    drawn(BOB, 'eye1', [255, 640]),
    drawn(BOB, 'eye2', [345, 640]),
    drawn(BOB, 'smile', ring(300, 690, 70, 0.15 * Math.PI, 0.85 * Math.PI, 12)),
  ];
}

export const SCREEN_SCENARIOS: ScreenScenario[] = [
  {
    id: 'sim-full-round',
    group: 'Reveal · similarité',
    title: 'Tour complet avec une similarité',
    note: "Toute la table, au début du reveal. Clique « Révéler » sur le téléphone de Léa : la carte de Bob (« Pizza », écrite par Alice) ressemble à ce que Bob a écrit (« Pizzas »), posé devant Charlie. Charlie s'allume, Léa tranche Oui/Non, puis Bob voit qui a écrit sa carte.",
    ...PIZZA_CAST,
    viewer: TABLE_VIEWER,
    mode: 'local',
    initial: state(PIZZA_TABLE),
  },
  {
    id: 'sim-pending',
    group: 'Reveal · similarité',
    title: 'Popup en attente (pilier)',
    note: "Carte de Bob révélée, similarité en attente. Léa : la popup cite l'écran de Charlie avec les deux textes. C'est aussi ce que voit un pilier qui recharge pendant la popup.",
    ...PIZZA_CAST,
    viewer: LEA.id,
    mode: 'local',
    initial: state(PIZZA_TABLE, { revealed: [0], pending: 0 }),
  },
  {
    id: 'sim-compared-phone',
    group: 'Reveal · similarité',
    title: 'Téléphone comparé (Charlie)',
    note: "Similarité en attente sur la carte de Bob : l'écran de Charlie s'assombrit et sa carte clignote (« Le pilier compare avec ta carte »). Bob reste « à révéler », Alice n'a rien.",
    ...PIZZA_CAST,
    viewer: CHARLIE.id,
    mode: 'local',
    initial: state(PIZZA_TABLE, { revealed: [0], pending: 0 }),
  },
  {
    id: 'sim-confirmed',
    group: 'Reveal · similarité',
    title: 'Similarité validée (Oui)',
    note: 'Après le « Oui » : la carte de Bob passe en vert sur son téléphone, le pilier est passé à Charlie.',
    ...PIZZA_CAST,
    viewer: BOB.id,
    mode: 'local',
    initial: state(PIZZA_TABLE, { revealed: [0], corrections: [0] }),
  },
  {
    id: 'sim-leader-kept',
    group: 'Reveal · similarité',
    title: 'Le pilier a gardé la carte (Devine ma réponse)',
    note: "Ce que Bob a écrit est la carte que Léa s'est donnée : la popup dit « la carte que tu t'es donnée » et recopie son texte (elle ne s'affiche qu'en fin de tour).",
    leader: LEA,
    players: [ALICE, BOB],
    similarCards: [0],
    viewer: LEA.id,
    mode: 'local',
    initial: state(LEADER_KEPT_TABLE, { revealed: [0], pending: 0 }),
  },
  {
    id: 'sim-leader-card',
    group: 'Reveal · similarité',
    title: 'Le pilier juge sa propre carte (Devine ma réponse)',
    note: "Fin du tour : la carte que Léa s'est donnée (« Pizzas », écrite par Bob) ressemble à sa vraie réponse, posée devant Alice. Vue « carte du pilier » en grand, popup qui cite l'écran d'Alice.",
    leader: LEA,
    players: [ALICE, BOB],
    similarCards: [0],
    viewer: LEA.id,
    mode: 'local',
    initial: state(LEADER_CARD_TABLE, { revealed: [2, 1, 0], pending: 0 }),
  },
  {
    id: 'sim-unassigned',
    group: 'Reveal · similarité',
    title: 'Vraie réponse donnée à personne',
    note: "Ce que Bob a écrit n'a été posé devant personne : la popup montre seulement le texte (« Même réponse que celle-ci ? »).",
    ...PIZZA_CAST,
    viewer: LEA.id,
    mode: 'local',
    initial: state(UNASSIGNED_TABLE, { revealed: [0, 1], pending: 0 }),
  },
  {
    id: 'sim-remote',
    group: 'Reveal · similarité',
    title: 'À distance : popup en attente',
    note: 'Partie à distance : une seule carte à la fois. Léa : popup « la carte donnée à Charlie » + texte. Les autres : carte pas encore colorée, en attente du pilier.',
    ...PIZZA_CAST,
    viewer: LEA.id,
    mode: 'remote',
    initial: state(PIZZA_TABLE, { revealed: [0], pending: 0 }),
  },
  {
    id: 'phone-next',
    group: 'Reveal · téléphones',
    title: 'Prochain joueur à révéler',
    note: "Début du reveal : l'écran de Bob (premier du tour) s'assombrit, sa carte clignote en jaune et le téléphone vibre.",
    ...PIZZA_CAST,
    viewer: BOB.id,
    mode: 'local',
    initial: state(PIZZA_TABLE),
  },
  {
    id: 'phone-no-card',
    group: 'Reveal · téléphones',
    title: 'Aucune carte attribuée',
    note: "Léa n'a posé aucune carte devant Charlie : son écran le dit, puis passe au rouge.",
    ...PIZZA_CAST,
    viewer: CHARLIE.id,
    mode: 'local',
    initial: state(UNASSIGNED_TABLE, { revealed: [1] }),
  },
  {
    id: 'whiteboard-intro',
    group: 'Attente · tableau blanc',
    title: 'Tableau vide (intro)',
    note: "Léa choisit sa question. Chez les autres : la consigne s'affiche au centre, monte, puis le tableau apparaît. Dessine sur un téléphone, les autres le voient en direct ; « Annuler » retire ton dernier trait partout.",
    ...PIZZA_CAST,
    viewer: TABLE_VIEWER,
    mode: 'local',
    screen: 'whiteboard',
    initial: state([], { board: [] }),
  },
  {
    id: 'whiteboard-busy',
    group: 'Attente · tableau blanc',
    title: 'Tableau déjà rempli',
    note: "Ce que retrouve un joueur qui revient en cours de route : le dessin de toute la table, chacun dans sa couleur. Ses propres traits restent annulables.",
    ...PIZZA_CAST,
    viewer: BOB.id,
    mode: 'local',
    screen: 'whiteboard',
    initial: state([], { board: busyBoard() }),
  },
];

export const getScenario = (id: string | null): ScreenScenario =>
  SCREEN_SCENARIOS.find((s) => s.id === id) ?? SCREEN_SCENARIOS[0];

/** Tous les spectateurs possibles d'un scénario : le pilier puis les joueurs. */
export const scenarioViewers = (scenario: ScreenScenario): ScreenPlayer[] =>
  // Tableau blanc : le pilier choisit sa question, son écran n'est pas celui-là.
  scenario.screen === 'whiteboard' ? scenario.players : [scenario.leader, ...scenario.players];

/** Évènement « serveur » à rejouer chez les téléphones de l'aperçu. */
export interface PreviewServerEvent {
  event: 'answerRevealed' | 'revealCursorAdvanced' | 'whiteboardState' | 'whiteboardStroke' | 'whiteboardStrokeRemoved';
  data: unknown;
  /** Seul ce téléphone le reçoit (réponse à sa demande). */
  to?: string;
  /** Tous sauf ce téléphone (pas d'écho à l'auteur, comme le vrai serveur). */
  except?: string;
}

/**
 * Faux serveur de l'aperçu : applique un envoi d'un téléphone (`event`, `payload`)
 * à l'état de la table. Mêmes règles que le vrai pour le reveal et la similarité :
 * révéler une autre carte sans trancher vaut un « Non », une décision ne vaut que
 * pour la carte en attente. Renvoie le nouvel état, les évènements à diffuser et une
 * ligne de journal.
 */
export const applyScreenEmit = (
  scenario: ScreenScenario,
  current: RevealScreenState,
  event: string,
  payload: unknown,
  /** Téléphone (id du joueur) qui a envoyé l'évènement. */
  from?: string,
): { state: RevealScreenState; events: PreviewServerEvent[]; log: string } => {
  const board = applyWhiteboardEmit(current, event, payload, from);
  if (board) return board;

  const index = (payload as { answerIndex?: unknown } | undefined)?.answerIndex;
  const nameOf = (i: number) => current.results[i]?.guessedPlayerName ?? `#${i}`;

  if (event === 'revealAnswer' && typeof index === 'number') {
    if (current.revealed.includes(index) || !current.results[index]) {
      return { state: current, events: [], log: 'déjà révélée : ignoré' };
    }
    const revealed = [...current.revealed, index];
    if (isPersonneGuess(current.results[index])) {
      return { state: { ...current, revealed }, events: [], log: 'carte « Personne » révélée en silence' };
    }
    const dropped = current.pending !== null && current.pending !== index;
    const opens = scenario.similarCards.includes(index) && !current.corrections.includes(index);
    const next = { ...current, revealed, pending: opens ? index : dropped ? null : current.pending };
    return {
      state: next,
      events: [{ event: 'answerRevealed', data: { revealedIndex: index, revealedIndices: revealed, roundNumber: 1 } }],
      log: `carte de ${nameOf(index)} révélée${opens ? ' → similarité à arbitrer' : ''}${dropped ? ' (similarité précédente abandonnée = Non)' : ''}`,
    };
  }

  if ((event === 'confirmSimilarity' || event === 'dismissSimilarity') && typeof index === 'number') {
    if (current.pending !== index) return { state: current, events: [], log: 'rien en attente sur cette carte : ignoré' };
    const confirmed = event === 'confirmSimilarity';
    return {
      state: {
        ...current,
        pending: null,
        corrections: confirmed ? [...current.corrections, index] : current.corrections,
      },
      events: [],
      log: confirmed ? `Oui : carte de ${nameOf(index)} validée (+1 au pilier)` : `Non : carte de ${nameOf(index)} reste fausse`,
    };
  }

  if (event === 'advanceRevealCursor') {
    const nextIndex = (payload as { nextIndex?: unknown } | undefined)?.nextIndex;
    return {
      state: current,
      events: [{ event: 'revealCursorAdvanced', data: { nextIndex } }],
      log: `à distance : tout le monde passe à la carte ${typeof nextIndex === 'number' && nextIndex >= 0 ? `de ${nameOf(nextIndex)}` : 'finale'}`,
    };
  }

  if (event === 'nextRound') return { state: current, events: [], log: 'manche suivante (hors aperçu)' };
  // Sablier caché de l'attente : il redemande son état chaque seconde, rien à journaliser.
  if (event === 'requestTimerState') return { state: current, events: [], log: '' };
  return { state: current, events: [], log: 'non simulé dans l’aperçu' };
};

/**
 * Faux serveur du tableau blanc (mêmes règles que backend/src/sockets/handlers/
 * whiteboardHandlers.ts, sans les limites d'encre). null = évènement d'un autre écran.
 * Un ajout de points à un trait existant ne laisse pas de ligne de journal (log vide).
 */
const applyWhiteboardEmit = (
  current: RevealScreenState,
  event: string,
  payload: unknown,
  from?: string,
): { state: RevealScreenState; events: PreviewServerEvent[]; log: string } | null => {
  const data = (payload ?? {}) as { playerId?: unknown; strokeId?: unknown; strokeIds?: unknown; points?: unknown };
  const playerId = typeof data.playerId === 'string' ? data.playerId : from ?? '';
  const color = previewWhiteboardColor(playerId);
  const board = current.board ?? [];

  if (event === 'getWhiteboard') {
    return {
      state: current,
      events: [{ event: 'whiteboardState', data: { roundNumber: 1, myColor: color, strokes: board }, to: from }],
      log: `tableau envoyé (${board.length} traits)`,
    };
  }
  if (event === 'whiteboardDraw') {
    if (!isWhiteboardLocalId(data.strokeId) || !Array.isArray(data.points)) return { state: current, events: [], log: 'trait invalide : ignoré' };
    const id = whiteboardStrokeId(color, data.strokeId);
    const points = data.points as number[];
    const known = board.some((st) => st.id === id);
    const next = known
      ? board.map((st) => (st.id === id ? { ...st, points: [...st.points, ...points] } : st))
      : [...board, { id, color, points: [...points] }];
    return {
      state: { ...current, board: next },
      events: [{ event: 'whiteboardStroke', data: { roundNumber: 1, stroke: { id, color, points } }, except: from }],
      log: known ? '' : 'nouveau trait',
    };
  }
  if (event === 'whiteboardUndo') {
    const localIds = data.strokeIds;
    if (!Array.isArray(localIds) || !localIds.every(isWhiteboardLocalId)) return { state: current, events: [], log: 'annulation invalide : ignorée' };
    const strokeIds = localIds.map((localId) => whiteboardStrokeId(color, localId)).filter((id) => board.some((st) => st.id === id));
    if (strokeIds.length === 0) return { state: current, events: [], log: 'trait inconnu : ignoré' };
    return {
      state: { ...current, board: board.filter((st) => !strokeIds.includes(st.id)) },
      events: [{ event: 'whiteboardStrokeRemoved', data: { roundNumber: 1, strokeIds }, except: from }],
      log: 'geste annulé',
    };
  }
  return null;
};
