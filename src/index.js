import express from 'express';
import { config } from './config.js';
import { logger, makeRunLogger } from './services/logger.js';
import { extractMessage, extractTextFromMessage, sendMessage, sendPhoto, answerCallbackQuery } from './services/telegramService.js';
import { isDuplicate, markProcessed } from './services/dedupService.js';
import { makeDedupKey, shortId } from './utils/idUtils.js';
import { isAdminUser, normalizeText } from './utils/validation.js';
import { processUserText } from './services/orchestrator.js';
import { handleAdminCommand } from './services/commandService.js';
import { handleCallbackQuery } from './services/callbackActionService.js';
import { handleTelegramMediaMessage } from './services/mediaIntakeService.js';
import { startFollowupScheduler } from './services/reminderService.js';
import { generateTodayPackSummary } from './agents/todayPackAgent.js';
import { saveSystemLog, syncSourceRegistryDefaults, seedStrategicDefaults, saveTelegramMessageLink } from './services/sheetsStorage.js';
import { ensureSheetHeaders } from './services/googleSheetsService.js';
import { HEADERS } from './schemas/sheetSchema.js';

const app = express();
app.use(express.json({ limit: '20mb' }));
app.get('/', (_, res) => res.status(200).send('PTF SMM Bot is running'));
app.get('/health', (_, res) => res.status(200).json({ ok:true, service:'ptf-smm-bot', version:'0.4.1', env:config.nodeEnv, autoSetupSheets:config.autoSetupSheets, imageGenerationEnabled:config.enableImageGeneration, imageModel:config.openaiImageModel, strategicModel:config.openaiStrategicModel, sendGeneratedImagesToTelegram: config.sendGeneratedImagesToTelegram, followupScheduler: config.enableFollowupScheduler }));

