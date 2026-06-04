
import { answerCallbackQuery, sendMessage, editMessageReplyMarkup } from './telegramService.js';
import { saveUserDecision, saveFollowupLog, markReminderStatus, updateApprovalStatus, saveStylePackFromReference } from './sheetsStorage.js';
import { escapeHtml } from '../utils/html.js';

export function parseCallbackData(data = '') {
  const [prefix, action, type, id] = String(data || '').split('|');
  if (prefix !== 'ptf') return null;
  return { action, type, id };
}

export async function handleCallbackQuery({ callbackQuery, runLogger }) {
  const parsed = parseCallbackData(callbackQuery.data);
  if (!parsed) return false;
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const fromText = callbackQuery.message?.text || callbackQuery.message?.caption || '';
  const { action, type, id } = parsed;

  const statusMap = {
    approve: 'Approved', edit: 'Needs Edit', postpone: 'Postponed', regen: 'Needs Regeneration',
    posted: 'Published', notyet: 'Not Published Yet', skip: 'Skipped', style: 'Style Reference',
    playerref: 'Player Reference', eventref: 'Event Reference'
  };
  const newStatus = statusMap[action] || action;

  await saveUserDecision({
    telegram_chat_id: chatId,
    telegram_message_id: messageId,
    related_type: type,
    related_id: id,
    decision: action,
    comment: '',
    status_before: '',
    status_after: newStatus,
    raw_text: fromText,
    raw_json: callbackQuery
  });

  if (type === 'rem') {
    if (action === 'posted') await markReminderStatus(id, 'Published', 'User clicked published');
    if (action === 'notyet') await markReminderStatus(id, 'Pending Retry', 'User clicked not yet');
    if (action === 'postpone') await markReminderStatus(id, 'Postponed', 'User clicked postpone');
    if (action === 'skip') await markReminderStatus(id, 'Skipped', 'User clicked skip');
    await saveFollowupLog({ reminder_id: id, related_object_id: id, action, old_status: '', new_status: newStatus, telegram_chat_id: chatId, telegram_message_id: messageId, notes: 'Callback button' });
  } else if (type === 'ref' && action === 'style') {
    await saveStylePackFromReference(id, { source: 'telegram_callback', notes: 'User marked reference as style pack' });
  } else if (type) {
    await updateApprovalStatus(id, newStatus, `User clicked ${action}`);
  }

  await answerCallbackQuery(callbackQuery.id, buttonAnswer(action));
  try { await editMessageReplyMarkup(chatId, messageId, null); } catch (e) { runLogger?.warn?.({ err: e.message }, 'Failed to remove inline keyboard'); }
  await sendMessage(chatId, replyText(action, type, id), { parse_mode: 'HTML' });
  return true;
}

function buttonAnswer(action) {
  if (action === 'posted') return 'Отмечено как опубликовано';
  if (action === 'approve') return 'Утверждено';
  if (action === 'notyet') return 'Ок, напомню позже';
  if (action === 'postpone') return 'Отложено';
  if (action === 'edit') return 'Жду правку сообщением';
  return 'Принято';
}

function replyText(action, type, id) {
  if (action === 'edit') return `✏️ <b>Жду правку</b>\n\nОтветь обычным сообщением, что изменить по объекту <code>${escapeHtml(type)}:${escapeHtml(id)}</code>.`;
  if (action === 'posted') return `✅ <b>Опубликовано</b>\n\nЯ зафиксировал статус и не буду больше напоминать по этой задаче.`;
  if (action === 'notyet') return `⏳ <b>Ок, ещё не опубликовано</b>\n\nЯ оставил задачу в follow-up и напомню позже.`;
  if (action === 'approve') return `✅ <b>Утверждено</b>\n\nЯ зафиксировал решение. Следующий шаг — исполнение по расписанию.`;
  if (action === 'style') return `🎨 <b>Стиль сохранён</b>\n\nЯ пометил этот референс как часть Style Pack.`;
  return `📌 <b>Принято</b>\n\nСтатус обновлён: <code>${escapeHtml(action)}</code>.`;
}
