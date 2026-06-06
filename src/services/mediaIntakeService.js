import path from 'path';
import { extractMediaFromMessage, getTelegramFile, telegramFileDownloadUrl, downloadTelegramFileBuffer } from './telegramService.js';
import { saveReferenceAsset, saveTelegramMessageLink, getActiveCampaign } from './sheetsStorage.js';
import { uploadBufferToDrive } from './googleDriveService.js';
import { mediaIntakeKeyboard } from './telegramKeyboardService.js';
import { escapeHtml } from '../utils/html.js';

export async function handleTelegramMediaMessage({ message, runLogger }) {
  const media = extractMediaFromMessage(message);
  if (!media) return null;

  let file = null;
  try {
    file = await getTelegramFile(media.fileId);
  } catch (err) {
    runLogger?.warn?.({ err: err.message }, 'Failed to get Telegram file metadata');
  }

  const originalFilename = getOriginalFilename({ media, file });
  const displayLabel = buildDisplayLabel({ originalFilename, media, message });
  const fileUrl = file?.file_path ? telegramFileDownloadUrl(file.file_path) : '';
  const caption = media.caption || '';
  const active = await getActiveCampaign();
  const referenceType = inferReferenceType(caption, media, originalFilename);

  let drive = null;
  try {
    const downloaded = await downloadTelegramFileBuffer(media.fileId);
    if (downloaded?.buffer) {
      const filename = `telegram_ref_${Date.now()}_${downloaded.filename || originalFilename || 'image.jpg'}`.replace(/[^a-zA-Z0-9_.-]+/g, '_');
      drive = await uploadBufferToDrive({ buffer: downloaded.buffer, filename, mimeType: downloaded.mimeType });
    }
  } catch (err) {
    runLogger?.warn?.({ err: err.message }, 'Failed to upload Telegram reference to Drive');
  }

  const notesPayload = {
    caption,
    original_filename: originalFilename,
    display_label: displayLabel,
    telegram_media_type: media.type || '',
    mime_hint: media.mimeType || '',
    file_path: file?.file_path || '',
    role_hint: referenceType,
    ux_note: 'Use original_filename/display_label for human-readable bulk reference selection.'
  };

  const saved = await saveReferenceAsset({
    source: 'Telegram',
    telegram_chat_id: message.chat?.id,
    telegram_message_id: message.message_id,
    telegram_file_id: media.fileId,
    drive_link: drive?.webViewLink || fileUrl,
    reference_type: referenceType,
    related_player: inferPlayer(caption),
    related_event_id: active?.event_id || '',
    status: 'Needs Classification',
    notes: JSON.stringify(notesPayload)
  });

  await saveTelegramMessageLink({
    telegram_chat_id: message.chat?.id,
    telegram_message_id: message.message_id,
    direction: 'inbound',
    related_type: 'reference_asset',
    related_id: saved.reference_id,
    context: `${displayLabel} ${caption}`.trim(),
    status: 'Saved'
  });

  return {
    reference: saved,
    textRu: formatReply({ saved, referenceType, active, drive, originalFilename, displayLabel, caption }),
    parseMode: 'HTML',
    replyMarkup: mediaIntakeKeyboard(saved.reference_id)
  };
}

function getOriginalFilename({ media = {}, file = {} }) {
  const direct = media.fileName || media.file_name || '';
  if (direct) return direct;
  const fp = file?.file_path || '';
  if (fp) return path.basename(fp);
  return '';
}

function buildDisplayLabel({ originalFilename = '', media = {}, message = {} }) {
  if (originalFilename) return originalFilename;
  const type = media.type || 'media';
  const msgId = message.message_id || 'unknown';
  return `${type}_${msgId}`;
}

function formatReply({ saved, referenceType, active, drive, originalFilename, displayLabel, caption }) {
  return `📎 <b>Медиа принято</b>

<b>Файл:</b> ${escapeHtml(displayLabel || originalFilename || saved.reference_id)}
<b>Internal ID:</b> <code>${escapeHtml(saved.reference_id)}</code>
<b>Предположение:</b> <code>${escapeHtml(referenceType)}</code>${active?.event_id ? `
<b>Привязал к кампании:</b> ${escapeHtml(active.player1 || '')} vs ${escapeHtml(active.player2 || '')}` : ''}${drive?.webViewLink ? `
<b>Drive:</b> <a href="${escapeHtml(drive.webViewLink)}">открыть файл</a>` : ''}${caption ? `
<b>Caption:</b> ${escapeHtml(caption)}` : ''}

<b>Выбери точную роль:</b>
• 👤 Игрок — фото/identity игрока
• 🪪 Player card — скрин карточки с сайта
• 🎨 Стиль/композиция — только стиль, людей с рефа не использовать
• 🏷 PTF logo exact — точный логотип, не перерисовывать
• 🏷 Venue/sponsor logo — логотип локации/партнёра

После загрузки всех референсов можно нажать “Сгенерировать постер” или написать: <i>сгенерируй главный постер</i>.`;
}

function inferReferenceType(text = '', media = {}, filename = '') {
  const t = String(`${text} ${media.fileName || ''} ${filename || ''}`).toLowerCase();
  if (/player\s*card|карточк|profile\s*card/.test(t)) return 'Player Card';
  if (/ptf|phuket tennis family|brand logo|логотип.*ptf|ptf.*logo/.test(t)) return 'Brand Logo Exact';
  if (/the peak|peak|venue logo|sponsor logo|логотип.*(пик|peak|локац|партн)/.test(t)) return 'Venue / Sponsor Logo Exact';
  if (/логотип|logo|brand/.test(t)) return 'Logo Reference — Needs Exact Role';
  if (/стил|style|референс|reference|пример|постер|poster/.test(t)) return 'Style Reference';
  if (/игрок|player|портрет|avatar|аватар|фото|headshot/.test(t)) return 'Player Reference';
  if (/venue|матч|event|событ|турнир|локац/.test(t)) return 'Event Reference';
  return 'Unsorted Telegram Media';
}

function inferPlayer(text = '') {
  const m = String(text).match(/(?:player|игрок|для)[:\s]+([A-Za-zА-Яа-яЁё]+(?:\s+[A-Za-zА-Яа-яЁё]+)?)/i);
  return m ? m[1] : '';
}
