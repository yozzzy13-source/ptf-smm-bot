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
import { actionKeyboard } from './telegramKeyboardService.js';
import { config } from '../config.js';
import {
  createEvent,
  createContentTasks,
  getFeedbackRules,
  getRecentContentTasks,
  getRecentPublished,
  getPublicationSchedule,
  getRecentEvents,
  getSponsorIntegrations,
  getEcosystemProducts,
  saveSystemLog,
  saveVisualPrompts,
  saveGeneratedImages,
  savePublicationSchedule,
  saveMediaSuggestions,
  saveUserActionTasks,
  saveStrategicBrief,
  saveApprovalItems,
  saveReminders,
  saveCampaignState,
  saveDraftVersions
} from './sheetsStorage.js';
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
  if (route.intent === 'save_feedback_rule') {
    const { feedback, saved } = await processFeedback({ text, runLogger });
    return { type:'feedback', textRu:`✅ <b>Принял правку</b>\n\n${escapeHtml(feedback.response_ru || (saved ? 'Запомнил правило.' : 'Принял правку.'))}`, parseMode:'HTML' };
  }
  if (route.intent === 'generate_today_pack') { const pack=await generateTodayPackSummary(); return { type:'today_pack', textRu:formatTodayPack(pack), parseMode:'HTML' }; }
  if (route.intent === 'analyze_storylines') { const matchLogSummary=await getMatchLogSummary(60); const storyline=await analyzeStorylineFromText({ text, matchLogSummary }); return { type:'storyline', textRu:formatStorylineReply(storyline), parseMode:'HTML' }; }

  const matchLogSummary = await getMatchLogSummary(60);
  const { strategicBrief } = await buildStrategicBrief({ route, recentContent, recentPublished, recentEvents, publicationSchedule, matchLogSummary, partners, products, runLogger });
  const savedBrief = await saveStrategicBrief(strategicBrief, { route, strategicBrief });

  if (route.intent === 'strategic_content_plan' || route.intent === 'league_recap_campaign') {
    await saveSystemLog({ run_id:runId, level:'INFO', agent:'Strategic SMM Director', action:route.intent, status:'Brief created', raw_json:savedBrief });
    return { type:'strategic_brief', textRu:formatStrategicBriefReply(savedBrief), parseMode:'HTML', replyMarkup: actionKeyboard('brief', savedBrief.brief_id || savedBrief.id || 'brief') };
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

    const approvals = await saveApprovalItems(buildApprovals({ createdEvent, savedSchedule, savedVisuals, drafts }));
    const reminders = await saveReminders(buildReminders({ createdEvent, savedSchedule, savedActions, chatId: messageMeta.chatId }));
    await saveDraftVersions(buildDraftVersions({ createdEvent, drafts }));
    const campaign = await saveCampaignState({ related_event_id: createdEvent.event_id, campaign_name: `${createdEvent.player1} vs ${createdEvent.player2}`, stage:'Campaign Created', status:'Pending Approval', pending_actions:`${approvals.length} approvals / ${reminders.length} reminders`, raw_json:{ plan, savedSchedule, savedActions, savedVisuals, savedImages } });

    await saveSystemLog({ run_id:runId, level:'INFO', agent:'Strategic Event Lifecycle', action:'create_event_campaign', status:'Created', output_summary:`${createdTasks.length} tasks / ${savedSchedule.length} schedule / ${savedActions.length} user tasks / ${savedVisuals.length} visuals / ${savedImages.length} images / ${savedMedia.length} media / ${approvals.length} approvals / ${reminders.length} reminders`, raw_json:{strategicBrief:savedBrief,plan,createdEvent,createdTasks,drafts,visualPack,savedMedia,approvals,reminders,campaign} });

    const messages = formatEventCampaignMessages({ createdEvent, drafts, plan, savedVisuals, savedImages, savedSchedule, savedActions, savedMedia, strategicBrief:savedBrief, approvals, reminders, campaign });
    return { type:'event_campaign', textRu:messages.map(m=>m.text).join('\n\n'), parseMode:'HTML', messages, telegramImages: collectTelegramImages(visualPack.assets) };
  }
  return { type:'unknown', textRu:'Я понял сообщение, но пока не уверен, какой сценарий запустить. Переформулируй как задачу для SMM?' };
}

