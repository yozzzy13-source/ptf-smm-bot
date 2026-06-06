import { config } from '../config.js';
import { generateTodayPackSummary } from '../agents/todayPackAgent.js';
import { ensureSheetHeaders } from './googleSheetsService.js';
import { HEADERS } from '../schemas/sheetSchema.js';
import { getRecentEvents, getPublicationSchedule, syncSourceRegistryDefaults, seedStrategicDefaults, cleanupTestCampaigns, getActiveCampaign, getCurrentFocus, getActiveCampaigns, getLastVisualJob, getRecentReferenceAssets, getReferenceAssetsReview, updateReferenceAssetType } from './sheetsStorage.js';
import { bootstrapMediaOs } from './mediaOsBootstrapService.js';
import { scanMediaOs } from './mediaScannerService.js';
import { escapeHtml } from '../utils/html.js';

function normalizeCommand(text = '') {
  const t = String(text || '').trim();
  const first = t.split(/\s+/)[0].toLowerCase();
  if (['команды', 'список', 'список_команд', 'что умеешь', 'что ты умеешь'].includes(t.toLowerCase())) return '/commands';
  return first;
}

export async function handleAdminCommand({ text, runLogger }) {
  const command = normalizeCommand(text);
  if (!command.startsWith('/')) return null;

  if (['/generate_visual', '/poster'].includes(command)) {
    return null;
  }

  if (['/start', '/help', '/commands', '/menu'].includes(command)) {
    return { type: 'command', parseMode: 'HTML', textRu: commandsList() };
  }

  if (['/ping', '/status', '/health'].includes(command)) {
    return { type: 'command', parseMode: 'HTML', textRu: statusReply() };
  }

  if (command === '/models') {
    return { type: 'command', parseMode: 'HTML', textRu: modelsReply() };
  }

  if (command === '/today') {
    const pack = await generateTodayPackSummary();
    return { type: 'command', parseMode: 'HTML', textRu: todayReply(pack) };
  }

  if (command === '/upcoming') {
    const events = await getRecentEvents(10);
    return { type: 'command', parseMode: 'HTML', textRu: upcomingReply(events) };
  }

  if (command === '/schedule') {
    const rows = await getPublicationSchedule(20);
    return { type: 'command', parseMode: 'HTML', textRu: scheduleReply(rows) };
  }

  if (command === '/setup') {
    await ensureSheetHeaders(HEADERS);
    await syncSourceRegistryDefaults();
    if (config.seedStrategicDefaults) await seedStrategicDefaults();
    return { type: 'command', parseMode: 'HTML', textRu: '✅ <b>Setup выполнен</b>\n\nПроверил/создал структуру Google Sheets, source registry и strategic defaults.' };
  }

  if (command === '/active_campaign') {
    const active = await getActiveCampaign();
    return { type: 'command', parseMode: 'HTML', textRu: activeCampaignReply(active) };
  }

  if (command === '/cleanup_tests') {
    const result = await cleanupTestCampaigns();
    return { type: 'command', parseMode: 'HTML', textRu: cleanupReply(result) };
  }

  if (['/campaign_state','/current_focus'].includes(command)) {
    const active = await getActiveCampaign();
    const focus = await getCurrentFocus();
    const refs = await getRecentReferenceAssets(12);
    const lastVisual = active?.event_id ? await getLastVisualJob(active.event_id) : null;
    return { type:'command', parseMode:'HTML', textRu: campaignStateReply({ active, focus, refs, lastVisual }) };
  }

  if (command === '/campaigns') {
    const campaigns = await getActiveCampaigns(12);
    return { type:'command', parseMode:'HTML', textRu: campaignsReply(campaigns) };
  }

  if (['/refs','/references'].includes(command)) {
    const active = await getActiveCampaign();
    const refs = await getReferenceAssetsReview({ eventId: active?.event_id || '', limit: 30, includeSkipped: false });
    return { type:'command', parseMode:'HTML', textRu: refsReply({ refs, active, includeSkipped: false }) };
  }

  if (['/refs_all','/references_all'].includes(command)) {
    const active = await getActiveCampaign();
    const refs = await getReferenceAssetsReview({ eventId: active?.event_id || '', limit: 40, includeSkipped: true });
    return { type:'command', parseMode:'HTML', textRu: refsReply({ refs, active, includeSkipped: true }) };
  }

  if (command === '/skip_ref') {
    const refId = String(text || '').trim().split(/\s+/)[1] || '';
    if (!refId) return { type:'command', parseMode:'HTML', textRu:'⚠️ <b>Не указан REF ID</b>\n\nПример: <code>/skip_ref REF-1234567</code>' };
    const ok = await updateReferenceAssetType(refId, 'Do Not Use', 'Skipped by /skip_ref command');
    return { type:'command', parseMode:'HTML', textRu: ok ? `🗑 <b>Референс отключён</b>\n\n<code>${escapeHtml(refId)}</code> больше не должен попадать в генерацию.` : `⚠️ <b>REF не найден</b>\n\nПроверь ID: <code>${escapeHtml(refId)}</code>` };
  }

  if (command === '/role_ref') {
    const parts = String(text || '').trim().split(/\s+/);
    const refId = parts[1] || '';
    const role = normalizeRefRole(parts.slice(2).join(' '));
    if (!refId || !role) return { type:'command', parseMode:'HTML', textRu:'⚠️ <b>Нужен REF ID и роль</b>\n\nПример:\n<code>/role_ref REF-1234567 player</code>\n\nРоли: <code>player</code>, <code>style</code>, <code>ptflogo</code>, <code>venuelogo</code>, <code>playercard</code>, <code>event</code>, <code>skip</code>' };
    const ok = await updateReferenceAssetType(refId, role, `Role changed by /role_ref command to ${role}`);
    return { type:'command', parseMode:'HTML', textRu: ok ? `✅ <b>Роль обновлена</b>\n\n<code>${escapeHtml(refId)}</code> → <code>${escapeHtml(role)}</code>` : `⚠️ <b>REF не найден</b>\n\nПроверь ID: <code>${escapeHtml(refId)}</code>` };
  }


  if (command === '/bootstrap_media_os') {
    const result = await bootstrapMediaOs();
    return { type:'command', parseMode:'HTML', textRu: bootstrapMediaOsReply(result) };
  }

  if (command === '/scan_media_os') {
    const result = await scanMediaOs();
    return { type:'command', parseMode:'HTML', textRu: scanMediaOsReply(result) };
  }

  if (['/clear_history', '/reset_context'].includes(command)) {
    return { type: 'command', parseMode: 'HTML', textRu: resetContextReply() };
  }

  if (command === '/restart') {
    if (!config.enableTelegramRestartCommand) {
      return { type: 'command', parseMode: 'HTML', textRu: '⚠️ <b>Restart отключён</b>\n\nКоманда есть, но для безопасности выключена. Чтобы включить: <code>ENABLE_TELEGRAM_RESTART_COMMAND=true</code> в Railway Variables, затем redeploy.' };
    }
    return { type: 'command', parseMode: 'HTML', restart: true, textRu: '♻️ <b>Перезапускаю бота</b>\n\nRailway должен автоматически поднять процесс заново через несколько секунд.' };
  }

  if (['/image_on', '/image_off'].includes(command)) {
    return { type: 'command', parseMode: 'HTML', textRu: imageToggleReply(command) };
  }

  return { type: 'command', parseMode: 'HTML', textRu: `❓ <b>Неизвестная команда</b>\n\nНапиши <code>/commands</code>, чтобы увидеть список доступных команд.` };
}

