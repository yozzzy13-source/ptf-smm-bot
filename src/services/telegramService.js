import axios from 'axios';
import { config } from '../config.js';
const api = axios.create({ baseURL: `https://api.telegram.org/bot${config.telegramBotToken}` });
export function extractMessage(update) { return update.message || update.edited_message || update.channel_post || null; }
export function extractTextFromMessage(message) { return message.text || message.caption || ''; }
export async function sendMessage(chatId, text, options = {}) {
  if (!chatId) return null;
  const limit = 3900;
  const payload = { chat_id: chatId, text: String(text || '').slice(0, limit), disable_web_page_preview: true, ...options };
  return api.post('/sendMessage', payload);
}

export async function sendPhoto(chatId, photo, options = {}) {
  if (!chatId || !photo) return null;
  const payload = { chat_id: chatId, photo, ...options };
  return api.post('/sendPhoto', payload);
}
