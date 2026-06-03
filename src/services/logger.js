import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.logLevel,
  transport: config.nodeEnv === 'production' ? undefined : { target: 'pino-pretty' },
  redact: [
    'telegramBotToken',
    'openaiApiKey',
    'authorization',
    'headers.authorization',
    'googleServiceAccountBase64',
    'private_key'
  ]
});

export function makeRunLogger(runId) {
  return logger.child({ runId });
}