function commandsList() {
  return `🧭 <b>PTF Media Bot — команды</b>\n\n<b>Основное</b>\n<code>/commands</code> — показать все команды\n<code>/status</code> — состояние бота и ключевых режимов\n<code>/models</code> — какие модели прописаны в Railway\n<code>/today</code> — сегодняшний контент-пак\n<code>/upcoming</code> — последние/ближайшие события из таблицы\n<code>/schedule</code> — последние элементы Publication Schedule
<code>/active_campaign</code> — текущая активная кампания
<code>/campaign_state</code> — фокус, референсы, визуалы и следующий шаг
<code>/campaigns</code> — список активных кампаний\n<code>/refs</code> — понятный список активных референсов текущей кампании\n<code>/refs_all</code> — все последние референсы, включая отключённые\n<code>/skip_ref REF-ID</code> — отключить неправильный референс\n<code>/role_ref REF-ID role</code> — поменять роль референса\n<code>/bootstrap_media_os</code> — создать/проверить структуру Google Drive Media OS\n<code>/scan_media_os</code> — просканировать Media OS и записать новые файлы в Assets Library\n\n<b>Обслуживание</b>\n<code>/setup</code> — заново проверить/создать вкладки Google Sheets\n<code>/clear_history</code> — сбросить разговорный контекст чата\n<code>/reset_context</code> — то же самое\n<code>/restart</code> — перезапустить процесс бота, если включено в env\n\n<b>Картинки</b>\n<code>/image_on</code> — подсказка, как включить генерацию изображений\n<code>/image_off</code> — подсказка, как выключить генерацию изображений
<code>/generate_visual</code> — visual-only генерация: не трогает кампанию и schedule\n\n<b>Кнопки в сообщениях</b>\n✅ Утвердить — фиксирует план/драфт/визуал\n✏️ Править — бот ждёт твою правку текстом\n✅ Опубликовал — отмечает задачу как опубликованную\n⏳ Ещё нет — оставляет в follow-up\n⏰ Позже — переносит/откладывает статус\n🚫 Пропустить — снимает напоминание\n\n<b>Как работать без команд</b>\nМожно писать обычным текстом:\n<pre>Через 2 дня матч Chris vs Robin. Подготовь SMM-сопровождение, прогрев, визуалы и задачи для меня.</pre>`;
}

