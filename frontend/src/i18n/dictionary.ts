import type { ReactNode } from 'react';

/**
 * Forme typée du dictionnaire d'i18n. Chaque langue (fr.ts, en.ts) exporte un
 * objet conforme à cette interface - le compilateur force la complétude.
 *
 * Conventions :
 * - Valeurs en `string` pour les libellés simples.
 * - Valeurs en fonction `(args) => string` pour les chaînes avec variables ou
 *   pluriels (pas de runtime ICU - on compose à la main).
 * - Valeurs en `ReactNode` ou `(...) => ReactNode` quand on a besoin
 *   d'interpoler des composants (badges, marqueurs).
 *
 * Pour étendre : ajoute des clés ici, le typecheck listera tout ce qui manque
 * dans fr.ts / en.ts.
 */

export interface LegalSection {
  title: string;
  sections: Array<{
    title: string;
    content: string;
    list?: string[];
    extra?: string;
  }>;
}

export type HowToPlayMarkers = {
  Pilier: (children: ReactNode) => ReactNode;
  Joueurs: (children: ReactNode) => ReactNode;
};

export interface Dictionary {
  /** Textes réutilisés un peu partout */
  common: {
    language: string;
    back: string;
    close: string;
    cancel: string;
    confirm: string;
    loading: string;
    disconnectedSuffix: string;
    pseudoPlaceholderUpper: string;
    pseudoPlaceholder: string;
  };

  home: {
    playNow: string;
    invite: (hostName: string) => ReactNode;
    fallbackFriend: string;
    createLobby: string;
    join: string;
    exit: string;
    checking: string;
    howToPlayHeading: string;
    achievementsTitle: string;
    stats: { gamesPlayed: string; pointsScored: string };
    aria: {
      seeAchievements: string;
      seeAchievementsWithNew: (count: number) => string;
    };
    toasts: {
      enterPseudoCreate: string;
      enterPseudoJoin: string;
      invalidLobbyCode: string;
      pseudoTaken: (name: string) => string;
    };
    studioButtonTitle: string;
  };

  lobby: {
    tabs: { settings: string; players: string };
    inTheRoom: string;
    connectedCount: (n: number) => string;
    settingsHostOnlyPrefix: string;
    settingsHostOnlySuffix: string;
    guessMyAnswer: { label: string; description: string };
    gameSpeed: {
      label: string;
      fast: string;
      normal: string;
      slow: string;
      estimate: (minutes: number) => string;
    };
    themes: string;
    start: string;
    copyInviteLink: string;
    minPlayers: (n: number) => string;
    selectAtLeastOneTheme: string;
    loadingThemes: string;
    startHostOnly: (hostName: string) => string;
    hostFallback: string;
    modals: {
      fewPlayers: { title: string; message: string; confirm: string; cancel: string };
      alreadyStarted: { title: string; body: string; tip: string };
      howToPlay: string;
      copyLink: { title: string; body: string };
    };
    toasts: {
      linkCopied: string;
      aloneRemoved: string;
      promoted: string;
      newHost: (name: string) => string;
      kicked: (name: string) => string;
      kickedAnon: string;
      closedInactive: string;
    };
  };

  game: {
    loading: string;
    leaderDisconnected: (name: string) => string;
  };

  endGame: {
    eyebrow: string;
    perfectBadge: string;
    share: string;
    playAgain: string;
    quit: string;
    individualScores: string;
    points: (n: number) => string;
    receivedQuestion: string;
    correctAnswersCount: (n: number) => string;
    noPlayers: string;
    aria: {
      seeReceivedQuestion: string;
    };
    toasts: {
      imagePreparing: string;
      imageCopied: string;
      shareUnsupported: string;
      shareFailed: string;
      achievementUnlocked: (title: string) => string;
    };
    reportLabel: string;
    tiers: Array<{ title: string; messages: string[] }>;
  };

  notFound: {
    title: string;
    body: string;
    backHome: string;
  };

  modes: {
    title: string;
    questionLanguage: string;
    local: { title: string; description: string };
    remote: { title: string; description: string };
  };

  howToPlay: {
    button: string;
    ariaButton: string;
    goToStep: (n: number) => string;
    steps: Array<(m: HowToPlayMarkers) => ReactNode>;
  };

