import { config } from '../config.js';
import { getActiveCampaigns, getCurrentFocus, getCampaignByEventId, getActiveCampaign, saveIntentLog, saveRouterDecision, saveClarification, getCampaignLocks } from './sheetsStorage.js';
import { escapeHtml } from '../utils/html.js';
import { campaignSelectorKeyboard, visualNextStepKeyboard } from './telegramKeyboardService.js';

const VISUAL_WORDS = /(постер|картин|изображ|визуал|cover|poster|обложк|story\s*poster|telegram\s*cover|вариант)/i;
const GENERATE_WORDS = /(сгенер|генерир|создай|сделай|пришли|подготовь|перегенер|пересоздай)/i;
const CAMPAIGN_WORDS = /(кампан|контент[-\s]?план|smm[-\s]?кампан|прогрев|план публикац|schedule)/i;
const EDIT_WORDS = /(доработ|измени|исправ|сделай.*темн|крупн|лучше|увелич|уменьш|поменя|оставь|на базе|вариант\s*[12]|перв|втор|оба|обе)/i;
const NO_RECREATE = /(не\s+пересоздавай|не\s+создавай.*кампан|не\s+меняй.*(план|schedule)|только\s+(постер|визуал|картин)|используй\s+текущ|по\s+текущ|уже\s+утвержд)/i;

export async function stateAwareRoute({ text, messageMeta = {}, runId = '', runLogger }) {
  const raw = String(text || '').trim();
  const campaigns = await getActiveCampaigns(12);
  const focus = await getCurrentFocus(messageMeta.chatId || '');
  let focusedCampaign = focus?.related_event_id ? await getCampaignByEventId(focus.related_event_id) : null;
  if (!focusedCampaign) focusedCampaign = await getActiveCampaign();
  const target = resolveCampaign(raw, campaigns, focusedCampaign);
  const locks = target?.event_id ? await getCampaignLocks(target.event_id) : [];

  const decision = buildDecision({ raw, campaigns, target, locks });
  await saveIntentLog({ run_id: runId, raw_text: raw, intent: decision.intent, target_type: decision.target_type, target_id: decision.target_id, confidence: decision.confidence, allowed_actions: decision.allowed_actions, forbidden_actions: decision.forbidden_actions, needs_clarification: decision.needs_clarification, reason: decision.reason, raw_json: decision });
  await saveRouterDecision({ run_id: runId, raw_text: raw, intent: decision.intent, target_campaign: target?.event_id || '', target_object_type: decision.target_type, target_object_id: decision.target_id, confidence: decision.confidence, reason: decision.reason, allowed_actions: decision.allowed_actions, forbidden_actions: decision.forbidden_actions, pipeline: decision.pipeline, raw_json: decision });

  if (decision.needs_clarification) {
    const clarification = await saveClarification({ run_id: runId, question: decision.clarification_question_ru, options: campaigns.slice(-5).map(campaignLabel), raw_text: raw, telegram_chat_id: messageMeta.chatId || '', raw_json: decision });
    return { ...decision, clarification_id: clarification.clarification_id, replyMarkup: campaignSelectorKeyboard(campaigns.slice(-5)) };
  }
  return decision;
}