function statusReply() {
  return `✅ <b>PTF Media Bot online</b>\n\n<b>Среда</b>\nNode env: <code>${escapeHtml(config.nodeEnv)}</code>\nTimezone: <code>${escapeHtml(config.timezone)}</code>\n\n<b>Google Sheets</b>\nAUTO_SETUP_SHEETS: <code>${String(config.autoSetupSheets)}</code>\nSEED_STRATEGIC_DEFAULTS: <code>${String(config.seedStrategicDefaults)}</code>\n\n<b>Images</b>\nENABLE_IMAGE_GENERATION: <code>${String(config.enableImageGeneration)}</code>\nSEND_GENERATED_IMAGES_TO_TELEGRAM: <code>${String(config.sendGeneratedImagesToTelegram)}</code>\nMAX_IMAGES_PER_REQUEST: <code>${String(config.maxImagesPerRequest)}</code>\n\n<b>Follow-up</b>\nENABLE_FOLLOWUP_SCHEDULER: <code>${String(config.enableFollowupScheduler)}</code>\nFOLLOWUP_TELEGRAM_CHAT_ID: <code>${escapeHtml(config.followupTelegramChatId || '')}</code>\nFOLLOWUP_INTERVAL_MINUTES: <code>${String(config.followupIntervalMinutes)}</code>\nMAX_REMINDER_REPEATS: <code>${String(config.maxReminderRepeats)}</code>\n\n<b>Restart command</b>\nENABLE_TELEGRAM_RESTART_COMMAND: <code>${String(config.enableTelegramRestartCommand)}</code>`;
}

function modelsReply() {
  return `🧠 <b>Models config</b>\n\nRouter: <code>${escapeHtml(config.openaiRouterModel)}</code>\nStrategic: <code>${escapeHtml(config.openaiStrategicModel)}</code>\nCreative: <code>${escapeHtml(config.openaiCreativeModel)}</code>\nAnalyst: <code>${escapeHtml(config.openaiAnalystModel)}</code>\nFast: <code>${escapeHtml(config.openaiFastModel)}</code>\nStructure: <code>${escapeHtml(config.openaiStructureModel)}</code>\nImage: <code>${escapeHtml(config.openaiImageModel)}</code>\nImage size: <code>${escapeHtml(config.openaiImageSize)}</code>\nImage quality: <code>${escapeHtml(config.openaiImageQuality)}</code>\nImage format: <code>${escapeHtml(config.openaiImageFormat)}</code>`;
}

function todayReply(pack) {
  const ready = (pack.ready || []).slice(0, 8).map((r, i) => `${i + 1}. ${escapeHtml(r[3] || '')} / ${escapeHtml(r[4] || '')} — ${escapeHtml(r[6] || '')}`).join('\n') || 'Нет ready-задач.';
  const planned = (pack.planned || []).slice(0, 8).map((r, i) => `${i + 1}. ${escapeHtml(r[3] || '')} / ${escapeHtml(r[4] || '')} — ${escapeHtml(r[6] || '')}`).join('\n') || 'Нет planned-задач.';
  return `📌 <b>Today’s Content Pack</b>\n\n<b>Ready</b>\n${ready}\n\n<b>Planned</b>\n${planned}`;
}

function upcomingReply(events = []) {
  const lines = events.slice(-10).map((e, i) => `${i + 1}. ${escapeHtml(e.date || '')} ${escapeHtml(e.time || '')} — ${escapeHtml(e.player1 || '')} vs ${escapeHtml(e.player2 || '')} · ${escapeHtml(e.division || '')} · ${escapeHtml(e.venue || '')}`).join('\n') || 'События не найдены.';
  return `🎾 <b>Последние события</b>\n\n${lines}`;
}

