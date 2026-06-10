import { Router, Request, Response } from 'express';
import { GameStatus, SUPPORTED_LOCALES, DEFAULT_LOCALE, isLocale } from '@onskone/shared';
import type {
  AdminLobbySummary,
  AdminLobbyPhase,
  AdminDeckSummary,
  Locale,
} from '@onskone/shared';
import { requireAdmin } from './admin.js';
import * as LobbyManager from '../managers/LobbyManager.js';
import { Game } from '../models/Game.js';
import { Lobby } from '../models/Lobby.js';

const router: Router = Router();

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

type QuestionsFile = Record<string, Record<string, { description: string; subjects: { subject: string; questions: string[] }[] }>>;

const decksCache: Partial<Record<Locale, { decks: AdminDeckSummary[]; at: number }>> = {};
const DECKS_CACHE_TTL_MS = 60 * 1000;

function loadDecks(locale: Locale): AdminDeckSummary[] {
  const now = Date.now();
  const cached = decksCache[locale];
  if (cached && now - cached.at < DECKS_CACHE_TTL_MS) return cached.decks;
  const questionsPath = path.join(process.cwd(), `src/data/questions_${locale}.json`);
  try {
    const raw = fs.readFileSync(questionsPath, 'utf-8');
    const data = JSON.parse(raw) as QuestionsFile;
    const out: AdminDeckSummary[] = [];
    for (const [category, themes] of Object.entries(data)) {
      for (const [theme, themeData] of Object.entries(themes)) {
        const subjectSummaries = themeData.subjects.map(s => ({
          subject: s.subject,
          questionCount: Array.isArray(s.questions) ? s.questions.length : 0,
          questions: Array.isArray(s.questions) ? s.questions : [],
        }));
        const questionCount = subjectSummaries.reduce((acc, s) => acc + s.questionCount, 0);
        out.push({
          category,
          theme,
          description: themeData.description ?? '',
          subjectCount: subjectSummaries.length,
          questionCount,
          subjects: subjectSummaries,
        });
      }
    }
    decksCache[locale] = { decks: out, at: now };
    return out;
  } catch (err) {
    logger.error(`Failed to read questions_${locale}.json for admin decks`, { error: err instanceof Error ? err.message : String(err) });
    return cached?.decks ?? [];
  }
}

router.get('/admin/decks', requireAdmin, (req: Request, res: Response) => {
  const raw = req.query.locale ?? req.query.lang;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const decks = loadDecks(locale);
  res.json({ decks, locale, availableLocales: SUPPORTED_LOCALES });
});

export default router;