function buildApprovals({ createdEvent, savedSchedule, savedVisuals, drafts }) {
  const items = [
    { related_event_id: createdEvent.event_id, object_type:'campaign_plan', object_id: createdEvent.event_id, title:'Campaign plan', summary:'Approve full campaign plan', priority:'High' },
    { related_event_id: createdEvent.event_id, object_type:'telegram_draft', object_id: shortId('TGD'), title:'Telegram draft', summary: shortText(drafts.telegram_draft || '', 260), priority:'High' },
    { related_event_id: createdEvent.event_id, object_type:'instagram_caption', object_id: shortId('IGD'), title:'Instagram caption', summary: shortText(drafts.instagram_caption || '', 260), priority:'High' }
  ];
  for (const s of (savedSchedule || []).slice(0, 8)) items.push({ related_event_id: createdEvent.event_id, object_type:'schedule_item', object_id:s.schedule_id, title:s.title, summary:`${s.date} ${s.time} · ${s.channel}/${s.format}`, priority:'Medium' });
  for (const v of (savedVisuals || []).slice(0, 4)) items.push({ related_event_id: createdEvent.event_id, object_type:'visual', object_id:v.visual_id, title:v.asset_type, summary:`${v.channel || ''} ${v.size || ''}`, priority:'Medium' });
  return items;
}

