import { routeUserMessage } from '../router/aiCommandRouter.js';
import { planEventCampaign } from '../agents/contentPlannerAgent.js';
import { generateDrafts } from '../agents/captionAgent.js';
import { processFeedback } from '../agents/feedbackAgent.js';
import { generateTodayPackSummary } from '../agents/todayPackAgent.js';
import { analyzeStorylineFromText } from '../agents/storylineAgent.js';
import { buildVisualPack } from '../agents/visualProductionAgent.js';
import { suggestMediaForEvent } from '../agents/mediaSuggestionAgent.js';
import { createEvent, createContentTasks, getFeedbackRules, getRecentContentTasks, getRecentEvents, saveSystemLog, saveVisualPrompts, savePublicationSchedule, saveMediaSuggestions } from './sheetsStorage.js';
import { shortId } from '../utils/idUtils.js';
import { classifyServiceMessage, serviceReply } from '../knowledge/serviceReplies.js';
import { getMatchLogSummary } from './matchLogService.js';
import { escapeHtml, shortText } from '../utils/html.js';

export async function processUserText({ text, messageMeta, runLogger }) {
  const runId = messageMeta.runId || shortId('RUN');
  const serviceKind = classifyServiceMessage(text);
  if (serviceKind) return { type:'service_reply', textRu: serviceReply(serviceKind), parseMode:'HTML' };
  await saveSystemLog({ run_id: runId, level:'INFO', agent:'Orchestrator', action:'start', status:'Started', input_summary:text.slice(0,200) });
  const recentEvents = await getRecentEvents(5);
  const { route } = await routeUserMessage({ text, runLogger, conversationContext:{ recentEvents } });
  await saveSystemLog({ run_id:runId, level:'INFO', agent:'AI Command Router', action:'route', status:route.intent, input_summary:text.slice(0,200), output_summary:route.summary_ru, raw_json:route });
  if (route.intent === 'service_help') return { type:'service_reply', textRu:serviceReply('help'), parseMode:'HTML' };
  if (route.intent === 'ask_clarification' || route.confidence < 0.55) return { type:'clarification', textRu:`❓ <b>Нужно уточнение</b>\n\n${escapeHtml(route.clarification_question_ru || 'Уточни, пожалуйста, что нужно сделать?')}`, parseMode:'HTML' };
  if (route.intent === 'save_feedback_rule') { const { feedback, saved } = await processFeedback({ text, runLogger }); return { type:'feedback', textRu:`✅ <b>Принял правку</b>\n\n${escapeHtml(feedback.response_ru || (saved ? 'Запомнил правило.' : 'Принял правку.'))}`, parseMode:'HTML' }; }
  if (route.intent === 'generate_today_pack') { const pack=await generateTodayPackSummary(); return { type:'today_pack', textRu:formatTodayPack(pack), parseMode:'HTML' }; }
  if (route.intent === 'analyze_storylines') { const matchLogSummary=await getMatchLogSummary(40); const storyline=await analyzeStorylineFromText({ text, matchLogSummary }); return { type:'storyline', textRu:formatStorylineReply(storyline), parseMode:'HTML' }; }
  if (route.intent === 'create_event_campaign' || route.intent === 'create_visual_pack') {
    const recentContent=await getRecentContentTasks(50);
    const { plan }=await planEventCampaign({ route, recentContent, runLogger });
    const createdEvent=await createEvent(plan.event, { telegramSource:messageMeta.telegramSource, createdFrom:'Telegram AI Router' });
    const createdTasks=await createContentTasks(plan.content_tasks, createdEvent);
    const savedSchedule=await savePublicationSchedule(plan.publication_schedule || [], createdEvent.event_id, createdTasks);
    const feedbackRules=await getFeedbackRules(80);
    const { drafts }=await generateDrafts({ event:createdEvent, tasks:createdTasks, feedbackRules, runLogger });
    const { visualPack }=await buildVisualPack({ route, event:createdEvent, tasks:createdTasks, drafts, runLogger });
    const savedVisuals=await saveVisualPrompts(visualPack.assets, createdEvent.event_id);
    const savedMedia=await saveMediaSuggestions(await suggestMediaForEvent({ event:createdEvent }), createdEvent.event_id);
    await saveSystemLog({ run_id:runId, level:'INFO', agent:'Content Planner Agent', action:'create_event_campaign', status:'Created', output_summary:`${createdTasks.length} tasks / ${savedSchedule.length} schedule / ${savedVisuals.length} visuals / ${savedMedia.length} media`, raw_json:{plan,createdEvent,createdTasks,drafts,visualPack,savedMedia} });
    return { type:'event_campaign', textRu:formatEventCampaignReply({ createdEvent, createdTasks, drafts, plan, savedVisuals, savedSchedule, savedMedia }), parseMode:'HTML' };
  }
  return { type:'unknown', textRu:'Я понял сообщение, но пока не уверен, какой сценарий запустить. Переформулируй как задачу для SMM?' };
}