  report: {
    trigger: string;
    questionReportLabel: string;
    title: string;
    categoryLabel: string;
    categoryPlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    messageDisabled: string;
    cancel: string;
    send: string;
    success: string;
    footerLabel: string;
    unknownError: string;
  };

  ticketCategories: {
    question_report: { label: string; description: string };
    bug: { label: string; description: string };
    suggestion: { label: string; description: string };
  };

  footer: {
    about: string;
    mentions: string;
    contact: string;
    dontClick: string;
    versionLabel: string;
  };

  legal: {
    about: LegalSection;
    mentions: LegalSection;
    privacy: LegalSection;
    contact: { title: string; intro: string };
  };

  achievements: Record<string, { title: string; description: string }>;

  funFacts: string[];

  decks: {
    instruction: string;
    selectedCount: (n: number) => string;
    all: string;
    loading: string;
    goToCategory: (cat: string) => string;
    categoryDescriptions: Record<string, string>;
  };

  themePicker: {
    title: string;
    modify: string;
    view: string;
    emptyState: string;
    counter: (n: number, total: number) => string;
    hostHint: string;
    readOnlyHint: (hostName: string) => string;
    matureBadge: string;
    matureConfirm: {
      title: string;
      message: string;
      confirm: string;
      cancel: string;
    };
  };

  phases: {
    questionSelection: {
      leaderIs: string;
      waitingSelection: string;
      didYouKnow: string;
      swipeHintMobile: string;
      swipeOverlayTitle: string;
      swipeOverlaySub: string;
      chooseQuestion: string;
      goToCard: (theme: string) => string;
      goToCardIdx: (idx: number) => string;
      prevCard: string;
      nextCard: string;
      reportQuestion: string;
      loading: string;
      selected: string;
    };
    answering: {
      questionAskedToOthers: string;
      questionAskedBy: string;
      writeYourAnswer: string;
      placeholder: string;
      send: string;
      yourAnswer: string;
      waitingForOthers: string;
      answersReceived: string;
    };
    substituteSelection: {
      instructionLeader: string;
      noPlayersDropdown: string;
      validate: string;
      leaderChoosingPlayer: string;
      chooseGuesser: string;
    };
    substituteAnswering: {
      writePrefix: string;
      writeSuffix: string;
      placeholder: (leaderName: string) => string;
      send: string;
      sentWaiting: string;
      pilierWaiting: string;
      thenGuess: string;
      writingAnswerOf: string;
      remoteHelp: string;
      localHelp: string;
      substituteFallback: string;
      leaderFallback: string;
    };
    guessing: {
      loading: string;
      instructionMobile: string;
      instructionDesktop: string;
      assignWaiting: string;
      answers: string;
      allAssigned: string;
      tapToAssign: string;
      dropHere: string;
      remainingCount: (n: number) => string;
      validate: string;
      removeAria: string;
      rotateForLandscape: string;
      leaderFallback: string;
    };
    reveal: {
      gameOver: string;
      readyNext: string;
      waitingPrefix: string;
      waitingLeaderNext: string;
      waitingLeaderFinal: string;
      seeFinalResults: string;
      nextRound: string;
      watchScreen: string;
      revealOnPhone: string;
      reveal: string;
      next: string;
      revealing: string;
      noAttribution: (leaderName: string) => string;
      remoteAttributedTo: string;
      rotateForLandscape: string;
      showYourScreen: string;
      writtenBy: string;
    };
    similarity: {
      promptPrefix: string;
      promptMiddle: string;
      promptSuffix: string;
      yes: string;
      no: string;
      waitingLeader: string;
    };
    questionByline: {
      askedThisQuestion: string;
    };
    playerAnswerWaiting: {
      prefix: string;
      suffix: string;
    };
  };

  shareCard: {
    eyebrow: string;
    top3Label: string;
    ctaLine1: string;
    ctaLine2: string;
    shareTitle: string;
  };

  apiErrors: {
    tooManyReports: string;
    reportFailed: string;
    tooManyAttempts: string;
    wrongPassword: string;
    sessionExpired: string;
    loadError: string;
    updateError: string;
    deleteError: string;
  };
}
