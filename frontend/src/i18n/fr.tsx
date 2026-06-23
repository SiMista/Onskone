import type { Dictionary } from './dictionary';

export const fr: Dictionary = {
  common: {
    language: 'Langue',
    back: 'Retour',
    close: 'Fermer',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    loading: 'Chargement…',
    disconnectedSuffix: ' (déconnecté)',
    pseudoPlaceholderUpper: 'TON PSEUDO',
    pseudoPlaceholder: 'Ton pseudo',
  },

  home: {
    playNow: 'Joue maintenant !',
    invite: (hostName) => (
      <>
        <b className="font-bold">{hostName}</b> t'invite à rejoindre son salon !
      </>
    ),
    fallbackFriend: 'Un ami',
    createLobby: 'Créer un salon',
    join: 'Rejoindre',
    exit: 'Quitter',
    checking: 'Vérification du salon...',
    howToPlayHeading: 'Comment jouer ?',
    achievementsTitle: 'Mes succès',
    stats: {
      gamesPlayed: 'Parties jouées',
      pointsScored: 'Points marqués',
    },
    aria: {
      seeAchievements: 'Voir mes succès',
      seeAchievementsWithNew: (count) =>
        `Voir mes succès (${count} nouveau${count > 1 ? 'x' : ''})`,
    },
    toasts: {
      enterPseudoCreate: 'Entre ton pseudo avant de créer un salon',
      enterPseudoJoin: 'Entre ton pseudo avant de rejoindre un salon',
      invalidLobbyCode: 'Code de salon invalide',
      lobbyNotFound: 'Salon introuvable',
      pseudoTaken: (name) => `Le pseudo "${name}" est déjà pris dans ce salon`,
    },
    joinByCode: {
      button: 'Rejoindre une partie',
      modalTitle: 'Rejoindre une partie',
      submit: 'Rejoindre',
    },
    studioButtonTitle: 'Mode debug : ouvrir le Studio multi-écrans',
  },

  lobby: {
    tabs: {
      settings: 'Paramètres',
      players: 'Joueurs',
    },
    inTheRoom: 'Dans le salon',
    connectedCount: (n) => `${n} joueur${n > 1 ? 's' : ''} connecté${n > 1 ? 's' : ''}`,
    settingsHostOnlyPrefix: 'Seul',
    settingsHostOnlySuffix: 'peut modifier les paramètres',
    guessMyAnswer: {
      label: 'Devine ma réponse',
      description: "Un joueur est désigné pour écrire la réponse que le pilier aurait répondu",
    },
    gameSpeed: {
      label: 'Durée de partie',
      fast: 'Courte',
      normal: 'Moyenne',
      slow: 'Longue',
      estimate: (m) => `~${m} min`,
    },
    themes: 'Thèmes',
    start: 'Démarrer',
    copyInviteLink: "Copier le lien d'invitation",
    shareInvite: {
      button: "Partager l'invitation",
      title: 'Onskoné',
      message: "Viens jouer, on va voir si on s'connaît vraiment... enfin, si Onskoné ! 😜",
      sheetTitle: 'Inviter des amis',
      codeLabel: 'Code du salon',
      copyLink: 'Copier le lien',
      share: 'Partager',
      qrLabel: "QR code pour rejoindre le salon",
      scanHint: 'Montre ce QR code à tes amis pour les inviter',
    },
    minPlayers: (n) => `Il faut au moins ${n} joueurs pour lancer`,
    selectAtLeastOneTheme: 'Sélectionne au moins 1 thème',
    loadingThemes: 'Chargement des thèmes…',
    startHostOnly: (host) => `Seul ${host} peut démarrer la partie`,
    hostFallback: 'le host',
    modals: {
      fewPlayers: {
        title: 'Pas beaucoup de joueurs :(',
        message: 'La partie serait plus amusante avec au moins 4 joueurs. Démarrer la partie quand même ?',
        confirm: 'Lancer',
        cancel: 'Attendre',
      },
      alreadyStarted: {
        title: 'Partie déjà lancée',
        body: 'Ohhhhhh mince ! La partie a déjà été lancée et tu ne peux pas la rejoindre en cours de route...',
        tip: "Petit conseil : changer d'amis.",
      },
      howToPlay: 'Comment jouer ?',
      copyLink: {
        title: 'Copie le lien à la main',
        body: "Le copier-coller automatique n'a pas fonctionné. Sélectionne le lien ci-dessous :",
      },
    },
    toasts: {
      linkCopied: 'Lien copié ! Envoie le à tes amis',
      codeCopied: 'Code copié !',
      shareUnavailable: "Le partage n'a pas fonctionné, copie plutôt le lien",
      aloneRemoved: 'Tu étais seul dans le salon, il a été supprimé',
      promoted: 'Tu es maintenant le chef du salon !',
      newHost: (name) => `${name} est maintenant le chef du salon`,
      kicked: (name) => `${name} t'a expulsé du salon`,
      kickedAnon: 'Tu as été expulsé du salon',
      closedInactive: 'Ce salon a été fermé pour inactivité',
    },
    playerMenu: {
      trigger: 'Options du joueur',
      promote: 'Promouvoir hôte',
      kick: 'Expulser',
    },
  },

  game: {
    loading: 'Chargement du jeu...',
    leaderDisconnected: (name) => `${name} s'est déconnecté - round passé`,
  },

  endGame: {
    eyebrow: 'Vous vous connaissez à',
    perfectBadge: 'Onskoné !',
    share: 'Partager',
    playAgain: 'Rejouer',
    quit: 'Quitter',
    individualScores: 'Scores individuels',
    points: (n) => `${n} pt${n > 1 ? 's' : ''}`,
    receivedQuestion: 'Question reçue',
    correctAnswersCount: (n) => `${n} Bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`,
    noPlayers: 'Aucun joueur',
    aria: {
      seeReceivedQuestion: 'Voir la question reçue',
    },
    toasts: {
      imagePreparing: 'Image en cours de préparation…',
      imageCopied: 'Image copiée ! Colle-la où tu veux',
      shareUnsupported: 'Partage non supporté',
      shareFailed: 'Oups, partage échoué',
      achievementUnlocked: (title) => `Succès débloqué - ${title}`,
    },
    reportLabel: 'Signaler un bug ou une suggestion',
    tiers: [
      {
        title: "C'est gênant là...",
        messages: [
          "Vous vous êtes croisés une fois dans un ascenseur en 2019, c'est ça ?",
          'Vous partagez le wifi, c\'est déjà une base solide.',
          'Faut peut-être commencer par un café ensemble, non ?',
          'Tranquille, vous apprendrez à vous connaître… un jour.',
          "Vous avez plus de points communs avec votre livreur Uber Eats ...",
          "À ce stade, vos conversations commencent encore par \"Tu fais quoi dans la vie ?\"",
        ],
      },
      {
        title: 'Pas encore ça',
        messages: [
          'Les bases sont là, reste juste à construire au-dessus.',
          'Vous avancez, doucement mais sûrement… enfin surtout doucement.',
          "Vous savez qui est qui. C'est plus que certains collègues après 5 ans.",
          "Vous connaissez vos prénoms... C'est déjà un début.",
          "Votre relation tient actuellement grâce aux groupes WhatsApp.",
        ],
      },
      {
        title: 'Pas mal, pas mal',
        messages: [
          'Un pas de plus et vous êtes une vraie team.',
          "Vous pourriez covoiturer 3h sans tuer personne. C'est déjà énorme.",
          "Y'a de la confiance, mais le mot de passe Netflix reste sacré.",
          "Vous avez suffisamment de souvenirs communs pour alimenter quelques dossiers.",
        ],
      },
      {
        title: 'Super team',
        messages: [
          "Vous vous captez presque sans parler, c'est beau à voir.",
          'Vous finissez les phrases des autres, et aussi leurs frites.',
          'Vous pourriez braquer une banque ensemble',
          "Vous savez très bien quelle photo embarrassante utiliser en cas d'embrouille.",
        ],
      },
      {
        title: 'Inséparables',
        messages: [
          "À ce stade c'est plus de l'amitié, c'est de la famille.",
          'Chaque moment ensemble devient une anecdote.',
          'Vos souvenirs communs pourraient remplir une saison Netflix.',
        ],
      },
      {
        title: 'Onskoné !',
        messages: [
          'Score parfait. Vous êtes la même personne en plusieurs exemplaires.',
          "À ce stade vous partagez l'ADN, le mot de passe Wi-Fi et la même vie",
        ],
      },
    ],
  },

  notFound: {
    title: 'Heu... cette page existe pas',
    body: "T'as dû te tromper d'adresse, ou le lien est cassé. Pas de panique, on te ramène à la maison !",
    backHome: "Retour à l'accueil",
  },

  modes: {
    title: 'Choisis ton mode de jeu',
    local: {
      title: 'Sur place',
      description: 'Dans la même pièce, les joueurs sont à proximité pour montrer leur téléphone',
    },
    remote: {
      title: 'À distance',
      description: 'Chacun chez soi, les joueurs suivent la partie en direct sur leur écran',
    },
  },

  howToPlay: {
    button: 'Comment jouer ?',
    ariaButton: 'Comment jouer',
    goToStep: (n) => `Aller à l'étape ${n}`,
    steps: [
      ({ Pilier }) => (
        <>
          Chaque manche, un joueur devient {Pilier('pilier')} et choisit une question parmi celles proposées.
        </>
      ),
      ({ Joueurs }) => (
        <>
          {Joueurs('Les joueurs')} reçoivent la question et écrivent leur réponse, <b>anonymement</b>.
        </>
      ),
      ({ Pilier, Joueurs }) => (
        <>
          {Pilier('Le pilier')} attribue chaque réponse au joueur qui l'a écrite selon lui. {Joueurs('Les joueurs')} montrent leur écran pour découvrir quelle réponse le pilier leur a attribuée.
        </>
      ),
      ({ Pilier }) => (
        <>
          {Pilier('Le pilier')} dévoile qui a écrit quoi et il marque des points pour le groupe s'il a bien deviné.
        </>
      ),
    ],
  },

  report: {
    trigger: 'Signaler',
    title: 'Signaler un problème',
    categoryLabel: 'Catégorie de problème',
    categoryPlaceholder: 'Sélectionne une catégorie…',
    messageLabel: 'Message',
    messagePlaceholder: 'Décris en quelques mots…',
    messageDisabled: "Sélectionne d'abord un type ci-dessus.",
    cancel: 'Annuler',
    send: 'Envoyer',
    success: 'Merci ! Ton signalement a été envoyé.',
    footerLabel: 'Signaler un problème',
    unknownError: 'Erreur inconnue',
  },

  ticketCategories: {
    question_report: {
      label: 'Question pourrie',
      description: 'Une question gênante, ambiguë ou mal formulée.',
    },
    bug: {
      label: 'Bug technique',
      description: 'Un truc qui marche pas comme attendu.',
    },
    suggestion: {
      label: 'Idée / suggestion',
      description: 'Une proposition de fonctionnalité ou de contenu.',
    },
  },

  footer: {
    about: 'À propos',
    mentions: 'CGU',
    contact: 'Contact',
    dontClick: 'Ne clique pas',
    versionLabel: 'Version',
  },

  legal: {
    about: {
      title: 'À propos',
      sections: [
        {
          title: 'Message du créateur',
          content: `C'est avec plaisir que l'on vous présente le site officiel du jeu de société Onskoné? ! Sylvain, mon frère, a eu l'idée de ce jeu en 2024. Après l'avoir aidé pour les designs et présenté le prototype du jeu à de nombreux amis ainsi qu'au festival de Cannes, nous avons eu pas mal de retours positifs. Nous avons donc décidé de nous lancer dans le développement de ce site web pour populariser cette idée géniale. Nous espérons que vous apprécierez jouer à Onskoné? N'hésitez pas à nous donner votre avis sur le jeu, nous le lirons avec plaisir !`,
        },
        {
          title: 'Remerciements',
          content: `Un ÉNORME merci, à ceux qui m'ont soutenu et encouragé à faire ce projet:`,
          list: [
            "Mon ami Philippe, le goat, qui m'a soutenu sans arrêt pour faire le site et m'a aidé sur toute la partie technique du projet.",
            "Ma soeur, Mimi, qui m'a encouragé à continuer le site tout au long du développement",
            "Mon frère Sylvain, pour m'avoir fait entièrement confiance pour réaliser le site web de son jeu",
            "Brinda et Sathya, vous m'avez donné de l'ambition sans hésiter dès le début du projet",
            "Merci à Sujee, le créateur de l'appli Gigglz, le GOAT des jeux : allez installer son appli !!",
            "Et enfin tous mes amis, mes cousins avec qui j'ai pu tester le jeu et avoir des supers retours !",
          ],
        },
      ],
    },
    mentions: {
      title: 'Mentions Légales',
      sections: [
        {
          title: 'Développeur du site',
          content: `<strong>Responsable du site :</strong> Simeon Deivassagayame<br /><strong>Créateur du jeu :</strong> Sylvain Deivassagayame<br /><strong>Contact :</strong> onskonelejeu@gmail.com`,
        },
        {
          title: 'Hébergement',
          content: `Ce site est hébergé par des services d'hébergement web standards. Les informations concernant l'hébergeur peuvent être obtenues sur demande.`,
        },
        {
          title: 'Propriété intellectuelle',
          content: `L'ensemble des contenus (textes, images, graphismes, logo, icônes, etc.) figurant sur le site Onskone sont protégés par les lois relatives à la propriété intellectuelle et appartiennent à l'éditeur ou font l'objet d'une autorisation d'utilisation.`,
          extra: `Le détail des droits et interdictions figure dans les <a href="/cgu" class="text-primary underline">Conditions Générales d'Utilisation</a>.`,
        },
        {
          title: 'Crédits',
          content: `Les avatars utilisés dans ce jeu sont générés avec DiceBear (style "Micah").`,
          extra: `<a href="https://www.dicebear.com/styles/micah/" target="_blank" rel="noopener noreferrer" class="text-primary underline">DiceBear Micah</a> par <strong>DiceBear</strong>, sous licence <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" class="text-primary underline">CC BY 4.0</a>.`,
        },
        {
          title: 'Limitation de responsabilité',
          content: `Onskone ne pourra être tenu responsable des dommages directs ou indirects causés au matériel de l'utilisateur lors de l'accès au site. L'utilisateur s'engage à accéder au site en utilisant un matériel récent, ne contenant pas de virus et avec un navigateur mis à jour.`,
        },
      ],
    },
    privacy: {
      title: 'Politique de Confidentialité',
      sections: [
        {
          title: 'Collecte des données',
          content: `Onskone collecte uniquement les données strictement nécessaires au fonctionnement du jeu :`,
          list: [
            'Votre pseudo (choisi librement, non lié à votre identité)',
            'Vos réponses aux questions durant les parties',
          ],
        },
        {
          title: 'Utilisation des données',
          content: `Les données collectées sont utilisées exclusivement pour :`,
          list: [
            'Permettre le déroulement des parties de jeu',
            'Afficher les scores et résultats',
            `Améliorer l'expérience utilisateur`,
          ],
        },
        {
          title: 'Conservation des données',
          content: `Les données de jeu (pseudos, réponses) sont temporaires et ne sont pas conservées après la fin de la session de jeu. Aucune donnée personnelle n'est stockée de manière permanente sur nos serveurs.`,
        },
        {
          title: 'Cookies',
          content: `Le site peut utiliser des cookies techniques nécessaires au bon fonctionnement du service (gestion de session, préférences). Ces cookies ne collectent aucune donnée personnelle à des fins publicitaires.`,
        },
        {
          title: 'Vos droits',
          content: `Conformément à la réglementation en vigueur, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous à : onskonelejeu@gmail.com`,
        },
        {
          title: 'Partage des données',
          content: `Onskone ne vend, n'échange ni ne loue vos informations personnelles à des tiers. Vos données ne sont jamais partagées à des fins commerciales.`,
        },
      ],
    },
    cgu: {
      title: "Conditions Générales d'Utilisation",
      sections: [
        {
          title: 'Article 1 - Objet',
          content: `Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation de l'application Onskoné (ci-après « l'Application »), jeu numérique disponible sur le Google Play Store, l'Apple App Store et sur onskone.fr, ainsi que de l'ensemble du contenu associé : questions, decks thématiques, mécanique de jeu, textes et graphismes. En utilisant l'Application, l'utilisateur reconnaît avoir pris connaissance des présentes CGU et les accepter sans réserve. À défaut d'acceptation, il doit cesser toute utilisation.`,
        },
        {
          title: 'Article 2 - Propriété intellectuelle',
          content: `L'ensemble des éléments constitutifs d'Onskoné sont des créations originales protégées par le droit d'auteur (articles L.111-1 et suivants du Code de la propriété intellectuelle), dès leur création et sans formalité préalable. Sont notamment protégés :`,
          list: [
            'Les questions, formulations, thèmes et sous-thèmes constituant les decks de jeu',
            'La mécanique de jeu, sa conception, sa formulation et son intégration',
            "Le nom « Onskoné », le logo et les identités visuelles et sonores associées",
            "Le code source, les algorithmes, les interfaces et l'expérience utilisateur de l'Application",
            'Les traductions et adaptations culturelles des contenus, notamment la version anglaise',
          ],
          extra: `Toute reproduction, extraction, imitation, adaptation, traduction, diffusion ou réutilisation - partielle ou totale - de ces éléments, sans autorisation écrite et préalable, est strictement interdite, sur tout support et à toute finalité, et constitue une contrefaçon sanctionnée par les articles L.335-2 et L.335-3 du Code de la propriété intellectuelle. L'utilisation de l'Application est concédée au titre d'une licence personnelle, non exclusive, non transférable et non commerciale, ne conférant aucun droit de propriété sur l'Application ou son contenu.`,
        },
        {
          title: 'Article 3 - Contenu utilisateur',
          content: `L'Application ne collecte pas de contenu généré par les utilisateurs à des fins de conservation. Les réponses formulées lors d'une partie restent privées et temporaires : elles ne sont ni conservées après la session, ni exploitées, ni associées à un profil identifié.`,
        },
        {
          title: 'Article 4 - Contenu mature (+18)',
          content: `Certains decks signalés +18 comportent un contenu réservé aux personnes majeures. L'utilisateur est seul responsable de l'usage qu'il fait du contenu dans son contexte social et s'engage à ne pas utiliser l'Application d'une manière qui pourrait nuire à autrui. Onskoné ne saurait être tenu responsable d'un accès à ces contenus par un mineur ni d'un usage inadapté de l'Application.`,
        },
        {
          title: 'Article 5 - Données personnelles',
          content: `Onskoné traite les données personnelles conformément au RGPD (UE 2016/679) et à la loi Informatique et Libertés, en ne collectant que les données strictement nécessaires au fonctionnement du jeu. Le détail figure dans la <a href="/privacy" class="text-primary underline">Politique de confidentialité</a>.`,
        },
        {
          title: 'Article 6 - Disponibilité & responsabilité',
          content: `Onskoné s'efforce de maintenir l'Application disponible mais ne garantit pas une disponibilité ininterrompue. Onskoné ne pourra être tenu responsable des dommages directs ou indirects résultant d'une interruption de service, d'une erreur de contenu ou d'un usage inapproprié.`,
        },
        {
          title: 'Article 7 - Modification des CGU',
          content: `Onskoné se réserve le droit de modifier les présentes CGU à tout moment. La version en vigueur est celle disponible dans l'Application et sur onskone.fr. L'usage continu de l'Application après une modification vaut acceptation de la nouvelle version.`,
        },
        {
          title: 'Article 8 - Loi applicable & juridiction',
          content: `Les présentes CGU sont soumises au droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. À défaut d'accord, les tribunaux français seront compétents.`,
        },
      ],
    },
    support: {
      title: 'Aide & Support',
      sections: [
        {
          title: 'Un bug, une question ?',
          content: `Écris-nous, on lit tout et on répond avec plaisir :<br /><strong>Contact :</strong> <a href="mailto:onskonelejeu@gmail.com" class="text-primary underline">onskonelejeu@gmail.com</a>`,
          extra: `Tu peux aussi nous remonter un souci directement via le bouton ci-dessous.`,
        },
      ],
    },
    contact: {
      title: 'Nous contacter',
      intro: "Tu veux nous contacter mais tu sais pas comment ? T'inquiète, écris-nous où tu veux, ce sera un plaisir de te répondre :",
    },
    openPage: 'Ouvrir la page complète',
    tabs: { cgu: 'CGU', mentions: 'Mentions', privacy: 'Confidentialité' },
  },

  achievements: {
    'first-game': {
      title: 'Première partie',
      description: 'Tu as terminé ta toute première partie.',
    },
    'loyal-10': {
      title: 'Fidèle',
      description: '10 parties au compteur.',
    },
    'veteran-50': {
      title: 'Vétéran',
      description: '25 parties terminées. Mais t’es pas fatigué ?',
    },
    'mind-reader-20': {
      title: "Lecteur d'esprit",
      description: 'Trouver 20 réponses en tant que pilier.',
    },
    marathon: {
      title: 'Marathon',
      description: 'Terminer une partie de 10 manches ou plus.',
    },
    'top-1-thrice': {
      title: 'Sur le podium',
      description: "Finir 1er d'une partie, 3 fois.",
    },
    'zero-percent': {
      title: 'Catastrophe industrielle',
      description: 'Atteindre 0% en équipe. Bravo (?).',
    },
    'perfect-score': {
      title: 'Score parfait',
      description: 'Une équipe à 100%. Onskoné !',
    },
  },

  funFacts: [
    "Le jour de sa naissance, la première phrase prononcée par Squeezie a été : 'Est-ce que c'est bon pour vous ?'",
    "Au casino, tu peux remporter 4000 fois ta mise, mais tu ne peux perdre qu’1 fois ta mise, donc mise tout la prochaine fois ;)",
    "Il est statistiquement plus sûr de parier sur un but de Kylian Mbappé que sur un but de l’arbitre.",
    'Aller à la salle de sport régulièrement confère en plus du gain musculaire, une odeur corporelle nauséabonde',
    'Ne pas se brosser les dents entraîne systématiquement une haleine de dragon',
    'Manger du KFC tous les jours augmente fortement tes dépenses en papier toilette',
    "Celui qui s'endort avec les fesses qui grattent, se réveille avec les doigts qui puent",
    "Onskoné a crée 10 couples. Incroyable ! (et en a détruit 35)",
    "Le pilier de la manche qui arrive à 0 bonnes réponses a 50% d'être mauvais et 50% de chances d'être bourré.",
    "Ton mari ou ta femme n'a pas trouvé tes réponses pendant toute la partie ? C'est un motif valide de rupture (Article 711 du Code Civil)",
    "Si personne ne trouve tes réponses, deux hypothèses : tu es un génie incompris ou tu es juste extrêmement bizarre.",
    "Onskoné est actuellement interdit dans 0 pays. Mais ça pourrait changer (on croise les doigts !) ",
    "Onskoné est le seul jeu où tu peux te faire des amis et en perdre en même temps.",
  ],

  decks: {
    instruction: 'Clique sur les thèmes pour les ajouter/retirer',
    selectedCount: (n) => `${n} thème${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}`,
    all: 'Tout',
    loading: 'Chargement des decks de questions…',
    goToCategory: (cat) => `Aller à ${cat}`,
    categoryDescriptions: {
      ICEBREAKERS: 'Questions simples pour briser la glace',
      FUN: 'Amuse-toi avec tes amis sur des sujets marrants',
      DEEP: 'Plonge dans des discussions plus personnelles',
    },
  },

  themePicker: {
    title: 'Choisis tes thèmes',
    modify: 'Modifier',
    view: 'Voir les thèmes',
    emptyState: 'Aucun thème sélectionné',
    counter: (n) => `${n} sélectionné${n > 1 ? 's' : ''}`,
    hostHint: 'Tu es le seul à pouvoir choisir les thèmes.',
    readOnlyHint: (hostName) => `Seul ${hostName} peut choisir les thèmes.`,
    matureBadge: '18+',
    matureConfirm: {
      title: 'Contenu pour adultes',
      message: 'Ce thème contient des questions explicites réservées aux adultes. Tu confirmes vouloir l\'activer ?',
      confirm: 'J\'ai +18 ans',
      cancel: 'Euhhh, non',
    },
  },

  phases: {
    questionSelection: {
      leaderIs: 'Le pilier de cette manche est',
      waitingSelection: 'En attente de sa sélection de question…',
      didYouKnow: 'Le saviez-vous ?',
      swipeHintMobile: 'swipe pour changer de carte',
      swipeOverlayTitle: 'Swipe',
      swipeOverlaySub: 'pour changer de carte',
      chooseQuestion: 'Tu es le pilier, choisis une question !',
      goToCard: (theme) => `Voir la carte ${theme}`,
      goToCardIdx: (idx) => `Aller à la carte ${idx}`,
      prevCard: 'Carte précédente',
      nextCard: 'Carte suivante',
      reportQuestion: 'Signaler une question',
      loading: 'Chargement des questions...',
      selected: 'Question sélectionnée ! Passage à la phase suivante…',
    },
    answering: {
      questionAskedToOthers: 'Question posée aux autres joueurs',
      questionAskedBy: 'Question posée par',
      writeYourAnswer: 'Écris ta propre réponse',
      placeholder: 'Écris ta réponse…',
      send: 'Envoyer',
      yourAnswer: 'Ta réponse',
      editAnswer: 'Modifier ma réponse',
      waitingForOthers: 'En attente des autres joueurs…',
      answersReceived: 'Réponses reçues',
    },
    substituteSelection: {
      instructionLeader: 'Le joueur que tu choisis devra deviner la réponse que tu aurais donnée.',
      noPlayersDropdown: 'Aucun joueur disponible',
      validate: 'Valider',
      leaderChoosingPlayer: 'choisit le joueur qui répondra pour lui...',
      chooseGuesser: 'Choisis qui devra deviner ta réponse',
    },
    substituteAnswering: {
      writePrefix: 'Écris la réponse que',
      writeSuffix: 'aurait donnée',
      placeholder: (name) => `Écris ce que ${name} aurait répondu…`,
      send: 'Envoyer',
      sentWaiting: 'Réponse envoyée, en attente...',
      pilierWaiting: 'écrit la réponse que tu aurais donnée...',
      thenGuess: "Tu devras ensuite deviner ce qu'il a écrit pour toi.",
      writingAnswerOf: 'écrit la réponse de',
      remoteHelp: "Envoie lui des messages privés pour l'aider à répondre",
      localHelp: "Chuchote-lui dans l'oreille et aide-le à répondre",
      substituteFallback: 'Le substitut',
      leaderFallback: 'le pilier',
    },
    guessing: {
      loading: 'Chargement des réponses...',
      instruction: 'Clique sur chaque réponse pour l\'attribuer à un joueur',
      choosePlayer: 'Choisir un joueur',
      removeOption: 'Retirer l\'attribution',
      assignWaiting: 'assigne les réponses…',
      answers: 'Réponses',
      allAssigned: 'Toutes les réponses ont été attribuées',
      remainingCount: (n) => `Il reste ${n} réponse${n > 1 ? 's' : ''} à attribuer`,
      validate: 'Valider mes choix',
      removeAria: 'Retirer',
      rotateForLandscape: 'Tourne ton téléphone pour un affichage plus large',
      leaderFallback: 'le pilier',
    },
    reveal: {
      gameOver: 'Partie terminée !',
      readyNext: 'Prêt pour la suite ?',
      waitingPrefix: 'En attente que',
      waitingLeaderNext: 'lance la manche suivante…',
      waitingLeaderFinal: 'révèle les résultats finaux…',
      seeFinalResults: 'Voir les résultats finaux',
      nextRound: 'Manche suivante',
      watchScreen: 'Regarde son écran !',
      revealOnPhone: 'Révéler sur son téléphone',
      reveal: 'Révéler',
      next: 'Suivant',
      revealing: 'révèle les résultats…',
      noAttribution: (leader) => `${leader} ne t'a attribué aucune réponse`,
      remoteAttributedTo: 'Réponse attribuée à',
      rotateForLandscape: 'Tourne ton téléphone pour un affichage plus large',
      showYourScreen: 'Montre ton écran à tout le monde !',
      writtenBy: 'Écrit par',
    },
    similarity: {
      promptPrefix: '',
      promptMiddle: 'a la même réponse que',
      promptSuffix: ", c'est la même ?",
      yes: 'Oui',
      no: 'Non',
      waitingLeader: 'En attente du pilier...',
    },
    questionByline: {
      askedThisQuestion: 'a posé cette question :',
    },
    playerAnswerWaiting: {
      prefix: 'En attente que',
      suffix: "t'attribue une réponse…",
    },
  },

  shareCard: {
    eyebrow: 'VOUS VOUS CONNAISSEZ À',
    top3Label: 'TOP 3',
    ctaLine1: 'Viens jouer sur',
    ctaLine2: 'onskone.fr !',
    shareTitle: 'Onskoné',
  },

  apiErrors: {
    tooManyReports: 'Trop de signalements, réessaie plus tard.',
    reportFailed: "Impossible d'envoyer le signalement.",
    tooManyAttempts: 'Trop de tentatives, réessaie plus tard.',
    wrongPassword: 'Mot de passe incorrect.',
    sessionExpired: 'Session expirée. Reconnecte-toi.',
    loadError: 'Erreur de chargement.',
    updateError: 'Erreur de mise à jour.',
    deleteError: 'Erreur de suppression.',
  },
};
