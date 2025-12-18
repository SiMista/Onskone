import { IPlayer } from './player.js';
import { IGame, LeaderboardEntry } from './game.js';
import { IRound, GameCard, RoundPhase } from './round.js';

/**
 * Résultat d'une réponse dans la phase de révélation
 */
export interface RevealResult {
  /** ID du joueur qui a écrit la réponse */
  playerId: string;

  /** Nom du joueur qui a écrit la réponse */
  playerName: string;

  /** ID de l'avatar du joueur qui a écrit la réponse */
  playerAvatarId?: number;

  /** Texte de la réponse */
  answer: string;

  /** ID du joueur deviné par le chef */
  guessedPlayerId: string;

  /** Nom du joueur deviné par le chef */
  guessedPlayerName: string;

  /** ID de l'avatar du joueur deviné par le chef */
  guessedPlayerAvatarId?: number;

  /** Si le chef a correctement deviné */
  correct: boolean;
}

/**
 * Événements envoyés par le SERVEUR vers les CLIENTS
 */
export interface ServerToClientEvents {
  // ===== LOBBY EVENTS =====

  /** Confirmation de création d'un lobby */
  lobbyCreated: (data: { lobbyCode: string }) => void;

  /** Confirmation de jointure au lobby */
  joinedLobby: (data: { player: IPlayer }) => void;

  /** Mise à jour de la liste des joueurs */
  updatePlayersList: (data: { players: IPlayer[] }) => void;

  /** Notification d'expulsion du lobby */
  kickedFromLobby: () => void;

  /** Vérification si le nom du joueur existe déjà */
  playerNameExists: (data: { playerName: string }) => void;

  /** Le nom du joueur est valide */
  playerNameValid: () => void;

  /** Informations sur un lobby (pour les liens d'invitation) */
  lobbyInfo: (data: { exists: boolean; hostName?: string | null }) => void;

  // ===== GAME EVENTS =====

  /** Notification de démarrage du jeu */
  gameStarted: (data: { game: IGame }) => void;

  /** Envoi de l'état complet du jeu (pour reconnexion) */
  gameState: (data: {
    game: IGame;
    players: IPlayer[];
    leaderboard: LeaderboardEntry[];
    reconnectionData?: {
      answeredPlayerIds: string[];
      myAnswer?: string;
      currentGuesses?: Record<string, string>;
      relancesUsed?: number;
    };
  }) => void;

  /** Démarrage d'un nouveau round */
  roundStarted: (data: { round: IRound }) => void;

  /** Réception des 3 questions pour le chef */
  questionsReceived: (data: { questions: GameCard[] }) => void;

  /** Une question a été sélectionnée par le chef */
  questionSelected: (data: {
    question: string;
    phase: RoundPhase;
    auto?: boolean; // Si la question a été auto-sélectionnée (timer expiré)
  }) => void;

  /** Un joueur a soumis sa réponse */
  playerAnswered: (data: {
    playerId: string;
    totalAnswers: number;
    expectedAnswers: number;
  }) => void;

  /** Toutes les réponses ont été soumises */
  allAnswersSubmitted: (data: {
    phase: RoundPhase;
    answersCount: number;
    forced?: boolean; // Si forcé par expiration du timer
  }) => void;

  /** Réception des réponses mélangées pour le chef */
  shuffledAnswersReceived: (data: {
    answers: Array<{ id: string; text: string }>;
    players: IPlayer[]; // Joueurs qui ont répondu (sans le chef)
  }) => void;

  /** Mise à jour d'une attribution (drag & drop en temps réel) */
  guessUpdated: (data: {
    answerId: string;
    playerId: string | null;
    currentGuesses: Record<string, string>;
  }) => void;

  /** Révélation des résultats du round */
  revealResults: (data: {
    phase: RoundPhase;
    results: RevealResult[];
    scores: Record<string, number>;
    leaderboard: LeaderboardEntry[];
    forced?: boolean; // Si forcé par expiration du timer
  }) => void;

  /** Une réponse a été révélée par le chef */
  answerRevealed: (data: {
    revealedIndex: number; // Index de la réponse révélée
  }) => void;

