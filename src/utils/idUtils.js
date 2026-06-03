import { v4 as uuidv4 } from 'uuid';

export function shortId(prefix) {
  const raw = uuidv4().replaceAll('-', '').slice(0, 8).toUpperCase();
  return `${prefix}-${raw}`;
}

export function makeDedupKey(update) {
  const updateId = update?.update_id;
  const messageId = update?.message?.message_id || update?.edited_message?.message_id;
  const chatId = update?.message?.chat?.id || update?.edited_message?.chat?.id;
  return [updateId, chatId, messageId].filter(Boolean).join(':');
}
