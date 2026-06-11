import type { Dictionary } from './dictionary';

export const en: Dictionary = {
  common: {
    language: 'Language',
    back: 'Back',
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    loading: 'Loading…',
    disconnectedSuffix: ' (disconnected)',
    pseudoPlaceholderUpper: 'YOUR NAME',
    pseudoPlaceholder: 'Your name',
  },

  home: {
    playNow: 'Play now!',
    invite: (hostName) => (
      <>
        <b className="font-bold">{hostName}</b> invites you to join their lobby!
      </>
    ),
    fallbackFriend: 'A friend',
    createLobby: 'Create a lobby',
    join: 'Join',
    exit: 'Leave',
    checking: 'Checking lobby...',
    howToPlayHeading: 'How to play?',
    achievementsTitle: 'My achievements',
    stats: {
      gamesPlayed: 'Games played',
      pointsScored: 'Points scored',
    },
    aria: {
      seeAchievements: 'See my achievements',
      seeAchievementsWithNew: (count) =>
        `See my achievements (${count} new)`,
    },
    toasts: {
      enterPseudoCreate: 'Enter your name before creating a lobby',
      enterPseudoJoin: 'Enter your name before joining a lobby',
      invalidLobbyCode: 'Invalid lobby code',
      pseudoTaken: (name) => `The name "${name}" is already taken in this lobby`,
    },
    studioButtonTitle: 'Debug mode: open the multi-screen Studio',
  },

  lobby: {
    tabs: {
      settings: 'Settings',
      players: 'Players',
    },
    inTheRoom: 'In the lobby',
    connectedCount: (n) => `${n} player${n > 1 ? 's' : ''} connected`,
    settingsHostOnlyPrefix: 'Only',
    settingsHostOnlySuffix: 'can change the settings',
    guessMyAnswer: {
      label: 'Guess my answer',
      description: 'One player is picked to write the answer the leader would have given',
    },
    gameSpeed: {
      label: 'Game length',
      fast: 'Short',
      normal: 'Medium',
      slow: 'Long',
      estimate: (m) => `~${m} min`,
    },
    themes: 'Themes',
    start: 'Start',
    copyInviteLink: 'Copy invite link',
    shareInvite: {
      button: 'Share the invite',
      title: 'Onskoné',
      message: 'Hey, come play with me on Onskoné! 🎉',
    },
    minPlayers: (n) => `You need at least ${n} players to start`,
    selectAtLeastOneTheme: 'Pick at least 1 theme',
    loadingThemes: 'Loading themes…',
    startHostOnly: (host) => `Only ${host} can start the game`,
    hostFallback: 'the host',
    modals: {
      fewPlayers: {
        title: 'Not many players :(',
        message: 'The game is way more fun with at least 4 players. Start anyway?',
        confirm: 'Start',
        cancel: 'Wait',
      },
      alreadyStarted: {
        title: 'Game already started',
        body: "Oh no! The game has already started and you can't jump in mid-round...",
        tip: 'Pro tip: get new friends.',
      },
      howToPlay: 'How to play?',
      copyLink: {
        title: 'Copy the link by hand',
        body: "Auto copy didn't work. Select the link below:",
      },
    },
    toasts: {
      linkCopied: 'Link copied! Send it to your friends',
      aloneRemoved: 'You were alone in the lobby, it has been deleted',
      promoted: 'You are now the lobby host!',
      newHost: (name) => `${name} is now the lobby host`,
      kicked: (name) => `${name} kicked you from the lobby`,
      kickedAnon: 'You were kicked from the lobby',
      closedInactive: 'This lobby was closed due to inactivity',
    },
    playerMenu: {
      trigger: 'Player options',
      promote: 'Promote to host',
      kick: 'Kick',
    },
  },

  game: {
    loading: 'Loading game...',
    leaderDisconnected: (name) => `${name} disconnected - round skipped`,
  },

  endGame: {
    eyebrow: 'YOU KNOW EACH OTHER',
    perfectBadge: 'Onskoné!',
    share: 'Share',
    playAgain: 'Play again',
    quit: 'Quit',
    individualScores: 'Individual scores',
    points: (n) => `${n} pt${n > 1 ? 's' : ''}`,
    receivedQuestion: 'Question received',
    correctAnswersCount: (n) => `${n} Correct answer${n > 1 ? 's' : ''}`,
    noPlayers: 'No players',
    aria: {
      seeReceivedQuestion: 'See the received question',
    },
    toasts: {
      imagePreparing: 'Image being prepared…',
      imageCopied: 'Image copied! Paste it wherever you want',
      shareUnsupported: 'Sharing not supported',
      shareFailed: 'Oops, sharing failed',
      achievementUnlocked: (title) => `Achievement unlocked - ${title}`,
    },
    reportLabel: 'Report a bug or suggestion',
    tiers: [
      {
        title: "This is awkward...",
        messages: [
          'You bumped into each other once in an elevator back in 2019, right?',
          'You share the wifi, that\'s already a solid foundation.',
          'Maybe start with a coffee together, no?',
          'Take your time, you\'ll get to know each other... one day.',
        ],
      },
      {
        title: 'Not quite there yet',
        messages: [
          'The basics are there, you just need to build on top.',
          'You\'re making progress, slowly but surely... mostly slowly.',
          'A couple of drinks and it should take off.',
        ],
      },
      {
        title: 'Not bad, not bad',
        messages: [
          'One more step and you\'re a real team.',
          "You could carpool 3 hours without killing each other. That's already huge.",
          'There\'s some trust, but the Netflix password stays sacred.',
        ],
      },
      {
        title: 'Super team',
        messages: [
          'You get each other without speaking, beautiful to watch.',
          "You finish each other's sentences, and each other's fries too.",
          'You could rob a bank together',
        ],
      },
      {
        title: 'Inseparable',
        messages: [
          "At this point it's not friendship anymore, it's family.",
          'Every moment together turns into a story.',
          "Your shared memories could fill a Netflix season.",
        ],
      },
      {
        title: 'Onskoné!',
        messages: [
          'Perfect score. You\'re the same person in multiple copies.',
          'At this point you share DNA, the Wi-Fi password and the same life',
        ],
      },
    ],
  },

  notFound: {
    title: 'Uh... this page doesn\'t exist',
    body: "You probably mistyped the address, or the link is broken. No worries, we'll take you home!",
    backHome: 'Back to home',
  },

  modes: {
    title: 'Pick your game mode',
    questionLanguage: 'Question language',
    local: {
      title: 'In person',
      description: 'Same room, players are close enough to show each other their phones',
    },
    remote: {
      title: 'Remote',
      description: 'Everyone at home, players follow the game live on their screens',
    },
  },

  howToPlay: {
    button: 'How to play?',
    ariaButton: 'How to play',
    goToStep: (n) => `Go to step ${n}`,
    steps: [
      ({ Pilier }) => (
        <>
          Each round, one player becomes the {Pilier('leader')} and picks a question from the ones offered.
        </>
      ),
      ({ Joueurs }) => (
        <>
          {Joueurs('Players')} get the question and write their answer, <b>anonymously</b>.
        </>
      ),
      ({ Pilier, Joueurs }) => (
        <>
          {Pilier('The leader')} attributes each answer to the player they think wrote it. {Joueurs('Players')} show their screens to find out which answer the leader gave them.
        </>
      ),
      ({ Pilier }) => (
        <>
          {Pilier('The leader')} reveals who wrote what and scores points for the group on each correct guess.
        </>
      ),
    ],
  },

  report: {
    trigger: 'Report',
    title: 'Report an issue',
    categoryLabel: 'Issue category',
    categoryPlaceholder: 'Pick a category…',
    messageLabel: 'Message',
    messagePlaceholder: 'Describe in a few words…',
    messageDisabled: 'Pick a type above first.',
    cancel: 'Cancel',
    send: 'Send',
    success: 'Thanks! Your report has been sent.',
    footerLabel: 'Report an issue',
    unknownError: 'Unknown error',
  },

  ticketCategories: {
    question_report: {
      label: 'Bad question',
      description: 'An awkward, ambiguous or badly worded question.',
    },
    bug: {
      label: 'Technical bug',
      description: 'Something not working as expected.',
    },
    suggestion: {
      label: 'Idea / suggestion',
      description: 'A feature or content proposal.',
    },
  },

  footer: {
    about: 'About',
    mentions: 'Legal',
    contact: 'Contact',
    dontClick: "Don't click",
    versionLabel: 'Version',
  },

  legal: {
    about: {
      title: 'About',
      sections: [
        {
          title: 'A word from the creator',
          content: `We're glad to introduce the official site of the Onskoné? board game! Sylvain, my brother, came up with the idea for this game in 2024. After helping him with the designs and showing the prototype to many friends and at the Cannes festival, we got loads of positive feedback. So we decided to dive into building this website to make this great idea known to everyone. We hope you'll enjoy playing Onskoné? Don't hesitate to share your feedback, we'll read it with pleasure!`,
        },
        {
          title: 'Thanks',
          content: `A HUGE thanks to everyone who supported me and pushed me to make this project happen:`,
          list: [
            "My friend Philippe, the GOAT, who kept supporting me through the site and helped me on the whole technical side.",
            "My sister Mimi, who kept cheering me on throughout the development",
            "My brother Sylvain, for fully trusting me to build the website for his game",
            "Brinda and Sathya, who gave me ambition right from the start of the project",
            "And finally all my friends and cousins who tested the game with me and gave great feedback!",
          ],
        },
      ],
    },
    mentions: {
      title: 'Legal Notice',
      sections: [
        {
          title: 'Site developer',
          content: `<strong>Site owner:</strong> Simeon Deivassagayame<br /><strong>Game creator:</strong> Sylvain Deivassagayame<br /><strong>Contact:</strong> onskonelejeu@gmail.com`,
        },
        {
          title: 'Hosting',
          content: `This site is hosted by standard web hosting services. Information about the host can be obtained upon request.`,
        },
        {
          title: 'Intellectual property',
          content: `All content (text, images, graphics, logo, icons, etc.) on the Onskone site is protected by intellectual property laws and belongs to the publisher or is used with permission.`,
          extra: `Any reproduction, representation, modification, publication or adaptation of all or part of the site's elements is forbidden without prior written authorization.`,
        },
        {
          title: 'Credits',
          content: `Avatars used in this game are generated with DiceBear (style "Micah").`,
          extra: `<a href="https://www.dicebear.com/styles/micah/" target="_blank" rel="noopener noreferrer" class="text-primary underline">DiceBear Micah</a> by <strong>DiceBear</strong>, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" class="text-primary underline">CC BY 4.0</a>.`,
        },
        {
          title: 'Limitation of liability',
          content: `Onskone cannot be held responsible for direct or indirect damages to user equipment when accessing the site. The user agrees to access the site using recent, virus-free equipment and an up-to-date browser.`,
        },
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      sections: [
        {
          title: 'Data collection',
          content: `Onskone only collects data strictly necessary to run the game:`,
          list: [
            'Your name (chosen freely, not tied to your identity)',
            'Your answers to questions during games',
          ],
        },
        {
          title: 'Data usage',
          content: `Collected data is used exclusively to:`,
          list: [
            'Run the game sessions',
            'Display scores and results',
            'Improve user experience',
          ],
        },
        {
          title: 'Data retention',
          content: `Game data (names, answers) is temporary and is not kept after the end of the game session. No personal data is permanently stored on our servers.`,
        },
        {
          title: 'Cookies',
          content: `The site may use technical cookies needed for the service to work properly (session management, preferences). These cookies do not collect any personal data for advertising purposes.`,
        },
        {
          title: 'Your rights',
          content: `Under current regulations, you have a right to access, rectify and delete your data. To exercise these rights, contact us at: onskonelejeu@gmail.com`,
        },
        {
          title: 'Data sharing',
          content: `Onskone does not sell, trade or rent your personal information to third parties. Your data is never shared for commercial purposes.`,
        },
      ],
    },
    contact: {
      title: 'Contact us',
      intro: "Want to reach out but not sure how? No worries, drop us a line anywhere, we'll be happy to reply:",
    },
    openPage: 'Open the full page',
  },

  achievements: {
    'first-game': {
      title: 'First game',
      description: 'You finished your very first game.',
    },
    'loyal-10': {
      title: 'Loyal',
      description: '10 games on the counter.',
    },
    'veteran-50': {
      title: 'Veteran',
      description: '25 games done. Aren\'t you tired yet?',
    },
    'mind-reader-20': {
      title: 'Mind reader',
      description: 'Guess 20 answers correctly as leader.',
    },
    marathon: {
      title: 'Marathon',
      description: 'Finish a game of 10 rounds or more.',
    },
    'top-1-thrice': {
      title: 'On the podium',
      description: 'Finish 1st in a game, 3 times.',
    },
    'zero-percent': {
      title: 'Industrial disaster',
      description: 'Reach 0% as a team. Congrats (?).',
    },
    'perfect-score': {
      title: 'Perfect score',
      description: 'A team at 100%. Onskoné!',
    },
  },

  funFacts: [
    "On the day he was born, Squeezie's first words were: 'Is that good for you guys?'",
    "At the casino you can win 4000 times your bet but you can only lose 1 time your bet, so bet it all next time ;)",
    "League of Legends players shower on average once a week",
    "It's statistically safer to bet on a Kylian Mbappé goal than on a goal by the referee.",
    "Going to the gym regularly gives you muscle gains plus a nauseating body odor",
    "Skipping brushing your teeth systematically results in dragon breath",
    "Eating KFC every day greatly increases your toilet paper expenses",
    "Whoever falls asleep with itchy butt cheeks wakes up with stinky fingers",
    "If in a rap song you hear 'number 10 like ...', that rapper is necessarily bad",
    "4 out of 5 men don't understand the pain women go through daily (I'm the 5th)",
  ],

  decks: {
    instruction: 'Tap themes to add/remove them',
    selectedCount: (n) => `${n} theme${n > 1 ? 's' : ''} selected`,
    all: 'All',
    loading: 'Loading question decks…',
    goToCategory: (cat) => `Go to ${cat}`,
    categoryDescriptions: {
      ICEBREAKERS: 'Simple questions to break the ice',
      FUN: 'Have fun with your friends on silly topics',
      DEEP: 'Dive into more personal conversations',
    },
  },

  themePicker: {
    title: 'Pick your themes',
    modify: 'Edit',
    view: 'View themes',
    emptyState: 'No theme selected',
    counter: (n) => `${n} selected`,
    hostHint: "You're the only one who can pick the themes.",
    readOnlyHint: (hostName) => `Only ${hostName} can pick the themes.`,
    matureBadge: '18+',
    matureConfirm: {
      title: 'Adult content',
      message: 'This theme contains explicit content for adults only. Are you sure you want to enable it?',
      confirm: "I'm 18+",
      cancel: 'Uhhh, no',
    },
  },

  phases: {
    questionSelection: {
      leaderIs: 'The leader this round is',
      waitingSelection: 'Waiting for their question pick…',
      didYouKnow: 'Did you know?',
      swipeHintMobile: 'swipe to change card',
      swipeOverlayTitle: 'Swipe',
      swipeOverlaySub: 'to change card',
      chooseQuestion: "You're the leader, pick a question!",
      goToCard: (theme) => `See the ${theme} card`,
      goToCardIdx: (idx) => `Go to card ${idx}`,
      prevCard: 'Previous card',
      nextCard: 'Next card',
      reportQuestion: 'Report a question',
      loading: 'Loading questions...',
      selected: 'Question picked! Moving to next phase…',
    },
    answering: {
      questionAskedToOthers: 'Question asked to the other players',
      questionAskedBy: 'Question asked by',
      writeYourAnswer: 'Write your own answer',
      placeholder: 'Write your answer…',
      send: 'Send',
      yourAnswer: 'Your answer',
      editAnswer: 'Edit my answer',
      waitingForOthers: 'Waiting for the other players…',
      answersReceived: 'Answers received',
    },
    substituteSelection: {
      instructionLeader: 'The player you choose will have to guess the answer you would have given.',
      noPlayersDropdown: 'No players available',
      validate: 'Validate',
      leaderChoosingPlayer: 'is picking the player who will answer for them...',
      chooseGuesser: 'Pick who will have to guess your answer',
    },
    substituteAnswering: {
      writePrefix: 'Write the answer that',
      writeSuffix: 'would have given',
      placeholder: (name) => `Write what ${name} would have answered…`,
      send: 'Send',
      sentWaiting: 'Answer sent, waiting...',
      pilierWaiting: 'is writing the answer you would have given...',
      thenGuess: 'You will then have to guess what they wrote for you.',
      writingAnswerOf: 'is writing the answer for',
      remoteHelp: "Send them private messages to help them answer",
      localHelp: "Whisper in their ear and help them answer",
      substituteFallback: 'The substitute',
      leaderFallback: 'the leader',
    },
    guessing: {
      loading: 'Loading answers...',
      instruction: 'Tap each answer to assign it to a player',
      choosePlayer: 'Choose a player',
      removeOption: 'Clear assignment',
      assignWaiting: 'is assigning the answers…',
      answers: 'Answers',
      allAssigned: 'All answers have been assigned',
      remainingCount: (n) => `${n} answer${n > 1 ? 's' : ''} left to assign`,
      validate: 'Confirm my picks',
      removeAria: 'Remove',
      rotateForLandscape: 'Turn your phone for a wider view',
      leaderFallback: 'the leader',
    },
    reveal: {
      gameOver: 'Game over!',
      readyNext: 'Ready for what\'s next?',
      waitingPrefix: 'Waiting for',
      waitingLeaderNext: 'to start the next round…',
      waitingLeaderFinal: 'to reveal the final results…',
      seeFinalResults: 'See final results',
      nextRound: 'Next round',
      watchScreen: 'Watch their screen!',
      revealOnPhone: 'Reveal on their phone',
      reveal: 'Reveal',
      next: 'Next',
      revealing: 'is revealing the results…',
      noAttribution: (leader) => `${leader} didn't give you any answer`,
      remoteAttributedTo: 'Answer attributed to',
      rotateForLandscape: 'Turn your phone for a wider view',
      showYourScreen: 'Show your screen to everyone!',
      writtenBy: 'Written by',
    },
    similarity: {
      promptPrefix: '',
      promptMiddle: 'has the same answer as',
      promptSuffix: ', is it the same?',
      yes: 'Yes',
      no: 'No',
      waitingLeader: 'Waiting for the leader...',
    },
    questionByline: {
      askedThisQuestion: 'asked this question:',
    },
    playerAnswerWaiting: {
      prefix: 'Waiting for',
      suffix: 'to give you an answer…',
    },
  },

  shareCard: {
    eyebrow: 'YOU KNOW EACH OTHER',
    top3Label: 'TOP 3',
    ctaLine1: 'Come play on',
    ctaLine2: 'onskone.fr!',
    shareTitle: 'Onskoné',
  },

  apiErrors: {
    tooManyReports: 'Too many reports, try again later.',
    reportFailed: "Couldn't send the report.",
    tooManyAttempts: 'Too many attempts, try again later.',
    wrongPassword: 'Wrong password.',
    sessionExpired: 'Session expired. Please log in again.',
    loadError: 'Loading error.',
    updateError: 'Update error.',
    deleteError: 'Deletion error.',
  },
};
