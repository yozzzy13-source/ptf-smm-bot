
import { routeUserMessage } from '../router/aiCommandRouter.js';
import { planEventCampaign } from '../agents/contentPlannerAgent.js';
import { generateDrafts } from '../agents/captionAgent.js';
import { processFeedback } from '../agents/feedbackAgent.js';
import { generateTodayPackSummary } from '../agents/todayPackAgent.js';
import { analyzeStorylineFromText } from '../agents/storylineAgent.js';
import { buildVisualPack } from '../agents/visualProductionAgent.js';
import { createEvent, createContentTasks, getFeedbackRules, getRecentContentTasks, saveSystemLog, saveVisualPrompts } from './sheetsStorage.js';
import { shortId } from '../utils/idUtils.js';
import { classifyServiceMessage, serviceReply } from '../knowledge/serviceReplies.js';
import { getMatchLogSummary } from './matchLogService.js';

export async function processUserText({ text, messageMeta, runLogger }) {
  const runId = messageMeta.runId || shortId('RUN');

  const serviceKind = classifyServiceMessage(text);
  if (serviceKind) {
    await saveSystemLog({ run_id: runId, level: 'INFO', agent: 'Service Reply', action: serviceKind, status: 'Replied', input_summary: text.slice(0, 200) });
    return { type: 'service_reply', textRu: serviceReply(serviceKind) };
  }

  await saveSystemLog({ run_id: runId, level: 'INFO', agent: 'Orchestrator', action: 'start', status: 'Started', input_summary: text.slice(0, 200) });

  const { route } = await routeUserMessage({ text, runLogger });
  await saveSystemLog({ run_id: runId, level: 'INFO', agent: 'AI Command Router', action: 'route', status: route.intent, input_summary: text.slice(0, 200), output_summary: route.summary_ru, raw_json: route });

  if (route.intent === 'service_help') {
    return { type: 'service_reply', textRu: serviceReply('help') };
  }

  if (route.intent === 'ask_clarification' || route.confidence < 0.55) {
    return {
      type: 'clarification',
      textRu: route.clarification_question_ru || 'Я не до конца понял задачу. Уточни, пожалуйста, что нужно сделать?'
    };
  }

  if (route.intent === 'save_feedback_rule') {
    const { feedback, saved } = await processFeedback({ text, runLogger });
    await saveSystemLog({ run_id: runId, level: 'INFO', agent: 'Feedback Agent', action: 'save_feedback_rule', status: saved ? 'Saved' : 'Not saved', output_summary: feedback.response_ru, raw_json: feedback });
    return { type: 'feedback', textRu: feedback.response_ru || (saved ? 'Запомнил правило.' : 'Принял правку для текущего контекста.') };
  }

  if (route.intent === 'generate_today_pack') {
    const pack = await generateTodayPackSummary();
    await saveSystemLog({ run_id: runId, level: 'INFO', agent: 'Daily Content Assistant', action: 'today_pack', status: 'Ready', output_summary: pack.summaryRu });
    return { type: 'today_pack', textRu: formatTodayPack(pack) };
  }

  if (route.intent === 'analyze_storylines') {
    const matchLogSummary = await getMatchLogSummary(40);
    const storyline = await analyzeStorylineFromText({ text, matchLogSummary });
    await saveSystemLog({ run_id: runId, level: 'INFO', agent: 'Storyline Agent', action: 'analyze_storyline', status: 'Idea created', raw_json: storyline });
    return { type: 'storyline', textRu: `Нашёл возможный storyline: ${storyline.trigger_type}.\nКанал: ${storyline.suggested_channel}. Формат: ${storyline.suggested_format}.\n\nПочему это важно:\n${storyline.why_it_matters}\n\nЧерновик для Telegram:\n${storyline.telegram_draft}` };
  }

  if (route.intent === 'create_event_campaign' || route.intent === 'create_visual_pack') {
    const recentContent = await getRecentContentTasks(50);
    const { plan } = await planEventCampaign({ route, recentContent, runLogger });
    const createdEvent = await createEvent(plan.event, { telegramSource: messageMeta.telegramSource, createdFrom: 'Telegram AI Router' });
    const createdTasks = await createContentTasks(plan.content_tasks, createdEvent);
    const feedbackRules = await getFeedbackRules(80);
    const { drafts } = await generateDrafts({ event: createdEvent, tasks: createdTasks, feedbackRules, runLogger });
    const { visualPack } = await buildVisualPack({ route, event: createdEvent, tasks: createdTasks, drafts, runLogger });
    const savedVisuals = await saveVisualPrompts(visualPack.assets, createdEvent.event_id);

    await saveSystemLog({ run_id: runId, level: 'INFO', agent: 'Content Planner Agent', action: 'create_event_campaign', status: 'Created', output_summary: `${createdTasks.length} tasks created / ${savedVisuals.length} visual prompts`, raw_json: { plan, createdEvent, createdTasks, drafts, visualPack } });

    return { type: 'event_campaign', textRu: formatEventCampaignReply({ createdEvent, createdTasks, drafts, plan, visualPack, savedVisuals }) };
  }

  return { type: 'unknown', textRu: 'Я понял сообщение, но пока не уверен, какой сценарий запустить. Можешь переформулировать как задачу для SMM?' };
}

function formatEventCampaignReply({ createdEvent, createdTasks, drafts, plan, visualPack, savedVisuals }) {
  const tasksText = createdTasks.map((t, i) => `${i + 1}. ${t.channel} / ${t.format} — ${t.title} (${t.status})`).join('\n');
  const missing = plan.missing_assets?.length ? `\n\nЧего не хватает:\n${plan.missing_assets.map((x) => `- ${x}`).join('\n')}` : '';
  const visualLines = (savedVisuals || []).slice(0, 6).map((v, i) => `${i + 1}. ${v.asset_type} / ${v.channel} / ${v.use_case} — ${v.generation_status}`).join('\n');
  return `✅ Создал event campaign.\n\nСобытие:\n${createdEvent.player1} vs ${createdEvent.player2}\n${createdEvent.division ? `Division ${createdEvent.division}\n` : ''}${createdEvent.date || ''} ${createdEvent.time || ''}\n${createdEvent.venue || ''}\n\nСоздано задач: ${createdTasks.length}\n${tasksText}${missing}\n\nTelegram draft:\n${drafts.telegram_draft}\n\nIG caption draft:\n${drafts.instagram_caption}\n\nPrimary poster prompt:\n${drafts.poster_prompt}\n\nВизуальные ассеты:\n${visualLines || 'Визуальные промпты не сформированы.'}\n\nКомментарий визуального агента:\n${visualPack.summary_ru}\n\nСледующий шаг: проверь черновики и напиши “approve”, “edit …” или дай правку.`;
}

function formatTodayPack(pack) {
  const ready = pack.ready.map((r, i) => `${i + 1}. ${r[3]} / ${r[4]} — ${r[6]} (${r[11]})`).join('\n') || 'Нет ready-задач.';
  const planned = pack.planned.map((r, i) => `${i + 1}. ${r[3]} / ${r[4]} — ${r[6]} (${r[11]})`).join('\n') || 'Нет planned-задач.';
  return `📌 Today’s PTF Content Pack\n\nReady:\n${ready}\n\nPlanned:\n${planned}\n\nРекомендация: выбери 1 основной вечерний пост + 2–4 Stories. Автопостинг выключен.`;
}
