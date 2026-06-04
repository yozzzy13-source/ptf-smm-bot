
import { extractMediaFromMessage, getTelegramFile, telegramFileDownloadUrl } from './telegramService.js';
import { saveReferenceAsset, saveTelegramMessageLink } from './sheetsStorage.js';
import { mediaIntakeKeyboard } from './telegramKeyboardService.js';

export async function handleTelegramMediaMessage({ message, runLogger }) {
  const media = extractMediaFromMessage(message);
  if (!media) return null;
  let file = null;
  try { file = await getTelegramFile(media.fileId); } catch (err) { runLogger?.warn?.({ err: err.message }, 'Failed to get Telegram file metadata'); }
  const fileUrl = file?.file_path ? telegramFileDownloadUrl(file.file_path) : '';
  const caption = media.caption || '';
  const referenceType = inferReferenceType(caption);
  const saved = await saveReferenceAsset({
    source: 'Telegram',
    telegram_chat_id: message.chat?.id,
    telegram_message_id: message.message_id,
    telegram_file_id: media.fileId,
    drive_link: fileUrl,
    reference_type: referenceType,
    related_player: inferPlayer(caption),
    related_event_id: '',
    status: 'Needs Classification',
    notes: caption || media.fileName || media.type
  });
  await saveTelegramMessageLink({ telegram_chat_id: message.chat?.id, telegram_message_id: message.message_id, direction: 'inbound', related_type: 'reference_asset', related_id: saved.reference_id, context: caption, status: 'Saved' });
  return {
    reference: saved,
    textRu: `📎 <b>Медиа принято</b>\n\nЯ сохранил файл как reference asset.\nТип: <code>${referenceType}</code>\nID: <code>${saved.reference_id}</code>\n\nВыбери, как его использовать:`,
    parseMode: 'HTML',
    replyMarkup: mediaIntakeKeyboard(saved.reference_id)
  };
}

function inferReferenceType(text = '') {
  const t = String(text).toLowerCase();
  if (/стил|style|референс|reference|пример|постер/.test(t)) return 'Style Reference';
  if (/игрок|player|портрет|avatar|аватар|фото/.test(t)) return 'Player Reference';
  if (/матч|event|событ|турнир/.test(t)) return 'Event Reference';
  return 'Unsorted Telegram Media';
}
function inferPlayer(text = '') {
  const m = String(text).match(/(?:player|игрок|для)[:\s]+([A-Za-zА-Яа-яЁё]+(?:\s+[A-Za-zА-Яа-яЁё]+)?)/i);
  return m ? m[1] : '';
}
