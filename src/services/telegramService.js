import axios from 'axios';
import { config } from '../config.js';
import { truncate } from '../utils/validation.js';

const baseUrl = `https://api.telegram.org/bot${config.telegramBotToken}`;

export async function sendMessage(chatId, text, options = {}) {
  const payload = {
    chat_id: chatId,
    text: truncate(text, 3900),
    parse_mode: options.parseMode || undefined,
    reply_markup: options.replyMarkup || undefined,
    disable_web_page_preview: options.disableWebPagePreview ?? true
  };
  const res = await axios.post(`${baseUrl}/sendMessage`, payload);
  return res.data;
}

export async function setWebhook() {
  const webhookUrl = `${config.publicBaseUrl}/telegram/webhook/${config.webhookSecret}`;
  const res = await axios.post(`${baseUrl}/setWebhook`, {
    url: webhookUrl,
    allowed_updates: ['message', 'edited_message'],
    drop_pending_updates: false
  });
  return { webhookUrl, response: res.data };
}

export function extractMessage(update) {
  return update.message || update.edited_message || null;
}

export function extractTextFromMessage(message) {
  if (!message) return '';
  return message.text || message.caption || '';
}
