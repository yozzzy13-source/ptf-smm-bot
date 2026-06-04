import { extractMediaFromMessage, getTelegramFile, telegramFileDownloadUrl, downloadTelegramFileBuffer } from './telegramService.js';
import { saveReferenceAsset, saveTelegramMessageLink, getActiveCampaign } from './sheetsStorage.js';
import { uploadBufferToDrive } from './googleDriveService.js';
import { mediaIntakeKeyboard } from './telegramKeyboardService.js';

export async function handleTelegramMediaMessage({ message, runLogger }) {
  const media = extractMediaFromMessage(message);
  if (!media) return null;
  let file = null;
  try { file = await getTelegramFile(media.fileId); } catch (err) { runLogger?.warn?.({ err: err.message }, 'Failed to get Telegram file metadata'); }
  const fileUrl = file?.file_path ? telegramFileDownloadUrl(file.file_path) : '';
  const caption = media.caption || '';
  const active = await getActiveCampaign();
  const referenceType = inferReferenceType(caption, media);
  let drive = null;
  try {
    const downloaded = await downloadTelegramFileBuffer(media.fileId);
    if (downloaded?.buffer) {
      const filename = `telegram_ref_${Date.now()}_${downloaded.filename || media.fileName || 'image.jpg'}`.replace(/[^a-zA-Z0-9_.-]+/g, '_');
      drive = await uploadBufferToDrive({ buffer: downloaded.buffer, filename, mimeType: downloaded.mimeType });
    }
  } catch (err) { runLogger?.warn?.({ err: err.message }, 'Failed to upload Telegram reference to Drive'); }

  const saved = await saveReferenceAsset({ source:'Telegram', telegram_chat_id:message.chat?.id, telegram_message_id:message.message_id, telegram_file_id:media.fileId, drive_link:drive?.webViewLink || fileUrl, reference_type:referenceType, related_player:inferPlayer(caption), related_event_id:active?.event_id || '', status:'Needs Classification', notes: caption || media.fileName || media.type });
  await saveTelegramMessageLink({ telegram_chat_id:message.chat?.id, telegram_message_id:message.message_id, direction:'inbound', related_type:'reference_asset', related_id:saved.reference_id, context:caption, status:'Saved' });
  return { reference:saved, textRu: formatReply({ saved, referenceType, active, drive }), parseMode:'HTML', replyMarkup: mediaIntakeKeyboard(saved.reference_id) };
}
function formatReply({ saved, referenceType, active, drive }) { return `📎 <b>Медиа принято</b>\n\n<b>Файл:</b> <code>${saved.reference_id}</code>\n<b>Предположение:</b> <code>${referenceType}</code>${active?.event_id ? `\n<b>Привязал к кампании:</b> ${active.player1} vs ${active.player2}` : ''}${drive?.webViewLink ? `\n<b>Drive:</b> <a href="${drive.webViewLink}">открыть файл</a>` : ''}\n\nВыбери точную роль кнопкой. После загрузки всех референсов можно нажать “Сгенерировать постер” или написать обычным текстом: <i>сгенерируй главный постер</i>.`; }
function inferReferenceType(text = '', media = {}) { const t=String(`${text} ${media.fileName||''}`).toLowerCase(); if(/логотип|logo|ptf|brand/.test(t)) return 'Brand Reference'; if(/стил|style|референс|reference|пример|постер|poster/.test(t)) return 'Style Reference'; if(/игрок|player|портрет|avatar|аватар|фото/.test(t)) return 'Player Reference'; if(/peak|venue|матч|event|событ|турнир|локац/.test(t)) return 'Event Reference'; return 'Unsorted Telegram Media'; }
function inferPlayer(text = '') { const m=String(text).match(/(?:player|игрок|для)[:\s]+([A-Za-zА-Яа-яЁё]+(?:\s+[A-Za-zА-Яа-яЁё]+)?)/i); return m ? m[1] : ''; }