function buildDecision({ raw, campaigns, target, locks }) {
  const t = raw.toLowerCase();
  const hasVisual = VISUAL_WORDS.test(raw);
  const hasGenerate = GENERATE_WORDS.test(raw);
  const hasCampaign = CAMPAIGN_WORDS.test(raw);
  const hasEdit = EDIT_WORDS.test(raw);
  const noRecreate = NO_RECREATE.test(raw);
  const explicitlyNew = /(нов(ая|ую)\s+кампан|нов(ое|ый)\s+событ|нов(ый)?\s+матч|собери\s+кампан|подготовь.*кампан|подготовь.*контент[-\s]?план)/i.test(raw) && !noRecreate;
  const multipleCampaigns = campaigns.length > 1;
  const vagueCurrent = /(это|этот|текущ|по\s+нему|по\s+кампан|по\s+матч|референс|визуал|постер|картин)/i.test(raw) && !mentionsAnyCampaign(raw, campaigns);

  if (hasVisual && hasEdit && !explicitlyNew) {
    return decision('EDIT_VISUAL', target, 0.9, 'visual_revision', ['read_active_campaign','read_last_visual_job','create_visual_revision'], ['create_campaign','change_schedule','create_publication_plan'], 'Правка/выбор варианта визуала по текущей кампании.');
  }
  if (hasVisual && hasGenerate && !explicitlyNew) {
    return decision('GENERATE_VISUAL', target, 0.92, 'visual_only_generation', ['read_active_campaign','read_reference_assets','create_visual_job','generate_two_options','send_images_to_telegram'], ['create_campaign','change_schedule','create_publication_plan'], 'Запрос на генерацию визуала. Кампанию и schedule трогать нельзя.');
  }
  if (/референс|reference|фото|логотип|стиль|постер-реф/i.test(raw) && !hasCampaign) {
    return decision('REGISTER_REFERENCE_ASSETS', target, 0.78, 'reference_intake', ['bind_reference_assets','suggest_next_visual_step'], ['create_campaign','change_schedule'], 'Запрос относится к референсам/медиа.');
  }
  if (explicitlyNew) {
    return decision('CREATE_OR_UPDATE_CAMPAIGN', target, 0.86, 'campaign_planner', ['create_or_update_campaign','create_schedule','create_tasks','create_visual_prompts'], locks.length ? ['overwrite_locked_schedule_without_confirmation'] : [], 'Пользователь явно просит кампанию/контент-план.');
  }
  if (hasCampaign && /измени|доработ|пересобер|обнови|исправ/i.test(raw)) {
    return decision('UPDATE_CAMPAIGN', target, 0.82, 'campaign_update', ['update_existing_campaign'], ['create_new_campaign_unless_explicit'], 'Правка существующей кампании.');
  }
  if (multipleCampaigns && vagueCurrent && config.clarificationFirst) {
    return { intent:'ASK_CAMPAIGN_CLARIFICATION', target_type:'campaign', target_id:'', confidence:0.52, pipeline:'clarification', allowed_actions:[], forbidden_actions:['create_campaign','generate_image','change_schedule'], needs_clarification:true, clarification_question_ru:'К какой кампании относится действие?', reason:'Несколько активных кампаний и нет явного указания.', raw:{ raw, campaigns: campaigns.map(campaignLabel) } };
  }
  return decision('UNKNOWN_OR_GENERAL', target, 0.6, 'ai_router_fallback', ['ask_ai_router'], [], 'Неочевидный запрос, можно передать в AI Router.');
}

function decision(intent, target, confidence, pipeline, allowed_actions, forbidden_actions, reason) {
  return { intent, target_type:'campaign', target_id: target?.event_id || '', target_campaign: target || null, confidence, pipeline, allowed_actions, forbidden_actions, needs_clarification:false, clarification_question_ru:'', reason };
}

function resolveCampaign(raw, campaigns, focusedCampaign) {
  const explicit = campaigns.find((c)=>campaignMentionScore(raw,c) >= 2);
  return explicit || focusedCampaign || campaigns.slice(-1)[0] || null;
}
function mentionsAnyCampaign(raw, campaigns) { return campaigns.some((c)=>campaignMentionScore(raw,c)>=2); }
function campaignMentionScore(raw, c) {
  const t = raw.toLowerCase(); let score = 0;
  for (const name of [c.player1, c.player2, c.division, c.venue].filter(Boolean)) {
    const parts = String(name).toLowerCase().split(/\s+/).filter(x=>x.length>2);
    if (parts.some(p=>t.includes(p))) score += 1;
  }
  return score;
}
export function campaignLabel(c = {}) { return `${c.player1 || ''} vs ${c.player2 || ''} · ${humanDate(c.date, c.time)} · ${c.division || ''}`.trim(); }
function humanDate(date='', time='') {
  const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); const tm=String(time||'').match(/(\d{1,2}:\d{2})/)?.[1] || '';
  if(!m) return [date,tm].filter(Boolean).join(' · ');
  return `${Number(m[3])} ${months[Number(m[2])-1]}${tm ? ` · ${tm}` : ''}`;
}

export function formatRouterDebug(decision = {}) {
  const c = decision.target_campaign || {};
  return `🧭 <b>Режим:</b> ${escapeHtml(decision.intent)}\n<b>Кампания:</b> ${escapeHtml(campaignLabel(c) || 'не выбрана')}\n<b>Pipeline:</b> <code>${escapeHtml(decision.pipeline || '')}</code>\n<b>Не трогаю:</b> ${escapeHtml((decision.forbidden_actions||[]).join(', ') || '—')}`;
}
