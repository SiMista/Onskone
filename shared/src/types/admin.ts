import { GameMode } from './lobby.js';
import { SelectedDecks } from './decks.js';

export type AdminLobbyPhase = 'lobby' | 'playing' | 'ended';

export interface AdminLobbyPlayer {
  name: string;
  avatarId: number;
  isHost: boolean;
  isActive: boolean;
}

export interface AdminLobbySummary {
  code: string;
  gameMode: GameMode;
  phase: AdminLobbyPhase;
  lastActivity: number;
  playerCount: number;
  activePlayerCount: number;
  players: AdminLobbyPlayer[];
  currentRound: number | null;
  totalRounds: number | null;
  selectedDecks: SelectedDecks;
  guessMyAnswerMode: boolean;
}

export interface AdminDeckSubject {
  subject: string;
  questionCount: number;
  questions: string[];
}

export interface AdminDeckSummary {
  category: string;
  theme: string;
  /** Description du thème (depuis l'onglet "Noms Themes" de l'Excel source) */
  description: string;
  subjectCount: number;
  questionCount: number;
  subjects: AdminDeckSubject[];
}

/** Une ligne de stats de popularité (thème ou question). */
export interface AdminDeckStatRow {
  category: string;
  theme: string;
  /** Texte de la question ; absent pour une ligne de thème. */
  question?: string;
  /** Nombre de fois où l'élément a été proposé au pilier. */
  shown: number;
  /** Nombre de fois où le pilier l'a choisi. */
  picked: number;
  /** picked / shown, en pourcentage (0-100). */
  pickRate: number;
  /** Part de ce thème/cette question dans tous les choix (0-100). */
  pickShare: number;
}

export interface AdminDeckStats {
  totalPicks: number;
  totalShown: number;
  themes: AdminDeckStatRow[];
  questions: AdminDeckStatRow[];
}