app.post('/telegram/webhook/:secret', async (req, res) => {
  const receivedSecret = req.params.secret;
  if (receivedSecret !== config.webhookSecret) return res.status(403).json({ ok:false, error:'Invalid webhook secret' });
  const update = req.body; const runId = shortId('RUN'); const runLogger = makeRunLogger(runId);
  res.status(200).json({ ok:true });
  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      const fromId = cq.from?.id;
      if (!isAdminUser(fromId, config.adminTelegramUserIds)) {
        await answerCallbackQuery(cq.id, 'Нет доступа');
        return;
      }
      await handleCallbackQuery({ callbackQuery: cq, runLogger });
      return;
    }

    const dedupKey = makeDedupKey(update);
    if (await isDuplicate(dedupKey)) return;
    const message = extractMessage(update); if (!message) return;
    const fromId = message.from?.id; const chatId = message.chat?.id;
    if (!isAdminUser(fromId, config.adminTelegramUserIds)) { await sendMessage(chatId, 'Этот бот сейчас работает только для админов PTF SMM.'); await markProcessed(dedupKey,'telegram','unauthorized'); return; }

    const mediaResult = await handleTelegramMediaMessage({ message, runLogger });
    if (mediaResult) {
      const resMsg = await sendMessage(chatId, mediaResult.textRu, { parse_mode:'HTML', reply_markup: mediaResult.replyMarkup });
      await saveTelegramMessageLink({ telegram_chat_id:chatId, telegram_message_id:resMsg?.data?.result?.message_id || '', direction:'outbound', related_type:'reference_asset', related_id:mediaResult.reference.reference_id, context:'media intake reply', status:'Sent' });
      await markProcessed(dedupKey,'telegram','media_intake');
      return;
    }

    const text = normalizeText(extractTextFromMessage(message));
    if (!text) { await sendMessage(chatId, 'Пока понимаю текст, фото и изображения. Видео/документы добавим следующим слоем.'); await markProcessed(dedupKey,'telegram','empty_text'); return; }

    const commandResult = await handleAdminCommand({ text, runLogger });
    if (commandResult) {
      const sent = await sendMessage(chatId, commandResult.textRu, commandResult.parseMode === 'HTML' ? { parse_mode:'HTML' } : {});
      await saveTelegramMessageLink({ telegram_chat_id:chatId, telegram_message_id:sent?.data?.result?.message_id || '', direction:'outbound', related_type:'command', related_id:commandResult.type || 'command', context:text, status:'Sent' });
      await markProcessed(dedupKey,'telegram',commandResult.type || 'command');
      if (commandResult.restart) setTimeout(() => process.exit(0), 500);
      return;
    }

    await sendMessage(chatId, 'Принял. Думаю как SMM-директор и собираю пакет…');
    const result = await processUserText({ text, messageMeta:{ runId, telegramSource:`chat:${chatId}/message:${message.message_id}`, chatId, messageId:message.message_id }, runLogger });

    if (config.sendMultiMessageReplies && Array.isArray(result.messages) && result.messages.length) {
      for (const msg of result.messages) {
        const sent = await sendMessage(chatId, msg.text, { ...(msg.parseMode === 'HTML' ? { parse_mode:'HTML' } : {}), ...(msg.replyMarkup ? { reply_markup: msg.replyMarkup } : {}) });
        await saveTelegramMessageLink({ telegram_chat_id:chatId, telegram_message_id:sent?.data?.result?.message_id || '', direction:'outbound', related_type:result.type, related_id:msg.relatedId || '', context:(msg.text || '').slice(0,300), status:'Sent' });
      }
    } else {
      const sent = await sendMessage(chatId, result.textRu, result.parseMode === 'HTML' ? { parse_mode:'HTML', ...(result.replyMarkup ? { reply_markup: result.replyMarkup } : {}) } : (result.replyMarkup ? { reply_markup: result.replyMarkup } : {}));
      await saveTelegramMessageLink({ telegram_chat_id:chatId, telegram_message_id:sent?.data?.result?.message_id || '', direction:'outbound', related_type:result.type, related_id:'', context:(result.textRu || '').slice(0,300), status:'Sent' });
    }

    if (config.sendGeneratedImagesToTelegram && Array.isArray(result.telegramImages) && result.telegramImages.length) {
      const imagesToSend = result.telegramImages.slice(0, config.telegramMaxMediaSend);
      for (const img of imagesToSend) {
        try {
          const caption = img.driveLink ? `${img.caption}\n<a href="${img.driveLink}">Open in Drive</a>` : img.caption;
          await sendPhoto(chatId, img.photoUrl, { caption, parse_mode: 'HTML' });
        } catch (photoErr) {
          runLogger.warn({ err: photoErr.message, img }, 'Failed to send generated image to Telegram');
        }
      }
    }
    await markProcessed(dedupKey,'telegram',result.type);
  } catch (err) {
    logger.error({ err: err.stack || err.message, runId }, 'Webhook processing failed');
    try { const message = extractMessage(update); if (message?.chat?.id) await sendMessage(message.chat.id, `Ошибка обработки. Run ID: ${runId}\n${err.message}`); await saveSystemLog({ run_id:runId, level:'ERROR', agent:'Webhook', action:'process_update', status:'Failed', error:err.stack || err.message, raw_json:update }); } catch (e) { logger.error({ err:e.message }, 'Failed to notify error'); }
  }
});

async function bootstrap() {
  if (config.autoSetupSheets) {
    try { await ensureSheetHeaders(HEADERS); await syncSourceRegistryDefaults(); if (config.seedStrategicDefaults) await seedStrategicDefaults(); logger.info('Google Sheet structure ensured and strategic defaults seeded'); }
    catch (err) { logger.error({ err: err.stack || err.message }, 'Google Sheet auto-setup failed. Bot will start, but Sheets operations may fail until fixed.'); }
  }
  app.listen(config.port, () => { logger.info({ port:config.port }, 'PTF SMM Bot started'); startDailyPackScheduler(); startFollowupScheduler(); });
}
bootstrap();

function startDailyPackScheduler() {
  if (!config.dailyPackTelegramChatId) { logger.info('Daily pack scheduler disabled: DAILY_PACK_TELEGRAM_CHAT_ID is empty'); return; }
  let lastSentDate = '';
  setInterval(async () => { try { const now = new Date(); const bangkokHour = Number(new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,hour:'2-digit',hour12:false}).format(now)); const bangkokDate = new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now); if (bangkokHour === config.dailyPackHour && lastSentDate !== bangkokDate) { const pack = await generateTodayPackSummary(); await sendMessage(config.dailyPackTelegramChatId, `📌 Daily reminder\n\n${pack.summaryRu}\n\nНапиши: “today pack”, чтобы получить список задач.`); lastSentDate = bangkokDate; } } catch (err) { logger.error({err:err.message}, 'Daily pack scheduler failed'); } }, 10*60*1000);
}
