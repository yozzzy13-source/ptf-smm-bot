
import { config } from '../config.js';
import { logger } from './logger.js';
import { getDueReminders, markReminderSent } from './sheetsStorage.js';
import { sendMessage } from './telegramService.js';
import { postingKeyboard } from './telegramKeyboardService.js';

export function startFollowupScheduler() {
  if (!config.enableFollowupScheduler) { logger.info('Follow-up scheduler disabled'); return; }
  if (!config.followupTelegramChatId) { logger.info('Follow-up scheduler disabled: FOLLOWUP_TELEGRAM_CHAT_ID is empty'); return; }
  const interval = Math.max(1, config.followupIntervalMinutes) * 60 * 1000;
  setInterval(runFollowupTick, interval);
  setTimeout(runFollowupTick, 8000);
  logger.info({ intervalMinutes: config.followupIntervalMinutes }, 'Follow-up scheduler started');
}

async function runFollowupTick() {
  try {
    const due = await getDueReminders(20);
    for (const r of due) {
      const chatId = r.telegram_chat_id || config.followupTelegramChatId;
      const text = `⏰ <b>Follow-up</b>\n\n${r.message || r.title}\n\n<b>Статус?</b>`;
      const res = await sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: postingKeyboard(r.reminder_id, r.related_object_id) });
      const telegramMessageId = res?.data?.result?.message_id || '';
      await markReminderSent(r.reminder_id, telegramMessageId);
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Follow-up scheduler tick failed');
  }
}
