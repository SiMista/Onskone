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