function scheduleReply(rows = []) {
  const lines = rows.slice(-12).map((r, i) => `${i + 1}. ${escapeHtml(r.date || '')} ${escapeHtml(r.time || '')} — ${escapeHtml(r.channel || '')} / ${escapeHtml(r.format || '')}: ${escapeHtml(r.title || '')}`).join('\n') || 'План публикаций пуст.';
  return `📅 <b>Publication Schedule</b>\n\n${lines}`;
}


function activeCampaignReply(active) {
  if (!active) return '⚠️ <b>Активная кампания не найдена</b>\n\nСоздай новую кампанию или проверь вкладку <code>02_Events Matches</code>.';
  return `🎾 <b>Активная кампания</b>\n\n<b>Матч:</b> ${escapeHtml(active.player1 || '')} vs ${escapeHtml(active.player2 || '')}\n<b>Дата:</b> ${escapeHtml(formatShortDate(active.date, active.time))}\n<b>Место:</b> ${escapeHtml(active.venue || '')}\n<b>Дивизион:</b> ${escapeHtml(active.division || '')}\n<b>Статус:</b> ${escapeHtml(active.status || '')}\n<b>Event ID:</b> <code>${escapeHtml(active.event_id || '')}</code>`;
}

function cleanupReply(result) {
  if (!result?.ok) return `⚠️ <b>Cleanup не выполнен</b>\n\n${escapeHtml(result?.message || 'Неизвестная ошибка')}`;
  const active = result.active || {};
  return `🧹 <b>Тестовые кампании заархивированы</b>\n\nОставил активной:\n<b>${escapeHtml(active.player1 || '')} vs ${escapeHtml(active.player2 || '')}</b>\n${escapeHtml(formatShortDate(active.date, active.time))} · ${escapeHtml(active.venue || '')}\n\nОбновлено строк: <b>${String(result.changed || 0)}</b>\n\nТеперь бот должен ориентироваться на эту кампанию, когда ты пишешь “текущая кампания” или “по этому матчу”.`;
}

function formatShortDate(date = '', time = '') {
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const m = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = String(time || '').match(/(\d{1,2}:\d{2})/)?.[1] || '';
  if (!m) return [date, tm].filter(Boolean).join(' · ');
  return `${Number(m[3])} ${months[Number(m[2]) - 1]}${tm ? ` · ${tm}` : ''}`;
}


function bootstrapMediaOsReply(result) {
  if (!result?.ok) return `⚠️ <b>Media OS не создана</b>

${escapeHtml(result?.message || 'Неизвестная ошибка')}

Проверь env <code>PTF_MEDIA_OS_ROOT_FOLDER_ID</code>.`;
  return `✅ <b>Media OS создана / проверена</b>

<b>Создано новых папок:</b> ${String(result.created || 0)}
<b>Записей в folder map:</b> ${String(result.mapped || 0)}
<b>Root folder ID:</b> <code>${escapeHtml(result.rootFolderId || '')}</code>
<b>README:</b> ${result.readmeLink ? `<a href="${escapeHtml(result.readmeLink)}">открыть</a>` : 'создан'}

<b>Важно</b>
Видео конкретного матча кладём в папку кампании, а не дублируем по папкам игроков. Бот связывает один файл с событием и участниками через таблицы.`;
}

function scanMediaOsReply(result) {
  if (!result?.ok) return `⚠️ <b>Media scan не выполнен</b>

${escapeHtml(result?.message || 'Неизвестная ошибка')}`;
  return `🔎 <b>Media OS scan выполнен</b>

<b>Папок проверено:</b> ${String(result.scannedFolders || 0)}
<b>Новых файлов найдено:</b> ${String(result.newFiles || 0)}
<b>Assets создано:</b> ${String(result.assetsCreated || 0)}

Новые файлы записаны в <code>54_Media Scan Log</code> и <code>04_Assets Library</code>.`;
}


function normalizeRefRole(raw = '') {
  const t = String(raw || '').toLowerCase().trim();
  if (!t) return '';
  if (['player','игрок','playerref'].includes(t)) return 'Player Reference';
  if (['style','стиль','composition','poster'].includes(t)) return 'Style Reference';
  if (['ptflogo','ptf','brand','brandlogo','logo_ptf'].includes(t)) return 'Brand Logo Exact';
  if (['venuelogo','venue','sponsor','partner','локация','партнер','партнёр'].includes(t)) return 'Venue / Sponsor Logo Exact';
  if (['playercard','card','карточка'].includes(t)) return 'Player Card';
  if (['event','eventref','location'].includes(t)) return 'Event Reference';
  if (['skip','remove','delete','trash','неиспользовать'].includes(t)) return 'Do Not Use';
  return '';
}