function buildReminders({ createdEvent, savedSchedule, savedActions, chatId }) {
  const reminders = [];
  for (const s of (savedSchedule || [])) {
    reminders.push({
      due_date:s.date, due_time: reminderTimeBefore(s.time, 4), reminder_type:'Publish Follow-up', related_event_id:createdEvent.event_id, related_object_type:'schedule_item', related_object_id:s.schedule_id, title:s.title, telegram_chat_id:chatId,
      message:`Нужно подготовить/опубликовать: ${s.channel} / ${s.format} — ${s.title}. Запланировано на ${s.date} ${s.time}. Если уже опубликовано — нажми кнопку.`
    });
  }
  for (const a of (savedActions || [])) {
    reminders.push({
      due_date:a.date, due_time: normalizeTaskTime(a.time), reminder_type:'User Action', related_event_id:createdEvent.event_id, related_object_type:'user_action', related_object_id:a.task_id, title:a.type || 'User task', telegram_chat_id:chatId,
      message:`Задача для тебя: ${a.task}. Нужно к ${a.date} ${a.time}.`
    });
  }
  return reminders.slice(0, 30);
}
function normalizeTaskTime(t='') { return /(\d{1,2}:\d{2})/.test(t) ? t.match(/(\d{1,2}:\d{2})/)[1] : '15:00'; }
function reminderTimeBefore(t='18:00', hours=4) { const m=String(t).match(/(\d{1,2}):(\d{2})/); if(!m) return '13:00'; const d=new Date(Date.UTC(2026,0,1,Number(m[1]),Number(m[2]))); d.setUTCHours(d.getUTCHours()-hours); return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`; }
function buildDraftVersions({ createdEvent, drafts }) { return [
  { related_event_id:createdEvent.event_id, draft_type:'Telegram', text:drafts.telegram_draft || '', status:'Pending Approval' },
  { related_event_id:createdEvent.event_id, draft_type:'Instagram Caption', text:drafts.instagram_caption || '', status:'Pending Approval' },
  { related_event_id:createdEvent.event_id, draft_type:'Poster Prompt', text:drafts.poster_prompt || '', status:'Pending Approval' }
]; }


function formatEventCampaignMessages({ createdEvent, drafts, plan, savedVisuals, savedImages, savedSchedule, savedActions, savedMedia, strategicBrief, approvals, reminders, campaign }) {
  const eventLine = `${createdEvent.player1 || 'Player 1'} vs ${createdEvent.player2 || 'Player 2'} · ${createdEvent.division || 'Division'} · ${formatHumanDate(createdEvent.date, createdEvent.time)} · ${createdEvent.venue || 'venue TBC'}`;
  const planApproval = approvals.find(a=>a.object_type==='campaign_plan') || {};
  const scheduleSummary = summarizeSchedule(savedSchedule);
  const actionSummary = summarizeActions(savedActions);
  const visualSummary = summarizeVisuals(savedVisuals, savedImages, savedMedia);
  const msgs = [];
  msgs.push({
    text:`✅ <b>Кампания собрана</b>\n\n<b>🎾 Событие</b>\n${escapeHtml(eventLine)}\n\n<b>🧠 Стратегия</b>\n${escapeHtml(shortText(strategicBrief.strategic_thesis_ru || plan.lifecycle_strategy_ru || '', 480))}\n\n<b>📌 Summary</b>\n${scheduleSummary}\n${actionSummary}\n${visualSummary}\n\nУтверди план кнопкой или напиши правку ответом.`,
    parseMode:'HTML',
    replyMarkup: actionKeyboard('campaign', planApproval.approval_id || createdEvent.event_id)
  });
  msgs.push({ text:`📅 <b>План публикаций</b>\n\n${scheduleSummary}\n\n${formatSchedule(savedSchedule)}`, parseMode:'HTML', replyMarkup: actionKeyboard('schedule', planApproval.approval_id || createdEvent.event_id) });
  msgs.push({ text:`🎥 <b>Задачи для тебя</b>\n\n${actionSummary}\n\n${formatActions(savedActions)}\n\nБот будет напоминать по этим задачам и спрашивать статус кнопками.`, parseMode:'HTML' });
  msgs.push({ text:`🧵 <b>Хвост после события</b>\n\n${formatTailSummary(plan.post_event_tail || [])}\n\n${formatTail(plan.post_event_tail || [])}`, parseMode:'HTML' });
  msgs.push({ text:`🎨 <b>Визуалы / медиа</b>\n\n${visualSummary}\n\n${formatVisuals(savedVisuals, savedImages)}\n\n<b>🎬 Медиа</b>\n${formatMedia(savedMedia)}`, parseMode:'HTML' });
  msgs.push({ text:`📝 <b>Черновики для копирования</b>\n\n<b>Telegram</b>\n<pre>${escapeHtml(formatTelegramDraft(drafts.telegram_draft))}</pre>\n\n<b>Instagram</b>\n<pre>${escapeHtml(formatInstagramDraft(drafts.instagram_caption))}</pre>\n\n<b>Hashtags</b>\n<pre>${escapeHtml((drafts.hashtags || []).slice(0,12).join(' ') || extractHashtags(drafts.instagram_caption) || '#PhuketTennisFamily #PTF #PhuketTennis')}</pre>`, parseMode:'HTML', replyMarkup: actionKeyboard('drafts', approvals.find(a=>a.object_type==='telegram_draft')?.approval_id || createdEvent.event_id) });
  return msgs;
}

function formatHumanDate(date = '', time = '') {
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const m = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = normalizeTimeLabel(time);
  if (!m) return [date, t].filter(Boolean).join(' · ');
  return `${Number(m[3])} ${months[Number(m[2]) - 1]}${t ? ` · ${t}` : ''}`;
}
function normalizeTimeLabel(time = '') { const m=String(time || '').match(/(\d{1,2}:\d{2})/); return m ? m[1] : String(time || '').replace('Asia/Bangkok','').trim(); }
function formatDayHeader(date='') { return formatHumanDate(date, '').replace(' · ', ''); }
function ruChannel(v='') { const t=String(v||'').toLowerCase(); if(t.includes('instagram stories')) return 'Instagram Stories'; if(t==='instagram') return 'Instagram'; if(t.includes('telegram stories')) return 'Telegram Stories'; if(t.includes('telegram')) return 'Telegram'; if(t.includes('youtube')) return 'YouTube'; return v || 'Канал'; }
function ruFormat(v='') { const t=String(v||'').toLowerCase(); if(t.includes('feed')) return 'пост'; if(t.includes('post')) return 'пост'; if(t.includes('story')) return 'сторис'; if(t.includes('reel')) return 'рилс'; if(t.includes('carousel')) return 'карусель'; if(t.includes('cover')) return 'обложка'; if(t.includes('live')) return 'live update'; if(t.includes('user task')) return 'задача'; return v || 'формат'; }
function ruTitleText(v='') { const t=String(v||'').toLowerCase(); if(t.includes('teaser')) return 'тизер-сторис'; if(t.includes('short announcement')) return 'короткий анонс'; if(t.includes('player angle')) return 'сторис с акцентом на игроков'; if(t.includes('main poster') || t.includes('main match')) return 'главный матчевый постер'; if(t.includes('countdown')) return 'сторис-отсчёт'; if(t.includes('match day reminder')) return 'напоминание в день матча'; if(t.includes('morning')) return 'утреннее напоминание'; if(t.includes('talking')) return 'говорящее видео'; if(t.includes('last call')) return 'последний call перед матчем'; if(t.includes('live story')) return 'live stories с матча'; if(t.includes('live update')) return 'live update'; if(t.includes('quick result') || t.includes('result')) return 'быстрый результат'; if(t.includes('highlight')) return 'highlight reel'; if(t.includes('carousel')) return 'карусель'; return v || 'публикация'; }

function summarizeSchedule(rows=[]) {
  const counts = {};
  for (const r of dedupeDisplay(rows)) {
    const key = `${ruChannel(r.channel)} / ${ruFormat(r.format)}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  const lines = Object.entries(counts).map(([k,v])=>`• ${escapeHtml(k)} — ${v}`).join('\n');
  return `<b>Публикации: ${total}</b>${lines ? `\n${lines}` : ''}`;
}
function summarizeActions(rows=[]) {
  const total = (rows || []).length;
  const urgent = (rows || []).filter(x=>String(x.priority||'').toLowerCase().includes('high') || String(x.priority||'').toLowerCase().includes('выс')).length;
  return `<b>Задачи для тебя: ${total}</b>${urgent ? `\n• Приоритетные — ${urgent}` : ''}`;
}
function summarizeVisuals(visuals=[], images=[], media=[]) {
  const missing = (media || []).filter(x=>x.missing_asset).length;
  return `<b>Визуалы/медиа</b>\n• Visual prompts — ${(visuals || []).length}\n• Сгенерировано картинок — ${(images || []).length}\n• Недостаёт медиа — ${missing}`;
}
function dedupeDisplay(rows=[]) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    const k = `${r.date}|${r.time}|${ruChannel(r.channel)}|${ruFormat(r.format)}|${ruTitleText(r.title)}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
function groupByDate(rows=[]) {
  const groups = new Map();
  for (const r of dedupeDisplay(rows)) {
    const key = r.date || 'Дата уточняется';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return groups;
}
function formatSchedule(rows=[]) {
  const groups = groupByDate(rows);
  if (!groups.size) return 'План публикаций создан в таблице.';
  const blocks = [];
  for (const [date, items] of groups.entries()) {
    const lines = items.slice(0,12).map(s=>`• <b>${escapeHtml(normalizeTimeLabel(s.time))}</b> — ${escapeHtml(ruChannel(s.channel))} / ${escapeHtml(ruFormat(s.format))}: ${escapeHtml(ruTitleText(s.title))}${s.overlap_check ? `\n  <i>${escapeHtml(shortText(localizeNote(s.overlap_check),130))}</i>` : ''}`).join('\n');
    blocks.push(`<b>${escapeHtml(formatDayHeader(date))}</b>\n${lines}`);
  }
  return blocks.join('\n\n');
}
function formatActions(rows=[]) {
  if (!rows.length) return 'Задачи для съёмки не сформированы.';
  const groups = new Map();
  for (const a of rows) { const k=a.date || 'Дата уточняется'; if(!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
  return [...groups.entries()].map(([date, items])=>`<b>${escapeHtml(formatDayHeader(date))}</b>\n${items.slice(0,10).map(a=>`• <b>${escapeHtml(normalizeTimeLabel(a.time))}</b> — ${escapeHtml(localizeTask(a.task))}`).join('\n')}`).join('\n\n');
}
function formatTailSummary(rows=[]) {
  const counts = {};
  for (const x of rows || []) { const k = ruFormat(x.format || x.channel || 'контент'); counts[k] = (counts[k] || 0) + 1; }
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  const lines = Object.entries(counts).map(([k,v])=>`• ${escapeHtml(k)} — ${v}`).join('\n');
  return `<b>Post-event контент: ${total}</b>${lines ? `\n${lines}` : ''}`;
}
function formatTail(rows=[]){ return rows.slice(0,10).map(x=>`• <b>${escapeHtml(ruFormat(x.format || x.channel))}</b> · ${escapeHtml(x.day || '')}\n  ${escapeHtml(localizeTailIdea(x.idea || ''))}`).join('\n') || 'Хвост после события не сформирован.'; }
function formatVisuals(visuals=[], images=[]){ const v=visuals.slice(0,10).map(x=>`• ${escapeHtml(localizeVisual(x.asset_type))} — ${escapeHtml(x.size || x.channel)} (${escapeHtml(localizeStatus(x.generation_status))})`).join('\n') || 'Visual prompts не сформированы.'; const i=images.slice(0,4).map(x=>`• ${escapeHtml(localizeVisual(x.asset_type))} — ${x.link ? `<a href="${escapeHtml(x.link)}">Drive</a>` : escapeHtml(localizeStatus(x.status))}`).join('\n') || 'Картинки пока не сгенерированы.'; return `${v}\n\n<b>🖼 Generated</b>\n${i}`; }
function formatMedia(rows=[]){ return rows.slice(0,8).map(m=>`• ${escapeHtml(m.player || 'Media')} — ${escapeHtml(localizeVisual(m.asset_type))}: ${escapeHtml(localizeStatus(m.status))}${m.missing_asset ? ` / ${escapeHtml(localizeMissing(m.missing_asset))}` : ''}`).join('\n') || 'Медиа пока не найдено.'; }
function localizeNote(v='') { const s=String(v||''); if(/no conflict|different format|before event|post-event|story only|main feed/i.test(s)) return 'Ок: по смыслу не конфликтует с соседними публикациями.'; return s; }
function localizeTask(v='') { return String(v||'').replace('Talking story','говорящее видео').replace('pre-start live clips','клипы перед стартом').replace('live story set','live stories').replace('post-match','послематчевые'); }
function localizeTailIdea(v='') { return String(v||'').replace('Result story + one best rally','Результат + один лучший розыгрыш').replace('Highlight Reel','Highlight Reel').replace('Best moments carousel','Карусель лучших моментов').replace('Player reaction / quote','Реакция / цитата игрока').replace('League storyline / ranking impact','Storyline лиги / влияние на таблицу'); }
function localizeVisual(v='') { const t=String(v||'').toLowerCase(); if(t.includes('poster')) return 'постер'; if(t.includes('story')) return 'сторис-визуал'; if(t.includes('telegram')) return 'Telegram-обложка'; if(t.includes('carousel')) return 'обложка карусели'; if(t.includes('reel')) return 'обложка Reels'; if(t.includes('card')) return 'карточка игрока'; return v || 'визуал'; }
function localizeStatus(v='') { const t=String(v||'').toLowerCase(); if(t.includes('prompt')) return 'промпт готов'; if(t.includes('generated')) return 'сгенерировано'; if(t.includes('missing')) return 'нужно добавить'; if(t.includes('pending')) return 'ожидает'; return v || ''; }
function localizeMissing(v='') { if(String(v||'').toLowerCase().includes('photo')) return 'нужно фото/видео игрока или ссылка на папку'; return v; }
function formatTelegramDraft(text='') { return shortText(String(text || '').trim(), 1300); }
function formatInstagramDraft(text='') { return shortText(String(text || '').trim(), 1300); }
function extractHashtags(text='') { return (String(text||'').match(/#[\p{L}0-9_]+/gu) || []).slice(0,12).join(' '); }
function formatStrategicBriefReply(brief) { return `🧠 <b>Strategic SMM Brief создан</b>\n\n<b>Горизонт:</b> ${escapeHtml(brief.horizon || '')}\n<b>Стадия:</b> ${escapeHtml(brief.season_stage || '')}\n\n<b>Главная цель</b>\n${escapeHtml(brief.main_goal_ru || '')}\n\n<b>Тезис</b>\n${escapeHtml(brief.strategic_thesis_ru || '')}\n\n<b>Приоритеты</b>\n${(brief.content_priorities||[]).slice(0,6).map(x=>`• ${escapeHtml(x)}`).join('\n')}\n\n<b>Микс</b>\n${(brief.recommended_mix||[]).slice(0,6).map(x=>`• ${escapeHtml(x)}`).join('\n')}`; }
function formatStorylineReply(storyline) { return `💡 <b>Storyline найден</b>\n\n<b>Тип:</b> ${escapeHtml(storyline.trigger_type)}\n<b>Канал:</b> ${escapeHtml(storyline.suggested_channel)}\n<b>Формат:</b> ${escapeHtml(storyline.suggested_format)}\n\n<b>Почему важно</b>\n${escapeHtml(storyline.why_it_matters)}\n\n<b>Telegram draft</b>\n<pre>${escapeHtml(shortText(storyline.telegram_draft,700))}</pre>`; }
function formatTodayPack(pack) { const ready=pack.ready.map((r,i)=>`${i+1}. ${escapeHtml(r[3])} / ${escapeHtml(r[4])} — ${escapeHtml(r[6])} (${escapeHtml(r[11])})`).join('\n') || 'Нет ready-задач.'; const planned=pack.planned.map((r,i)=>`${i+1}. ${escapeHtml(r[3])} / ${escapeHtml(r[4])} — ${escapeHtml(r[6])} (${escapeHtml(r[11])})`).join('\n') || 'Нет planned-задач.'; return `📌 <b>Today’s PTF Content Pack</b>\n\n<b>Ready</b>\n${ready}\n\n<b>Planned</b>\n${planned}`; }
function collectTelegramImages(assets = []) { return (assets || []).filter((a) => a?.generated_image?.drive?.uploaded).map((a) => ({ assetType: a.asset_type || 'visual', caption: `🖼 ${a.asset_type || 'Generated image'}`, photoUrl: a.generated_image.drive.directImageUrl || a.generated_image.drive.webContentLink || a.generated_image.drive.webViewLink || '', driveLink: a.generated_image.drive.webViewLink || '' })).filter((x) => x.photoUrl); }
