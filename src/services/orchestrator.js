import { routeUserMessage } from '../router/aiCommandRouter.js';
import { buildStrategicBrief } from '../agents/strategicSmmDirectorAgent.js';
import { planEventCampaign } from '../agents/contentPlannerAgent.js';
import { generateDrafts } from '../agents/captionAgent.js';
import { processFeedback } from '../agents/feedbackAgent.js';
import { generateTodayPackSummary } from '../agents/todayPackAgent.js';
import { analyzeStorylineFromText } from '../agents/storylineAgent.js';
import { buildVisualPack } from '../agents/visualProductionAgent.js';
import { suggestMediaForEvent } from '../agents/mediaSuggestionAgent.js';
import { enforceLifecycleDepth } from './lifecycleScheduleService.js';
import { createEvent, createContentTasks, getFeedbackRules, getRecentContentTasks, getRecentPublished, getPublicationSchedule, getRecentEvents, getSponsorIntegrations, getEcosystemProducts, saveSystemLog, saveVisualPrompts, saveGeneratedImages, savePublicationSchedule, saveMediaSuggestions, saveUserActionTasks, saveStrategicBrief } from './sheetsStorage.js';
import { shortId } from '../utils/idUtils.js';
import { classifyServiceMessage, serviceReply } from '../knowledge/serviceReplies.js';
import { getMatchLogSummary } from './matchLogService.js';
import { escapeHtml, shortText } from '../utils/html.js';

export async function processUserText({ text, messageMeta, runLogger }) {
  const runId = messageMeta.runId || shortId('RUN');
  const serviceKind = classifyServiceMessage(text);
  if (serviceKind) return { type:'service_reply', textRu: serviceReply(serviceKind), parseMode:'HTML' };
  await saveSystemLog({ run_id: runId, level:'INFO', agent:'Orchestrator', action:'start', status:'Started', input_summary:text.slice(0,200) });

  const [recentEvents, recentContent, recentPublished, publicationSchedule, partners, products] = await Promise.all([
    getRecentEvents(8), getRecentContentTasks(100), getRecentPublished(80), getPublicationSchedule(200), getSponsorIntegrations(100), getEcosystemProducts(100)
  ]);
  const { route } = await routeUserMessage({ text, runLogger, conversationContext:{ recentEvents } });
  await saveSystemLog({ run_id:runId, level:'INFO', agent:'AI Command Router', action:'route', status:route.intent, input_summary:text.slice(0,200), output_summary:route.summary_ru, raw_json:route });

  if (route.intent === 'service_help') return { type:'service_reply', textRu:serviceReply('help'), parseMode:'HTML' };
  if (route.intent === 'ask_clarification' || route.confidence < 0.55) return { type:'clarification', textRu:`❓ <b>Нужно уточнение</b>\n\n${escapeHtml(route.clarification_question_ru || 'Уточни, пожалуйста, что нужно сделать?')}`, parseMode:'HTML' };
  if (route.intent === 'save_feedback_rule') { const { feedback, saved } = await processFeedback({ text, runLogger }); return { type:'feedback', textRu:`✅ <b>Принял правку</b>\n\n${escapeHtml(feedback.response_ru || (saved ? 'Запомнил правило.' : 'Принял правку.'))}`, parseMode:'HTML' }; }
  if (route.intent === 'generate_today_pack') { const pack=await generateTodayPackSummary(); return { type:'today_pack', textRu:formatTodayPack(pack), parseMode:'HTML' }; }
  if (route.intent === 'analyze_storylines') { const matchLogSummary=await getMatchLogSummary(60); const storyline=await analyzeStorylineFromText({ text, matchLogSummary }); return { type:'storyline', textRu:formatStorylineReply(storyline), parseMode:'HTML' }; }

  const matchLogSummary = await getMatchLogSummary(60);
  const { strategicBrief } = await buildStrategicBrief({ route, recentContent, recentPublished, recentEvents, publicationSchedule, matchLogSummary, partners, products, runLogger });
  const savedBrief = await saveStrategicBrief(strategicBrief, { route, strategicBrief });

  if (route.intent === 'strategic_content_plan' || route.intent === 'league_recap_campaign') {
    await saveSystemLog({ run_id:runId, level:'INFO', agent:'Strategic SMM Director', action:route.intent, status:'Brief created', raw_json:savedBrief });
    return { type:'strategic_brief', textRu:formatStrategicBriefReply(savedBrief), parseMode:'HTML' };
  }

  if (route.intent === 'create_event_campaign' || route.intent === 'create_visual_pack') {
    const rawPlan = await planEventCampaign({ route, strategicBrief: savedBrief, recentContent, recentPublished, publicationSchedule, runLogger });
    const plan = enforceLifecycleDepth(rawPlan.plan);
    const createdEvent=await createEvent(plan.event, { telegramSource:messageMeta.telegramSource, createdFrom:'Telegram AI Router' });
    const createdTasks=await createContentTasks(plan.content_tasks, createdEvent);
    const savedSchedule=await savePublicationSchedule(plan.publication_schedule || [], createdEvent.event_id, createdTasks);
    const savedActions=await saveUserActionTasks(plan.user_action_tasks || [], createdEvent.event_id);
    const feedbackRules=await getFeedbackRules(100);
    const { drafts }=await generateDrafts({ event:createdEvent, tasks:createdTasks, strategicBrief:savedBrief, feedbackRules, runLogger });
    const { visualPack }=await buildVisualPack({ route, event:createdEvent, tasks:createdTasks, drafts, strategicBrief:savedBrief, runLogger });
    const savedVisuals=await saveVisualPrompts(visualPack.assets, createdEvent.event_id);
    const savedImages=await saveGeneratedImages(visualPack.assets, createdEvent.event_id);
    const savedMedia=await saveMediaSuggestions(await suggestMediaForEvent({ event:createdEvent }), createdEvent.event_id);
    await saveSystemLog({ run_id:runId, level:'INFO', agent:'Strategic Event Lifecycle', action:'create_event_campaign', status:'Created', output_summary:`${createdTasks.length} tasks / ${savedSchedule.length} schedule / ${savedActions.length} user tasks / ${savedVisuals.length} visuals / ${savedImages.length} images / ${savedMedia.length} media`, raw_json:{strategicBrief:savedBrief,plan,createdEvent,createdTasks,drafts,visualPack,savedMedia} });
    return { type:'event_campaign', textRu:formatEventCampaignReply({ createdEvent, createdTasks, drafts, plan, savedVisuals, savedImages, savedSchedule, savedActions, savedMedia, strategicBrief:savedBrief }), parseMode:'HTML' };
  }
  return { type:'unknown', textRu:'Я понял сообщение, но пока не уверен, какой сценарий запустить. Переформулируй как задачу для SMM?' };
}

