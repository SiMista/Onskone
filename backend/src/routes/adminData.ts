import { Router, Request, Response } from 'express';
import { GameStatus } from '@onskone/shared';
import type {
  AdminLobbySummary,
  AdminLobbyPhase,
  AdminDeckSummary,
} from '@onskone/shared';
import { requireAdmin } from './admin.js';
import * as LobbyManager from '../managers/LobbyManager.js';
import { Game } from '../models/Game.js';
import { Lobby } from '../models/Lobby.js';

const router = Router();

function buildLobbySummary(lobby: Lobby): AdminLobbySummary {
  const game = lobby.game;

  let phase: AdminLobbyPhase = 'lobby';
  if (game) {
    phase = game.status === GameStatus.FINISHED ? 'ended' : 'playing';
  }

  let currentRound: number | null = null;
  let totalRounds: number | null = null;
  if (game) {
    currentRound = game.currentRound?.roundNumber ?? game.rounds.length;
    if (game instanceof Game) {
      try {
        totalRounds = game.getMaxRounds();
      } catch {
        totalRounds = null;
      }
    }
    if (!totalRounds || totalRounds <= 0) {
      totalRounds = lobby.players.filter(p => p.isActive).length;
    }
  }

  return {
    code: lobby.code,
    gameMode: lobby.gameMode,
    phase,
    lastActivity: lobby.lastActivity.getTime(),
    playerCount: lobby.players.length,
    activePlayerCount: lobby.players.filter(p => p.isActive).length,
    players: lobby.players.map(p => ({
      name: p.name,
      avatarId: p.avatarId,
      isHost: p.isHost,
      isActive: p.isActive,
    })),
    currentRound,
    totalRounds,
    selectedDecks: lobby.selectedDecks,
    guessMyAnswerMode: lobby.guessMyAnswerMode,
  };
}

router.get('/admin/lobbies', requireAdmin, (_req: Request, res: Response) => {
  const lobbies = LobbyManager.getLobbies();
  const summaries: AdminLobbySummary[] = [];
  for (const lobby of lobbies.values()) {
    summaries.push(buildLobbySummary(lobby));
  }
  summaries.sort((a, b) => b.lastActivity - a.lastActivity);
  res.json({ lobbies: summaries });
});

// ---- Decks ----

import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/logger.js';

type QuestionsFile = Record<string, Record<string, { subject: string; questions: string[] }[]>>;

let cachedDecks: AdminDeckSummary[] | null = null;
let cachedAt = 0;
const DECKS_CACHE_TTL_MS = 60 * 1000;

function loadDecks(): AdminDeckSummary[] {
  const now = Date.now();
  if (cachedDecks && now - cachedAt < DECKS_CACHE_TTL_MS) return cachedDecks;
  const questionsPath = path.join(process.cwd(), 'src/data/questions.json');
  try {
    const raw = fs.readFileSync(questionsPath, 'utf-8');
    const data = JSON.parse(raw) as QuestionsFile;
    const out: AdminDeckSummary[] = [];
    for (const [category, themes] of Object.entries(data)) {
      for (const [theme, subjects] of Object.entries(themes)) {
        const subjectSummaries = subjects.map(s => ({
          subject: s.subject,
          questionCount: Array.isArray(s.questions) ? s.questions.length : 0,
          questions: Array.isArray(s.questions) ? s.questions : [],
        }));
        const questionCount = subjectSummaries.reduce((acc, s) => acc + s.questionCount, 0);
        out.push({
          category,
          theme,
          subjectCount: subjectSummaries.length,
          questionCount,
          subjects: subjectSummaries,
        });
      }
    }
    cachedDecks = out;
    cachedAt = now;
    return out;
  } catch (err) {
    logger.error('Failed to read questions.json for admin decks', { error: err instanceof Error ? err.message : String(err) });
    return cachedDecks ?? [];
  }
}

router.get('/admin/decks', requireAdmin, (_req: Request, res: Response) => {
  const decks = loadDecks();
  res.json({ decks });
});

export default router;
