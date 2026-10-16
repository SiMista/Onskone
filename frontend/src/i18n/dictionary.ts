import type { ReactNode } from 'react';
import type { Locale } from '@onskone/shared';

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
  /** Meta description SEO courte de la page (chaque page légale annonce un
   *  contenu distinct au moteur pour ne pas être vue comme un doublon). */
  seoDescription: string;
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

export interface TierTexts {
  title: string;
  messages: string[];
}

/**
 * 6 paliers de score - longueur FIGÉE en tuple. Force fr.tsx et en.tsx à fournir
 * exactement 6 entrées (sinon erreur de typecheck), et le garde-fou dans
 * constants/tiers.ts lie cette longueur au nombre de TIERS. Index aligné sur TIERS.
 */
export type TierTextsTuple = readonly [TierTexts, TierTexts, TierTexts, TierTexts, TierTexts, TierTexts];

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

  /** Modale Réglages (roue crantée de l'accueil) : préférences locales à l'appareil. */
  settings: {
    button: string;
    title: string;
    sound: string;
    vibration: string;
    /** État affiché sous l'icône (barrée quand coupé). */
    on: string;
    off: string;
    /** Réglage sans effet sur cet appareil (ex. vibrations sur iOS Safari). */
    unavailable: string;
    report: string;
    /** Sous le choix de langue, en lobby / partie, si l'interface ≠ langue du salon. */
    contentLocaleHint: string;
    /** Nom de chaque langue, écrit dans la langue de ce dictionnaire. */
    languageNames: Record<Locale, string>;
    /** Section "Salon" en partie : code du salon, copiable (cf. SettingsModal). */
    lobby: string;
    inviteHint: string;
    /** Rouvre le formulaire de consentement pub de Google (RGPD : retirer son accord). */
    adChoices: string;
  };

  /** Écran d'intro avant le formulaire de consentement pub de Google (cf. ads.ts). */
  ads: {
    introTitle: string;
    introBody: string;
    introContinue: string;
  };

  /** Écran de secours quand le rendu plante (cf. AppErrorBoundary). */
  app: {
    crashTitle: string;
    crashBody: string;
    crashHome: string;
  };

  /** Écran bloquant "maj forcée" (version trop vieille refusée par le serveur) */
  update: {
    title: string;
    message: string;
    cta: string;
    ctaWeb: string;
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
    // Popup de reprise d'une partie en cours (app tuée en arrière-plan)
    resume: { title: string; message: string; confirm: string; cancel: string };
    /** « Tu étais qui ? » : reprise d'une place en cours de partie (session perdue). */
    reclaim: { title: string; message: string; pick: string; notMe: string; waiting: string; alreadyConnected: string };
    aria: {
      seeAchievements: string;
      seeAchievementsWithNew: (count: number) => string;
    };
    toasts: {
      enterPseudoCreate: string;
      enterPseudoJoin: string;
      invalidLobbyCode: string;
      lobbyNotFound: string;
      pseudoTaken: (name: string) => string;
      /** Partie en cours sans place à reprendre : impossible d'entrer. */
      gameInProgress: string;
    };
    joinByCode: {
      button: string;
      modalTitle: string;
      submit: string;
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
      estimate: (minutes: number) => string;
    };
    /** Bottom sheet "Options de jeu" (mode, rythme, piliers) et sa ligne de résumé. */
    options: {
      title: string;
      summary: (mode: string, speed: string, rounds: number, minutes: number) => string;
      /** Nom du mode sans "Devine ma réponse", affiché dans le résumé. */
      classicMode: string;
      leaders: string;
      rounds: (n: number) => string;
      leadersHint: string;
      you: string;
      hostOnly: (host: string) => string;
      /** Libellé du récap de durée en tête du sheet Options (dépend du rythme et des piliers). */
      estimateLabel: string;
      /** Précision sous le récap de durée. */
      estimateHint: string;
    };
    /** Badge sur la carte d'un joueur exclu du rôle de pilier. */
    notLeaderBadge: string;
    atLeastOneLeader: string;
    themes: string;
    /** Titre de section du bloc mode + options de jeu (onglet Paramètres). */
    gameSection: string;
    start: string;
    shareInvite: {
      button: string;
      title: string;
      message: string;
      sheetTitle: string;
      codeLabel: string;
      copyLink: string;
      share: string;
      qrLabel: string;
      scanHint: string;
    };
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
      codeCopied: string;
      shareUnavailable: string;
      aloneRemoved: string;
      promoted: string;
      newHost: (name: string) => string;
      kicked: (name: string) => string;
      kickedAnon: string;
      closedInactive: string;
      /** Slot refusé à l'entrée du salon (session perdue, pseudo déjà pris). */
      joinRefused: string;
      playerJoined: (name: string) => string;
      playerLeft: (name: string) => string;
    };
    playerMenu: {
      trigger: string;
      promote: string;
      kick: string;
    };
  };

  game: {
    loading: string;
    /** Chargement anormalement long : proposer de réessayer / rentrer. */
    loadingSlow: string;
    loadingRetry: string;
    loadingHome: string;
    leaderDisconnected: (name: string) => string;
    /** Filet REVEAL : le pilier n'a pas conclu la manche, le serveur l'a fait. */
    leaderIdle: (name: string) => string;
    /** Session refusée par le serveur : retour à l'accueil pour reprendre sa place. */
    sessionLost: string;
    /** Salon/partie disparus (redéploiement, fermeture) : retour à l'accueil. */
    lobbyGone: string;
    /** Évincé : le slot a été repris depuis un autre appareil. */
    connectedElsewhere: string;
  };

  /** Chaînes SEO / méta de l'accueil (titre onglet, description, h1, alt logo). */
  seo: {
    homeTitle: string;
    homeDescription: string;
    homeH1: string;
    logoAlt: string;
  };

  endGame: {
    eyebrow: string;
    perfectBadge: string;
    share: string;
    playAgain: string;
    quit: string;
    individualScores: string;
    points: (n: number) => string;
    /** À la place des points d'un joueur qui n'a jamais été pilier (exclu, ou partie écourtée). */
    unranked: string;
    receivedQuestion: string;
    correctAnswersCount: (n: number) => string;
    /** Suffixe de l'entrée écrite par le substitut au nom du pilier : « (par Alice) ». */
    byPlayer: (name: string) => string;
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
    tiers: TierTextsTuple;
  };

  notFound: {
    title: string;
    body: string;
    backHome: string;
  };

  modes: {
    title: string;
    local: { title: string; description: string };
    remote: { title: string; description: string };
  };

  howToPlay: {
    button: string;
    ariaButton: string;
    firstTimeHint: string; // bulle sous le bouton au tout premier passage
    goToStep: (n: number) => string;
    steps: Array<(m: HowToPlayMarkers) => ReactNode>;
  };

  report: {
    trigger: string;
    title: string;
    categoryLabel: string;
    categoryPlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    cancel: string;
    send: string;
    success: string;
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
    cgu: LegalSection;
    support: LegalSection;
    contact: { title: string; intro: string };
    openPage: string;
    tabs: { cgu: string; mentions: string; privacy: string };
  };

  achievements: Record<string, { title: string; description: string }>;

  funFacts: string[];

  decks: {
    instruction: string;
    all: string;
    loading: string;
    categoryDescriptions: Record<string, string>;
  };

  themePicker: {
    title: string;
    modify: string;
    view: string;
    emptyState: string;
    counter: (n: number) => string;
    hostHint: string;
    readOnlyHint: (hostName: string) => string;
    matureBadge: string;
    premiumBadge: string;
    matureConfirm: {
      title: string;
      message: string;
      confirm: string;
      cancel: string;
    };
  };

  premium: {
    title: string;
    subtitle: string;
    // Perks (liste d'avantages)
    perkQuestions: string;
    perkThemes: string;
    perkAds: string;
    perkName: string;
    perkNameSample: string;   // pseudo d'exemple affiché en doré
    // Mode natif (achat possible)
    unlock: string;
    restore: string;
    kebab: string;            // accroche prix sous le CTA
    lifetimeSticker: string;  // sticker penché collé sur le CTA
    termsLink: string;        // liens légaux en pied de paywall
    privacyLink: string;
    purchasing: string;
    purchaseError: string;
    purchaseUnavailable: string;
    restoreError: string;
    restoreEmpty: string;
    // Mode web (redirection store)
    webOnly: string;
    getOnAppStore: string;
    getOnPlayStore: string;
    close: string;
    // Écran de célébration après achat/restauration réussi
    welcomeTitle: string;
    welcomeRestoredTitle: string;
    welcomeDesc: string;
    welcomeCta: string;
    // Toast du badge Premium de l'accueil (joueur déjà premium)
    activeToast: string;
    // Pastille d'achat en haut à gauche de l'accueil (joueur pas encore premium).
    // Sur 2 lignes : `\n` rendu par whitespace-pre-line.
    homeButton: string;
  };

  appBanner: {
    message: string;
    tagline: string;
    cta: string;
    close: string;
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
      editAnswer: string;
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
      instruction: string;
      choosePlayer: string;
      removeOption: string;
      assignWaiting: string;
      answers: string;
      remainingCount: (n: number) => string;
      validate: string;
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
