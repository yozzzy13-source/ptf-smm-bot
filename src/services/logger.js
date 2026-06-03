import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  transport: config.nodeEnv === 'production' ? undefined : { target: 'pino-pretty' },
  redact: ['telegramBotToken', 'openaiApiKey', 'authorization', 'headers.authorization']
});

export function makeRunLogger(runId) {
  return logger.child({ runId });
}
