import axios from 'axios';
import { config } from '../config.js';
import { extractErrorDetails, stripHtml, limitText } from '../utils/errorUtils.js';

const api = axios.create({ baseURL: `https://api.telegram.org/bot${config.telegramBotToken}` });
export function extractMessage(update) { return update.message || update.edited_message || update.channel_post || null; }
export function extractTextFromMessage(message) { return message.text || message.caption || ''; }

async function postTelegram(method, payload) {
  try {
    return await api.post(method, payload);
  } catch (err) {
    const details = extractErrorDetails(err);
    const e = new Error(`Telegram ${method} failed — ${details.short}`);
    e.details = details;
    e.original = err;
    throw e;
  }
}

export async function sendMessage(chatId, text, options = {}) {
  if (!chatId) return null;
  const htmlMode = options.parse_mode === 'HTML';
  const payload = {
    chat_id: chatId,
    text: limitText(text, htmlMode ? 3400 : 3900),
    disable_web_page_preview: true,
    ...options
  };

  try {
    return await postTelegram('/sendMessage', payload);
  } catch (err) {
    // Telegram is strict with HTML entities. If formatted output fails, retry as plain text
    // so the whole workflow does not look broken to the user.
    if (htmlMode) {
      const plainPayload = {
        chat_id: chatId,
        text: limitText(stripHtml(text), 3900),
        disable_web_page_preview: true
      };
      return await postTelegram('/sendMessage', plainPayload);
    }
    throw err;
  }
}

export async function sendPhoto(chatId, photo, options = {}) {
  if (!chatId || !photo) return null;
  try {
    return await postTelegram('/sendPhoto', { chat_id: chatId, photo, ...options });
  } catch (err) {
    if (options.parse_mode === 'HTML') {
      const fallback = { ...options, caption: stripHtml(options.caption || '') };
      delete fallback.parse_mode;
      return await postTelegram('/sendPhoto', { chat_id: chatId, photo, ...fallback });
    }
    throw err;
  }
}


export async function answerCallbackQuery(callbackQueryId, text = '', options = {}) {
  if (!callbackQueryId) return null;
  return postTelegram('/answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: false, ...options });
}

export async function editMessageReplyMarkup(chatId, messageId, replyMarkup = null) {
  if (!chatId || !messageId) return null;
  return postTelegram('/editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup });
}

export async function getTelegramFile(fileId) {
  if (!fileId) return null;
  const res = await postTelegram('/getFile', { file_id: fileId });
  return res.data?.result || null;
}

export function telegramFileDownloadUrl(filePath) {
  if (!filePath) return '';
  return `https://api.telegram.org/file/bot${config.telegramBotToken}/${filePath}`;
}

export function extractMediaFromMessage(message = {}) {
  if (Array.isArray(message.photo) && message.photo.length) {
    const best = message.photo[message.photo.length - 1];
    return { type: 'photo', fileId: best.file_id, fileUniqueId: best.file_unique_id, caption: message.caption || '' };
  }
  if (message.document && String(message.document.mime_type || '').startsWith('image/')) {
    return { type: 'image_document', fileId: message.document.file_id, fileUniqueId: message.document.file_unique_id, fileName: message.document.file_name || '', caption: message.caption || '' };
  }
  return null;
}
