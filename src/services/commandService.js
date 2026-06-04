import { config } from '../config.js';
import { generateTodayPackSummary } from '../agents/todayPackAgent.js';
import { ensureSheetHeaders } from './googleSheetsService.js';
import { HEADERS } from '../schemas/sheetSchema.js';
import { getRecentEvents, getPublicationSchedule, syncSourceRegistryDefaults, seedStrategicDefaults, cleanupTestCampaigns, getActiveCampaign } from './sheetsStorage.js';
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
  return `🧭 <b>PTF Media Bot — команды</b>\n\n<b>Основное</b>\n<code>/commands</code> — показать все команды\n<code>/status</code> — состояние бота и ключевых режимов\n<code>/models</code> — какие модели прописаны в Railway\n<code>/today</code> — сегодняшний контент-пак\n<code>/upcoming</code> — последние/ближайшие события из таблицы\n<code>/schedule</code> — последние элементы Publication Schedule\n\n<b>Обслуживание</b>\n<code>/setup</code> — заново проверить/создать вкладки Google Sheets\n<code>/clear_history</code> — сбросить разговорный контекст чата\n<code>/reset_context</code> — то же самое\n<code>/restart</code> — перезапустить процесс бота, если включено в env\n\n<b>Картинки</b>\n<code>/image_on</code> — подсказка, как включить генерацию изображений\n<code>/image_off</code> — подсказка, как выключить генерацию изображений\n\n<b>Кнопки в сообщениях</b>\n✅ Утвердить — фиксирует план/драфт/визуал\n✏️ Править — бот ждёт твою правку текстом\n✅ Опубликовал — отмечает задачу как опубликованную\n⏳ Ещё нет — оставляет в follow-up\n⏰ Позже — переносит/откладывает статус\n🚫 Пропустить — снимает напоминание\n\n<b>Как работать без команд</b>\nМожно писать обычным текстом:\n<pre>Через 2 дня матч Chris vs Robin. Подготовь SMM-сопровождение, прогрев, визуалы и задачи для меня.</pre>`;
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

function resetContextReply() {
  return `🧹 <b>Контекст чата сброшен</b>\n\nСейчас бот не хранит длинную историю Telegram-диалога как отдельную память. Основная память проекта живёт в Google Sheets: Project Context, Brand Rules, Bot Memory, Published Archive и Schedule.\n\nЭта команда нужна как безопасный service-reset: после неё просто формулируй новую задачу с нуля.`;
}

function imageToggleReply(command) {
  if (command === '/image_on') {
    return `🖼 <b>Как включить генерацию изображений</b>\n\nВ Railway Variables поставь:\n<code>ENABLE_IMAGE_GENERATION=true</code>\n<code>SEND_GENERATED_IMAGES_TO_TELEGRAM=true</code>\n\nПотом сделай Redeploy.`;
  }
  return `🖼 <b>Как выключить генерацию изображений</b>\n\nВ Railway Variables поставь:\n<code>ENABLE_IMAGE_GENERATION=false</code>\n\nПотом сделай Redeploy. Бот продолжит создавать visual prompts без генерации картинок.`;
}
