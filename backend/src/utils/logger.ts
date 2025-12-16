/**
 * Simple structured logger for the backend
 * Can be replaced with winston/pino later if needed
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const formatLog = (entry: LogEntry): string => {
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}`;
};

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
};

const createLogEntry = (level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry => ({
  timestamp: new Date().toISOString(),
  level,
  message,
  context,
});

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (shouldLog('debug')) {
      console.log(formatLog(createLogEntry('debug', message, context)));
    }
  },

  info: (message: string, context?: Record<string, unknown>) => {
    if (shouldLog('info')) {
      console.log(formatLog(createLogEntry('info', message, context)));
    }
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    if (shouldLog('warn')) {
      console.warn(formatLog(createLogEntry('warn', message, context)));
    }
  },

  error: (message: string, context?: Record<string, unknown>) => {
    if (shouldLog('error')) {
      console.error(formatLog(createLogEntry('error', message, context)));
    }
  },

  // Shorthand for socket events
  socket: {
    connect: (socketId: string) => {
      logger.info('User connected', { socketId });
    },
    disconnect: (socketId: string, reason?: string) => {
      logger.info('User disconnected', { socketId, reason });
    },
    event: (event: string, socketId: string, data?: Record<string, unknown>) => {
      logger.debug(`Socket event: ${event}`, { socketId, ...data });
    },
  },

  // Shorthand for game events
  game: {
    created: (lobbyCode: string, hostName: string) => {
      logger.info('Lobby created', { lobbyCode, hostName });
    },
    started: (lobbyCode: string, playerCount: number) => {
      logger.info('Game started', { lobbyCode, playerCount });
    },
    ended: (lobbyCode: string) => {
      logger.info('Game ended', { lobbyCode });
    },
    roundStarted: (lobbyCode: string, roundNumber: number, leaderName: string) => {
      logger.info('Round started', { lobbyCode, roundNumber, leaderName });
    },
  },
};

export default logger;
