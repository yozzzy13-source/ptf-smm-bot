
import { answerCallbackQuery, sendMessage, editMessageReplyMarkup } from './telegramService.js';
import { saveUserDecision, saveFollowupLog, markReminderStatus, updateApprovalStatus, saveStylePackFromReference, updateReferenceAssetType, saveCurrentFocus, getCampaignByEventId } from './sheetsStorage.js';
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
    playerref: 'Player Reference', playercard: 'Player Card', eventref: 'Event Reference', brandlogo: 'Brand Logo Exact', venuelogo: 'Venue / Sponsor Logo Exact',
    focus: 'Focused', approve_v1: 'Visual Option 1 Approved', approve_v2: 'Visual Option 2 Approved', edit_v1: 'Needs Edit Option 1', edit_v2: 'Needs Edit Option 2', regen_both: 'Regenerate Both', generate: 'Generate Visual'
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

  } else if (type === 'cmp' && action === 'focus') {
    const campaign = await getCampaignByEventId(id);
    await saveCurrentFocus({ telegram_chat_id: chatId, related_event_id: id, campaign_id: id, focus_type: 'campaign', reason: 'User selected campaign from button', status: 'Active' });
  } else if (type === 'vjob' && ['approve_v1','approve_v2','edit_v1','edit_v2','regen_both'].includes(action)) {
    // Detailed visual version updates are handled by the next text instruction; here we preserve the decision trail.
  } else if ((type === 'visual' || type === 'ref') && action === 'generate') {
    // This button intentionally does not start expensive image generation inside callback.
    // It records the user's intent and asks for one explicit text confirmation.

  } else if (type === 'ref' && action === 'style') {
    await updateReferenceAssetType(id, 'Style Reference', 'User marked reference as style pack');
    await saveStylePackFromReference(id, { source: 'telegram_callback', notes: 'User marked reference as style pack' });
  } else if (type === 'ref' && action === 'playerref') {
    await updateReferenceAssetType(id, 'Player Reference', 'User marked reference as player reference. Use as identity/appearance reference only.');
  } else if (type === 'ref' && action === 'playercard') {
    await updateReferenceAssetType(id, 'Player Card', 'User marked reference as player card / website card screenshot.');
  } else if (type === 'ref' && action === 'brandlogo') {
    await updateReferenceAssetType(id, 'Brand Logo Exact', 'User marked as exact PTF brand logo. Do not redraw in image model; reserve top-center overlay space.');
  } else if (type === 'ref' && action === 'venuelogo') {
    await updateReferenceAssetType(id, 'Venue / Sponsor Logo Exact', 'User marked as exact venue/sponsor logo. Ask/choose per event; do not redraw when exact overlay is required.');
  } else if (type === 'ref' && action === 'eventref') {
    await updateReferenceAssetType(id, 'Event Reference', 'User marked reference as event reference');
  } else if (type === 'ref' && action === 'skip') {
    await updateReferenceAssetType(id, 'Do Not Use', 'User marked reference as do not use');
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
  if (action === 'style') return `🎨 <b>Стиль сохранён</b>\n\nЯ пометил этот референс как style/composition reference. Людей и логотипы с него нельзя использовать как identity.`; 
  if (action === 'brandlogo') return `🏷 <b>PTF logo exact сохранён</b>\n\nЯ пометил файл как точный логотип. В генерации я должен оставлять место под overlay и не просить модель перерисовывать его.`;
  if (action === 'venuelogo') return `🏷 <b>Логотип локации/партнёра сохранён</b>\n\nЯ пометил файл как точный venue/sponsor logo. Для будущих событий буду ждать твоего выбора, какой логотип подставлять.`; 
  if (action === 'playercard') return `🪪 <b>Player card сохранена</b>\n\nЯ пометил файл как карточку игрока / скрин с сайта. Можно использовать как player card asset.`;
  return `📌 <b>Принято</b>\n\nСтатус обновлён: <code>${escapeHtml(action)}</code>.`;
}