function refsReply({ refs = [], active = null, includeSkipped = false }) {
  const title = includeSkipped ? 'Все последние референсы' : 'Активные референсы';
  const campaign = active ? `${active.player1 || ''} vs ${active.player2 || ''}` : 'кампания не выбрана';
  if (!refs.length) return `📎 <b>${title}</b>\n\n<b>Кампания:</b> ${escapeHtml(campaign)}\n\nРеференсы не найдены.`;

  const lines = refs.slice(0, 30).map((r, i) => {
    const label = escapeHtml(r.display_label || r.original_filename || r.caption || r.reference_id || '');
    const type = escapeHtml(r.reference_type || '');
    const player = r.related_player ? ` · ${escapeHtml(r.related_player)}` : '';
    const status = escapeHtml(r.status || '');
    const link = r.drive_link ? ` · <a href="${escapeHtml(r.drive_link)}">open</a>` : '';
    return `${i + 1}. <code>${escapeHtml(r.reference_id)}</code>\n   <b>${type}</b>${player} · ${status}${link}\n   ${label}`;
  }).join('\n\n');

  return `📎 <b>${title}</b>\n\n<b>Кампания:</b> ${escapeHtml(campaign)}\n\n${lines}\n\n<b>Как чистить</b>\n• Отключить плохой реф: <code>/skip_ref REF-XXXX</code>\n• Поменять роль: <code>/role_ref REF-XXXX player</code>\n• Роли: <code>player</code>, <code>style</code>, <code>ptflogo</code>, <code>venuelogo</code>, <code>playercard</code>, <code>event</code>`;
}


function resetContextReply() {
  return `🧹 <b>Контекст чата сброшен</b>\n\nСейчас бот не хранит длинную историю Telegram-диалога как отдельную память. Основная память проекта живёт в Google Sheets: Project Context, Brand Rules, Bot Memory, Published Archive и Schedule.\n\nЭта команда нужна как безопасный service-reset: после неё просто формулируй новую задачу с нуля.`;
}

function imageToggleReply(command) {
  if (command === '/image_on') {
    return `🖼 <b>Как включить генерацию изображений</b>\n\nВ Railway Variables поставь:\n<code>ENABLE_IMAGE_GENERATION=true</code>\n<code>SEND_GENERATED_IMAGES_TO_TELEGRAM=true</code>\n\nПотом сделай Redeploy.`;
  }
  return `🖼 <b>Как выключить генерацию изображений</b>\n\nВ Railway Variables поставь:\n<code>ENABLE_IMAGE_GENERATION=false</code>\n\nПотом сделай Redeploy. Бот продолжит создавать visual prompts без генерации картинок.`;
}


function campaignStateReply({ active, focus, refs, lastVisual }) {
  if (!active) return '⚠️ <b>Кампания не найдена</b>';
  const refSummary = `${refs.length} последних референсов`;
  const visual = lastVisual ? `${lastVisual.visual_job_id} · ${lastVisual.status} · вариантов: ${lastVisual.generated_count || lastVisual.requested_variants || 0}` : 'ещё не генерировали';
  return `🧭 <b>Campaign State</b>

<b>Фокус:</b> ${escapeHtml(active.player1 || '')} vs ${escapeHtml(active.player2 || '')}
<b>Дата:</b> ${escapeHtml(formatShortDate(active.date, active.time))}
<b>Статус:</b> ${escapeHtml(active.status || '')}
<b>Event ID:</b> <code>${escapeHtml(active.event_id || '')}</code>

<b>Референсы:</b> ${escapeHtml(refSummary)}
<b>Последний visual job:</b> ${escapeHtml(visual)}

<b>Следующий лучший шаг</b>
Если референсы уже загружены: напиши <code>сгенерируй главный постер</code>. Я не буду пересоздавать кампанию и schedule.`;
}

function campaignsReply(campaigns = []) {
  const lines = campaigns.map((c,i)=>`${i+1}. <b>${escapeHtml(c.player1 || '')} vs ${escapeHtml(c.player2 || '')}</b> · ${escapeHtml(formatShortDate(c.date, c.time))} · ${escapeHtml(c.division || '')} · <code>${escapeHtml(c.event_id || '')}</code>`).join('\n') || 'Активные кампании не найдены.';
  return `🎾 <b>Активные кампании</b>

${lines}

Если запрос неоднозначный, бот должен уточнить, к какой кампании относится действие.`;
}
