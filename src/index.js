
import express from 'express';
import { config } from './config.js';
import { logger, makeRunLogger } from './services/logger.js';
import { extractMessage, extractTextFromMessage, sendMessage } from './services/telegramService.js';
import { isDuplicate, markProcessed } from './services/dedupService.js';
import { makeDedupKey, shortId } from './utils/idUtils.js';
import { isAdminUser, normalizeText } from './utils/validation.js';
import { processUserText } from './services/orchestrator.js';
import { generateTodayPackSummary } from './agents/todayPackAgent.js';
import { saveSystemLog, syncSourceRegistryDefaults } from './services/sheetsStorage.js';
import { ensureSheetHeaders } from './services/googleSheetsService.js';
import { HEADERS } from './schemas/sheetSchema.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

app.get('/', (_, res) => res.status(200).send('PTF SMM Bot is running'));
app.get('/health', (_, res) => res.status(200).json({
  ok: true,
  service: 'ptf-smm-bot',
  env: config.nodeEnv,
  autoSetupSheets: config.autoSetupSheets,
  webhookSecretConfigured: Boolean(config.webhookSecret && config.webhookSecret !== 'local-dev-secret'),
  imageGenerationEnabled: config.enableImageGeneration
}));

app.post('/telegram/webhook/:secret', async (req, res) => {
  const receivedSecret = req.params.secret;
  if (receivedSecret !== config.webhookSecret) {
    logger.warn({ receivedSecret, expectedSecret: config.webhookSecret }, 'Webhook secret mismatch');
    return res.status(403).json({ ok: false, error: 'Invalid webhook secret' });
  }

  const update = req.body;
  const runId = shortId('RUN');
  const runLogger = makeRunLogger(runId);

  res.status(200).json({ ok: true });

  try {
    const dedupKey = makeDedupKey(update);
    if (await isDuplicate(dedupKey)) {
      runLogger.info({ dedupKey }, 'Duplicate Telegram update ignored');
      return;
    }

    const message = extractMessage(update);
    if (!message) return;
    const fromId = message.from?.id;
    const chatId = message.chat?.id;

    if (!isAdminUser(fromId, config.adminTelegramUserIds)) {
      runLogger.warn({ fromId }, 'Unauthorized user');
      await sendMessage(chatId, 'Этот бот сейчас работает только для админов PTF SMM.');
      await markProcessed(dedupKey, 'telegram', 'unauthorized');
      return;
    }

    const text = normalizeText(extractTextFromMessage(message));
    if (!text) {
      await sendMessage(chatId, 'Пока MVP понимает только текст. Можно надиктовать через iPhone dictation и отправить текстом.');
      await markProcessed(dedupKey, 'telegram', 'empty_text');
      return;
    }

    await sendMessage(chatId, 'Принял. Собираю SMM-пакет…');

    const result = await processUserText({
      text,
      messageMeta: {
        runId,
        telegramSource: `chat:${chatId}/message:${message.message_id}`
      },
      runLogger
    });

    await sendMessage(chatId, result.textRu, result.parseMode === 'HTML' ? { parse_mode: 'HTML' } : {});
    await markProcessed(dedupKey, 'telegram', result.type);
  } catch (err) {
    logger.error({ err: err.stack || err.message, runId }, 'Webhook processing failed');
    try {
      const message = extractMessage(update);
      if (message?.chat?.id) {
        await sendMessage(message.chat.id, `Ошибка обработки. Run ID: ${runId}
${err.message}`);
      }
      await saveSystemLog({ run_id: runId, level: 'ERROR', agent: 'Webhook', action: 'process_update', status: 'Failed', error: err.stack || err.message, raw_json: update });
    } catch (e) {
      logger.error({ err: e.message }, 'Failed to notify error');
    }
  }
});

async function bootstrap() {
  if (config.autoSetupSheets) {
    try {
      await ensureSheetHeaders(HEADERS);
      await syncSourceRegistryDefaults();
      logger.info('Google Sheet structure ensured');
    } catch (err) {
      logger.error({ err: err.stack || err.message }, 'Google Sheet auto-setup failed. Bot will start, but Sheets operations may fail until fixed.');
    }
  }

  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'PTF SMM Bot started');
    startDailyPackScheduler();
  });
}

bootstrap();

function startDailyPackScheduler() {
  if (!config.dailyPackTelegramChatId) {
    logger.info('Daily pack scheduler disabled: DAILY_PACK_TELEGRAM_CHAT_ID is empty');
    return;
  }
  let lastSentDate = '';
  setInterval(async () => {
    try {
      const now = new Date();
      const bangkokHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, hour: '2-digit', hour12: false }).format(now));
      const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      if (bangkokHour === config.dailyPackHour && lastSentDate !== bangkokDate) {
        const pack = await generateTodayPackSummary();
        await sendMessage(config.dailyPackTelegramChatId, `📌 Daily reminder

${pack.summaryRu}

Напиши: “today pack”, чтобы получить список задач.`);
        lastSentDate = bangkokDate;
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Daily pack scheduler failed');
    }
  }, 10 * 60 * 1000);
}