function formatEventCampaignReply({ createdEvent, drafts, plan, savedVisuals, savedImages, savedSchedule, savedActions, savedMedia, strategicBrief }) {
  const eventLine = `${createdEvent.player1 || 'Player 1'} vs ${createdEvent.player2 || 'Player 2'} · ${createdEvent.division || 'Division'} · ${createdEvent.date || 'date TBC'} ${createdEvent.time || ''} · ${createdEvent.venue || 'venue TBC'}`;
  const pre = (savedSchedule||[]).filter(s=>!String(s.channel).toLowerCase().includes('user')).slice(0,10).map(s=>`• ${escapeHtml(s.date)} ${escapeHtml(s.time)} — ${escapeHtml(s.channel)} / ${escapeHtml(s.format)}: ${escapeHtml(s.title)}`).join('\n') || '• План публикаций создан в таблице.';
  const actions=(savedActions||[]).slice(0,5).map(a=>`• ${escapeHtml(a.date)} ${escapeHtml(a.time)} — ${escapeHtml(a.task)}`).join('\n') || '• Задачи для съёмки не сформированы.';
  const tail=(plan.post_event_tail||[]).slice(0,5).map(x=>`• ${escapeHtml(x.day)} — ${escapeHtml(x.format)} / ${escapeHtml(x.channel)}: ${escapeHtml(x.idea)}`).join('\n') || '• Хвост после события не сформирован.';
  const visualText=(savedVisuals||[]).slice(0,6).map(v=>`• ${escapeHtml(v.asset_type)} — ${escapeHtml(v.size || v.channel)} (${escapeHtml(v.generation_status)})`).join('\n') || '• Визуальные промпты не сформированы.';
  const imageText=(savedImages||[]).slice(0,3).map(i=>`• ${escapeHtml(i.asset_type)} — ${i.link ? `<a href="${escapeHtml(i.link)}">Drive</a>` : escapeHtml(i.status)}`).join('\n') || '• Генерация изображений выключена или пока не выполнена.';
  const mediaText=(savedMedia||[]).slice(0,4).map(m=>`• ${escapeHtml(m.player || 'Media')} — ${escapeHtml(m.asset_type)}: ${escapeHtml(m.status)}${m.missing_asset ? ` / ${escapeHtml(m.missing_asset)}` : ''}`).join('\n') || '• Медиа пока не найдено.';
  const hashtags=(drafts.hashtags || []).slice(0,10).join(' ');
  const missing=plan.missing_assets?.length ? plan.missing_assets.slice(0,5).map(x=>`• ${escapeHtml(x)}`).join('\n') : '• Критичных пропусков не найдено.';
  return `✅ <b>SMM-кампания создана</b>\n\n<b>🎾 Событие</b>\n${escapeHtml(eventLine)}\n\n<b>🧠 Стратегия</b>\n${escapeHtml(shortText(strategicBrief.strategic_thesis_ru || plan.lifecycle_strategy_ru || '', 420))}\n\n<b>📅 План публикаций</b>\n${pre}\n\n<b>🎥 Что нужно сделать тебе</b>\n${actions}\n\n<b>🧵 Хвост после события</b>\n${tail}\n\n<b>🎨 Визуалы</b>\n${visualText}\n\n<b>🖼 Сгенерированные картинки</b>\n${imageText}\n\n<b>🎬 Медиа</b>\n${mediaText}\n\n<b>🏷 Hashtags</b>\n${escapeHtml(hashtags || '#PhuketTennisFamily #PTF #PhuketTennis')}\n\n<b>📝 Черновики</b>\nTelegram:\n<pre>${escapeHtml(shortText(drafts.telegram_draft,700))}</pre>\nIG:\n<pre>${escapeHtml(shortText(drafts.instagram_caption,700))}</pre>\n\n<b>⚠️ Нужно проверить / доснять</b>\n${missing}\n\n<b>➡️ Следующий шаг</b>\nПроверь расписание и напиши правки обычным текстом.`;
}
function formatStrategicBriefReply(brief) { return `🧠 <b>Strategic SMM Brief создан</b>\n\n<b>Горизонт:</b> ${escapeHtml(brief.horizon || '')}\n<b>Стадия:</b> ${escapeHtml(brief.season_stage || '')}\n\n<b>Главная цель</b>\n${escapeHtml(brief.main_goal_ru || '')}\n\n<b>Тезис</b>\n${escapeHtml(brief.strategic_thesis_ru || '')}\n\n<b>Приоритеты</b>\n${(brief.content_priorities||[]).slice(0,6).map(x=>`• ${escapeHtml(x)}`).join('\n')}\n\n<b>Микс</b>\n${(brief.recommended_mix||[]).slice(0,6).map(x=>`• ${escapeHtml(x)}`).join('\n')}\n\nЯ сохранил стратегический brief в таблицу. Следующим шагом можно попросить: “разложи это в календарь на 2 недели”.`; }
function formatStorylineReply(storyline) { return `💡 <b>Storyline найден</b>\n\n<b>Тип:</b> ${escapeHtml(storyline.trigger_type)}\n<b>Канал:</b> ${escapeHtml(storyline.suggested_channel)}\n<b>Формат:</b> ${escapeHtml(storyline.suggested_format)}\n\n<b>Почему важно</b>\n${escapeHtml(storyline.why_it_matters)}\n\n<b>Telegram draft</b>\n<pre>${escapeHtml(shortText(storyline.telegram_draft,700))}</pre>`; }
function formatTodayPack(pack) { const ready=pack.ready.map((r,i)=>`${i+1}. ${escapeHtml(r[3])} / ${escapeHtml(r[4])} — ${escapeHtml(r[6])} (${escapeHtml(r[11])})`).join('\n') || 'Нет ready-задач.'; const planned=pack.planned.map((r,i)=>`${i+1}. ${escapeHtml(r[3])} / ${escapeHtml(r[4])} — ${escapeHtml(r[6])} (${escapeHtml(r[11])})`).join('\n') || 'Нет planned-задач.'; return `📌 <b>Today’s PTF Content Pack</b>\n\n<b>Ready</b>\n${ready}\n\n<b>Planned</b>\n${planned}\n\nРекомендация: выбери 1 основной вечерний пост + 2–4 Stories. Автопостинг выключен.`; }