function formatEventCampaignReply({ createdEvent, createdTasks, drafts, plan, savedVisuals, savedSchedule, savedMedia }) {
  const eventLine = `${createdEvent.player1 || 'Player 1'} vs ${createdEvent.player2 || 'Player 2'} · ${createdEvent.division || 'Division'} · ${createdEvent.date || 'date TBC'} ${createdEvent.time || ''} · ${createdEvent.venue || 'venue TBC'}`;
  const scheduleText=(savedSchedule||[]).slice(0,6).map(s=>`• ${escapeHtml(s.date)} ${escapeHtml(s.time)} — ${escapeHtml(s.channel)} / ${escapeHtml(s.format)}: ${escapeHtml(s.title)}`).join('\n') || '• План публикаций создан в таблице.';
  const tasksText=createdTasks.slice(0,6).map(t=>`• ${escapeHtml(t.channel)} / ${escapeHtml(t.format)} — ${escapeHtml(t.title)} (${escapeHtml(t.status)})`).join('\n');
  const visualText=(savedVisuals||[]).slice(0,6).map(v=>`• ${escapeHtml(v.asset_type)} — ${escapeHtml(v.size || v.channel)} (${escapeHtml(v.generation_status)})`).join('\n') || '• Визуальные промпты не сформированы.';
  const mediaText=(savedMedia||[]).slice(0,4).map(m=>`• ${escapeHtml(m.player || 'Media')} — ${escapeHtml(m.asset_type)}: ${escapeHtml(m.status)}${m.missing_asset ? ` / ${escapeHtml(m.missing_asset)}` : ''}`).join('\n') || '• Медиа пока не найдено.';
  const hashtags=(drafts.hashtags || []).slice(0,10).join(' ');
  const missing=plan.missing_assets?.length ? plan.missing_assets.slice(0,4).map(x=>`• ${escapeHtml(x)}`).join('\n') : '• Критичных пропусков не найдено.';
  return `✅ <b>Кампания создана</b>\n\n<b>🎾 Событие</b>\n${escapeHtml(eventLine)}\n\n<b>📅 План публикаций</b>\n${scheduleText}\n\n<b>🧩 Задачи</b>\n${tasksText}\n\n<b>🎨 Визуалы</b>\n${visualText}\n\n<b>🎬 Медиа</b>\n${mediaText}\n\n<b>🏷 Hashtags</b>\n${escapeHtml(hashtags || '#PhuketTennisFamily #PTF #PhuketTennis')}\n\n<b>📝 Черновики</b>\nTelegram: ${escapeHtml(shortText(drafts.telegram_draft,220))}\nIG: ${escapeHtml(shortText(drafts.instagram_caption,220))}\n\n<b>⚠️ Нужно проверить</b>\n${missing}\n\n<b>➡️ Следующий шаг</b>\nПроверь строки в Content Calendar / Publication Schedule / Visual Prompts / Media Suggestions и напиши правки обычным текстом.`;
}
function formatStorylineReply(storyline) { return `💡 <b>Storyline найден</b>\n\n<b>Тип:</b> ${escapeHtml(storyline.trigger_type)}\n<b>Канал:</b> ${escapeHtml(storyline.suggested_channel)}\n<b>Формат:</b> ${escapeHtml(storyline.suggested_format)}\n\n<b>Почему важно</b>\n${escapeHtml(storyline.why_it_matters)}\n\n<b>Telegram draft</b>\n${escapeHtml(shortText(storyline.telegram_draft,420))}`; }
function formatTodayPack(pack) { const ready=pack.ready.map((r,i)=>`${i+1}. ${escapeHtml(r[3])} / ${escapeHtml(r[4])} — ${escapeHtml(r[6])} (${escapeHtml(r[11])})`).join('\n') || 'Нет ready-задач.'; const planned=pack.planned.map((r,i)=>`${i+1}. ${escapeHtml(r[3])} / ${escapeHtml(r[4])} — ${escapeHtml(r[6])} (${escapeHtml(r[11])})`).join('\n') || 'Нет planned-задач.'; return `📌 <b>Today’s PTF Content Pack</b>\n\n<b>Ready</b>\n${ready}\n\n<b>Planned</b>\n${planned}\n\nРекомендация: выбери 1 основной вечерний пост + 2–4 Stories. Автопостинг выключен.`; }