  /** Démarrage d'un timer */
  timerStarted: (data: {
    phase: RoundPhase;
    duration: number; // Durée en secondes
    startedAt: number; // Timestamp de démarrage (pour sync)
  }) => void;

  /** État actuel du timer (réponse à requestTimerState) */
  timerState: (data: {
    phase: RoundPhase;
    duration: number;
    startedAt: number;
  } | null) => void;

  /** Fin de la partie */
  gameEnded: (data: {
    leaderboard: LeaderboardEntry[];
    rounds: IRound[];
  }) => void;

  // ===== ERROR EVENTS =====

  /** Erreur générique */
  error: (data: {
    message: string;
    code?: string; // Code d'erreur optionnel
  }) => void;
}

/**
 * Événements envoyés par les CLIENTS vers le SERVEUR
 */
export interface ClientToServerEvents {
  // ===== LOBBY EVENTS =====

  /** Créer un nouveau lobby */
  createLobby: (data: {
    playerName: string;
    avatarId?: number;
  }) => void;

  /** Rejoindre un lobby existant */
  joinLobby: (data: {
    lobbyCode: string;
    playerName: string;
    avatarId?: number;
  }) => void;

  /** Quitter le lobby */
  leaveLobby: (data: {
    lobbyCode: string;
    currentPlayerId: string;
  }) => void;

  /** Expulser un joueur (réservé à l'hôte) */
  kickPlayer: (data: {
    lobbyCode: string;
    playerId: string;
  }) => void;

  /** Promouvoir un joueur comme hôte */
  promotePlayer: (data: {
    lobbyCode: string;
    playerId: string;
  }) => void;

  /** Vérifier si un nom de joueur est disponible */
  checkPlayerName: (data: {
    lobbyCode: string;
    playerName: string;
  }) => void;

  /** Récupérer les informations d'un lobby (pour les liens d'invitation) */
  getLobbyInfo: (data: {
    lobbyCode: string;
  }) => void;

  // ===== GAME EVENTS =====

  /** Démarrer la partie (réservé à l'hôte) */
  startGame: (data: {
    lobbyCode: string;
  }) => void;

  /** Récupérer l'état actuel du jeu (pour reconnexion) */
  getGameState: (data: {
    lobbyCode: string;
    playerId?: string;
  }) => void;

  /** Demander des cartes de questions (réservé au chef) */
  requestQuestions: (data: {
    lobbyCode: string;
    count?: number;
    isRelance?: boolean;
  }) => void;

  /** Sélectionner une question parmi les 3 (réservé au chef) */
  selectQuestion: (data: {
    lobbyCode: string;
    selectedQuestion: string;
  }) => void;

  /** Soumettre une réponse */
  submitAnswer: (data: {
    lobbyCode: string;
    playerId: string;
    answer: string;
  }) => void;

  /** Demander les réponses mélangées (réservé au chef) */
  requestShuffledAnswers: (data: {
    lobbyCode: string;
  }) => void;

  /** Mettre à jour une attribution (drag & drop) */
  updateGuess: (data: {
    lobbyCode: string;
    answerId: string;
    playerId: string | null;
  }) => void;

  /** Soumettre les attributions finales (réservé au chef) */
  submitGuesses: (data: {
    lobbyCode: string;
    guesses: Record<string, string>;
  }) => void;

  /** Démarrer un timer pour une phase */
  startTimer: (data: {
    lobbyCode: string;
    duration?: number; // Durée en secondes (défaut: 60)
  }) => void;

  /** Notifier que le timer a expiré */
  timerExpired: (data: {
    lobbyCode: string;
  }) => void;

  /** Demander l'état actuel du timer (utile pour les navigateurs lents) */
  requestTimerState: (data: {
    lobbyCode: string;
    phase?: RoundPhase;
  }) => void;

  /** Révéler la prochaine réponse (réservé au chef) */
  revealNextAnswer: (data: {
    lobbyCode: string;
  }) => void;

  /** Passer au round suivant (ou terminer le jeu) */
  nextRound: (data: {
    lobbyCode: string;
  }) => void;

  /** Récupérer les résultats finaux */
  getGameResults: (data: {
    lobbyCode: string;
  }) => void;
}