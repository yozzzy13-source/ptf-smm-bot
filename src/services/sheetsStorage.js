import { SHEETS } from '../schemas/sheetSchema.js';
import { appendRow, appendRows, readRange, updateRange } from './googleSheetsService.js';
import { logger } from './logger.js';
import { shortId } from '../utils/idUtils.js';
import { nowIso, weekKey } from '../utils/dateUtils.js';
import { config } from '../config.js';

export async function createEvent(event, meta = {}) {
  const eventId = event.event_id || shortId('EVT');
  await appendRow(SHEETS.eventsMatches, [eventId,event.type || 'Match',event.date || '',event.time || '',event.venue || '',event.division || '',event.player1 || '',event.player2 || '',event.status || 'Planned',event.score_result || '',event.importance || 'Medium',event.story_angle || '',event.asset_folder || '',event.website_link || '',meta.telegramSource || '',meta.createdFrom || 'Telegram AI Router',event.notes || '',event.next_action || 'Prepare content campaign']);
  return { ...event, event_id: eventId };
}

export async function createContentTasks(tasks, event = {}) {
  const rows = (tasks || []).map((task) => { const id = task.content_id || shortId('CNT'); return [id,task.week || weekKey(task.publish_date || new Date()),task.publish_date || '',task.channel || '',task.format || '',task.content_pillar || '',task.title || '',task.related_player_1 || event.player1 || '',task.related_player_2 || event.player2 || '',task.related_event_match || event.event_id || event.title || '',task.asset_folder || event.asset_folder || '',task.status || 'Draft Ready',task.priority || 'Medium',task.owner || '',task.caption_status || '',task.edit_status || '',task.design_status || '',task.published_link || '',task.notes || '',task.agent_suggestion || '']; });
  if (rows.length) await appendRows(SHEETS.contentCalendar, rows);
  return rows.map((row) => ({ content_id: row[0], title: row[6], channel: row[3], format: row[4], status: row[11] }));
}

export async function createStorylines(storylines) { const rows = (storylines || []).map((s) => [s.storyline_id || shortId('STY'), nowIso(), s.division || '', s.players || '', s.match || '', s.trigger_type || '', s.why_it_matters || '', s.suggested_channel || '', s.suggested_format || '', s.status || 'Idea', s.related_content_id || '', s.telegram_draft || '', s.ig_story_idea || '', s.notes || '']); if (rows.length) await appendRows(SHEETS.storylines, rows); return rows; }

export async function saveVisualPrompts(assets, eventId = '') { const rows = (assets || []).map((a) => [a.visual_id || shortId('VIS'),eventId,a.asset_type || '',a.channel || '',a.use_case || '',a.prompt || '',a.generation_status || 'Prompt Ready',a.output_link_path || '',a.size || '',a.priority || 'Medium',a.notes || '',nowIso()]); if (rows.length) await appendRows(SHEETS.visualPrompts, rows); return rows.map((r) => ({ visual_id: r[0], asset_type: r[2], channel: r[3], use_case: r[4], generation_status: r[6], size: r[8] })); }

export async function saveGeneratedImages(assets, eventId = '') {
  const rows = [];
  for (const a of assets || []) {
    const g = a.generated_image;
    if (!g?.enabled) continue;
    rows.push([shortId('IMG'), a.visual_id || '', eventId, a.asset_type || '', a.prompt || '', g.model || '', g.size || a.size || '', g.quality || '', g.format || '', g.drive?.fileId || '', g.drive?.webViewLink || g.url || '', a.generation_status || 'Generated', g.drive?.reason || a.generation_error || '', nowIso()]);
  }
  if (rows.length) await appendRows(SHEETS.generatedImages, rows);
  return rows.map((r) => ({ image_id: r[0], asset_type: r[3], link: r[10], status: r[11] }));
}

export async function savePublicationSchedule(scheduleItems, eventId = '', createdTasks = []) { const rows=(scheduleItems||[]).map((item)=>{ const task=createdTasks.find((t)=>String(t.title).toLowerCase().includes(String(item.title||'').toLowerCase().slice(0,12)))||{}; return [item.schedule_id||shortId('SCH'), eventId, item.publish_date||'', item.publish_time||'', item.channel||'', item.format||'', item.title||'', item.purpose||'', item.overlap_check||'', item.status||'Planned', item.owner||'', item.related_content_id||task.content_id||'', item.notes||'', nowIso()]; }); if(rows.length) await appendRows(SHEETS.publicationSchedule, rows); return rows.map((r)=>({ schedule_id:r[0], date:r[2], time:r[3], channel:r[4], format:r[5], title:r[6], purpose:r[7], overlap_check:r[8], status:r[9] })); }

export async function saveUserActionTasks(tasks, eventId = '') { const rows=(tasks||[]).map((t)=>[t.task_id||shortId('ACT'),eventId,t.due_date||'',t.due_time||'',t.task_type||'',t.task||'',t.why_needed||'',t.priority||'Medium',t.status||'Planned',t.owner||'Kostya',t.notes||'',nowIso()]); if(rows.length) await appendRows(SHEETS.userActionTasks, rows); return rows.map((r)=>({ task_id:r[0], date:r[2], time:r[3], type:r[4], task:r[5], priority:r[7], status:r[8] })); }

export async function saveMediaSuggestions(suggestions, eventId = '') { const rows=(suggestions||[]).map((s)=>[s.suggestion_id||shortId('MED'), eventId, s.related_player||'', s.asset_type||'', s.asset_link_folder||'', s.best_for||'', s.priority||'Medium', s.status||'Suggested', s.reason||'', s.missing_asset||'', s.notes||'', nowIso()]); if(rows.length) await appendRows(SHEETS.mediaSuggestions, rows); return rows.map((r)=>({ suggestion_id:r[0], player:r[2], asset_type:r[3], best_for:r[5], priority:r[6], status:r[7], missing_asset:r[9] })); }

export async function saveStrategicBrief(brief, raw = {}) { const id=shortId('BRF'); await appendRow(SHEETS.strategicBriefs, [id, nowIso(), brief.horizon || '', brief.season_stage || '', brief.main_goal_ru || '', brief.strategic_thesis_ru || '', (brief.content_priorities||[]).join('\n'), (brief.risks_to_avoid||[]).join('\n'), (brief.sponsor_product_notes||[]).join('\n'), (brief.recommended_mix||[]).join('\n'), JSON.stringify(raw || brief)]); return { ...brief, brief_id:id }; }

export async function saveFeedbackRule(rule) { const id = rule.rule_id || shortId('RULE'); await appendRow(SHEETS.feedbackRules, [id, nowIso(), rule.scope || 'General', rule.rule || '', rule.applies_to_agent || 'All', rule.source_message || '', rule.status || 'Active', rule.notes || '']); return { ...rule, rule_id: id }; }
export async function saveSystemLog(log) { try { await appendRow(SHEETS.systemLogs, [log.log_id || shortId('LOG'), nowIso(), log.level || 'INFO', log.run_id || '', log.agent || '', log.action || '', log.status || '', log.input_summary || '', log.output_summary || '', log.error || '', JSON.stringify(log.raw_json || {})]); } catch (err) { logger.warn({ err: err.message, log }, 'System log write failed'); } }

async function safeRead(sheet, range, limit, label) { try { const rows = await readRange(sheet, range); return rows.slice(-limit); } catch (err) { logger.warn({ err: err.message }, `Failed to read ${label}; returning empty list`); return []; } }
export const getRecentPublished = (limit=50)=>safeRead(SHEETS.publishedArchive,'A2:P500',limit,'recent published');
export const getRecentContentTasks = (limit=100)=>safeRead(SHEETS.contentCalendar,'A2:T700',limit,'recent content tasks');
export const getPublicationSchedule = (limit=200)=>safeRead(SHEETS.publicationSchedule,'A2:N700',limit,'publication schedule');
export const getAssetsLibrary = (limit=300)=>safeRead(SHEETS.assetsLibrary,'A2:P700',limit,'assets library');
export const getPlayersContent = (limit=300)=>safeRead(SHEETS.playersContent,'A2:R700',limit,'players content');
export const getSponsorIntegrations = (limit=100)=>safeRead(SHEETS.sponsorIntegrations,'A2:K300',limit,'sponsor integrations');
export const getEcosystemProducts = (limit=100)=>safeRead(SHEETS.ecosystemProducts,'A2:K300',limit,'ecosystem products');

export async function getFeedbackRules(limit = 100) { try { const rows = await readRange(SHEETS.feedbackRules, 'A2:H300'); return rows.slice(-limit).map((r) => ({ scope: r[2], rule: r[3], applies_to_agent: r[4], status: r[6] })); } catch (err) { logger.warn({ err: err.message }, 'Failed to read feedback rules; returning empty list'); return []; } }
export async function getProjectContextRows(limit = 200) { try { const rows = await readRange(SHEETS.projectContext, 'A2:H500'); return rows.slice(0, limit); } catch (err) { logger.warn({ err: err.message }, 'Failed to read project context; returning empty list'); return []; } }
export async function getBrandRulesRows(limit = 200) { try { const rows = await readRange(SHEETS.brandRulesMemory, 'A2:H500'); return rows.slice(0, limit); } catch (err) { logger.warn({ err: err.message }, 'Failed to read brand rules; returning empty list'); return []; } }
export async function getBotMemoryRows(limit = 200) { try { const rows = await readRange(SHEETS.botMemory, 'A2:H500'); return rows.slice(0, limit); } catch (err) { logger.warn({ err: err.message }, 'Failed to read bot memory; returning empty list'); return []; } }
export async function getMatchLogSourceConfig() { try { return await readRange(SHEETS.matchLogSources, 'A2:H50'); } catch (err) { logger.warn({ err: err.message }, 'Failed to read match log source config; returning empty list'); return []; } }
export async function getRecentEvents(limit = 5) { try { const rows = await readRange(SHEETS.eventsMatches, 'A2:R500'); return rows.slice(-limit).map((r) => ({ event_id:r[0], type:r[1], date:r[2], time:r[3], venue:r[4], division:r[5], player1:r[6], player2:r[7], status:r[8], story_angle:r[11] })); } catch (err) { logger.warn({ err: err.message }, 'Failed to read recent events; returning empty list'); return []; } }

export async function syncSourceRegistryDefaults() { try { const existing = await getMatchLogSourceConfig(); if (existing.length) return; await appendRows(SHEETS.matchLogSources, [['SRC-001','Match Log',config.matchLogSpreadsheetId,config.matchLogSheetName,'Source of truth for results and storylines','Active','','Configured from env'],['SRC-002','Player Master',config.playerMasterSpreadsheetId,config.playerMasterSheetName,'Source of truth for players, avatars and player metadata','Active','','Configured from env']]); } catch (err) { logger.warn({ err: err.message }, 'Failed to seed match log source registry'); } }

export async function seedStrategicDefaults() {
  try {
    const rules = await safeRead(SHEETS.lifecycleRules, 'A2:J100', 5, 'lifecycle rules');
    if (!rules.length) await appendRows(SHEETS.lifecycleRules, [
      ['LIFE-001','2-3 days before event','Pre-event warm-up','3-5 IG Stories + 1 feed post + 1-2 Telegram posts','Instagram, Telegram','All announcements/covers before event start','Talking story + what to shoot','5-7 day tail after important match','Active','Seeded by v0.3'],
      ['LIFE-002','Match day','Live / before start','Morning reminder + 2-3h reminder + 30-60m countdown','Instagram Stories, Telegram','No pre-event content after start time','Record atmosphere, warmup, player reaction','Quick result update same day','Active','Seeded by v0.3'],
      ['LIFE-003','After event','Post-event tail','Result, highlights, carousel, reactions, ranking/storyline, recap','IG, TG, YouTube optional','Spread over 3-7 days','Ask quote/reaction from players','Reuse clips with cooldown','Active','Seeded by v0.3']
    ]);
    const products = await safeRead(SHEETS.ecosystemProducts, 'A2:K100', 5, 'ecosystem products');
    if (!products.length) await appendRows(SHEETS.ecosystemProducts, [
      ['PROD-001','PTF League','League','Regular competitive structure with divisions, results and rankings','Players, sponsors, tennis community','player stories, rankings, rivalries, finals race','High','Active','Always-on','Core ecosystem product',nowIso()],
      ['PROD-002','PTF Telegram Bot','Internal product','Booking, training and player utilities through Telegram','League players and students','behind-the-scenes, utility, convenience, community ops','Medium','Planned','','Mention when relevant',nowIso()],
      ['PROD-003','Weekend Tournaments','Events','Short-format weekend competitions and community events','Players, spectators, sponsors','event campaigns, finals, winners, sponsor activations','High','Planned','','Future content pillar',nowIso()]
    ]);
    const modelRows = await safeRead(SHEETS.modelConfig, 'A2:G100', 5, 'model config');
    if (!modelRows.length) await appendRows(SHEETS.modelConfig, [
      ['Router','OPENAI_ROUTER_MODEL','gpt-4.1-mini','OPENAI_MODEL','Fast intent routing','Active','Use stronger only if routing quality is poor'],
      ['Strategic SMM Director','OPENAI_STRATEGIC_MODEL','gpt-5.5','OPENAI_MODEL','High-level strategy, recap, content mix','Active','Requires API access to selected model'],
      ['Creative Planner','OPENAI_CREATIVE_MODEL','gpt-5.5','OPENAI_MODEL','Campaign planning, captions, visual prompts','Active','Requires API access to selected model'],
      ['Analyst','OPENAI_ANALYST_MODEL','gpt-5.5','OPENAI_MODEL','Match log and league recap analysis','Active','Requires API access to selected model'],
      ['Image','OPENAI_IMAGE_MODEL','gpt-image-2','gpt-image-1','Image generation','Active','Can be disabled with ENABLE_IMAGE_GENERATION=false']
    ]);
  } catch (err) { logger.warn({ err: err.message }, 'Failed to seed strategic defaults'); }
}

export async function saveApprovalItems(items = []) {
  const rows = items.map((i) => [
    i.approval_id || shortId('APR'), nowIso(), i.related_event_id || '', i.object_type || '', i.object_id || '', i.title || '', i.summary || '', i.status || 'Pending Approval', i.priority || 'Medium', i.telegram_chat_id || '', i.telegram_message_id || '', i.owner || 'Kostya', i.notes || '', nowIso()
  ]);
  if (rows.length) await appendRows(SHEETS.approvalQueue, rows);
  return rows.map((r) => ({ approval_id: r[0], object_type: r[3], object_id: r[4], title: r[5], status: r[7] }));
}

export async function saveReminders(items = []) {
  const rows = items.map((i) => [
    i.reminder_id || shortId('REM'), nowIso(), i.due_date || '', i.due_time || '', i.timezone || config.timezone, i.reminder_type || '', i.related_event_id || '', i.related_object_type || '', i.related_object_id || '', i.title || '', i.message || '', i.status || 'Pending', i.repeat_count || 0, i.last_sent_at || '', i.next_retry_at || '', i.telegram_chat_id || config.followupTelegramChatId || '', i.telegram_message_id || '', i.notes || ''
  ]);
  if (rows.length) await appendRows(SHEETS.reminders, rows);
  return rows.map((r) => ({ reminder_id: r[0], due_date: r[2], due_time: r[3], type: r[5], title: r[9], status: r[11], related_object_id: r[8] }));
}

export async function saveFollowupLog(log = {}) {
  await appendRow(SHEETS.followupLog, [shortId('FUP'), nowIso(), log.reminder_id || '', log.related_object_id || '', log.action || '', log.old_status || '', log.new_status || '', log.telegram_chat_id || '', log.telegram_message_id || '', log.notes || '', JSON.stringify(log.raw_json || {})]);
}

export async function saveTelegramMessageLink(link = {}) {
  const id = shortId('TML');
  await appendRow(SHEETS.telegramMessageLinks, [id, nowIso(), link.telegram_chat_id || '', link.telegram_message_id || '', link.direction || '', link.related_type || '', link.related_id || '', link.context || '', link.status || 'Active', link.notes || '']);
  return { ...link, link_id: id };
}

export async function saveUserDecision(decision = {}) {
  const id = shortId('DEC');
  await appendRow(SHEETS.userDecisions, [id, nowIso(), decision.telegram_chat_id || '', decision.telegram_message_id || '', decision.related_type || '', decision.related_id || '', decision.decision || '', decision.comment || '', decision.status_before || '', decision.status_after || '', decision.raw_text || '', JSON.stringify(decision.raw_json || {})]);
  return { ...decision, decision_id: id };
}

export async function saveReferenceAsset(asset = {}) {
  const id = asset.reference_id || shortId('REF');
  await appendRow(SHEETS.referenceAssets, [id, nowIso(), asset.source || '', asset.telegram_chat_id || '', asset.telegram_message_id || '', asset.telegram_file_id || '', asset.drive_link || '', asset.reference_type || '', asset.related_player || '', asset.related_event_id || '', asset.status || 'Needs Classification', asset.notes || '', nowIso()]);
  return { ...asset, reference_id: id };
}

export async function saveStylePackFromReference(referenceId, meta = {}) {
  const id = shortId('STL');
  await appendRow(SHEETS.stylePack, [id, nowIso(), `Style from ${referenceId}`, 'Visual Reference', '', 'Use as approved PTF visual reference', '', referenceId, 'Active', 'High', meta.notes || '', nowIso()]);
  return { style_id: id, reference_id: referenceId };
}

export async function saveCampaignState(state = {}) {
  const id = state.campaign_id || shortId('CMP');
  await appendRow(SHEETS.campaignState, [id, nowIso(), state.related_event_id || '', state.campaign_name || '', state.stage || 'Created', state.status || 'Active', state.approved_schedule || '', state.approved_visuals || '', state.approved_drafts || '', state.pending_actions || '', nowIso(), state.notes || '', JSON.stringify(state.raw_json || {})]);
  return { ...state, campaign_id: id };
}

export async function saveDraftVersions(items = []) {
  const rows = items.map((d) => [d.draft_id || shortId('DRF'), nowIso(), d.related_event_id || '', d.related_content_id || '', d.draft_type || '', d.version || 'v1', d.text || '', d.status || 'Pending Approval', d.feedback || '', d.telegram_message_id || '', d.notes || '', nowIso()]);
  if (rows.length) await appendRows(SHEETS.draftVersions, rows);
  return rows.map((r) => ({ draft_id: r[0], type: r[4], status: r[7] }));
}

export async function getDueReminders(limit = 20) {
  let rows = [];
  try { rows = await readRange(SHEETS.reminders, 'A2:R700'); } catch (err) { logger.warn({ err: err.message }, 'Failed to read reminders'); return []; }
  const now = new Date();
  return rows.map((r, idx) => ({ row_number: idx + 2, reminder_id: r[0], created_at: r[1], due_date: r[2], due_time: r[3], timezone: r[4], reminder_type: r[5], related_event_id: r[6], related_object_type: r[7], related_object_id: r[8], title: r[9], message: r[10], status: r[11], repeat_count: Number(r[12] || 0), last_sent_at: r[13], next_retry_at: r[14], telegram_chat_id: r[15], telegram_message_id: r[16], notes: r[17] }))
    .filter((r) => ['Pending', 'Pending Retry'].includes(r.status || 'Pending'))
    .filter((r) => r.repeat_count < config.maxReminderRepeats)
    .filter((r) => isReminderDue(r, now))
    .slice(0, limit);
}

function isReminderDue(r, now) {
  if (r.next_retry_at) return new Date(r.next_retry_at) <= now;
  const ds = `${r.due_date || ''}T${normalizeTime(r.due_time)}:00+07:00`;
  const due = new Date(ds);
  if (Number.isNaN(due.getTime())) return false;
  return due <= now;
}
function normalizeTime(t = '') { const m = String(t || '').match(/(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2,'0')}:${m[2]}` : '09:00'; }

export async function markReminderSent(reminderId, telegramMessageId = '') {
  const rows = await readRange(SHEETS.reminders, 'A2:R700');
  const idx = rows.findIndex((r) => r[0] === reminderId);
  if (idx < 0) return false;
  const rowNumber = idx + 2;
  const oldRepeat = Number(rows[idx][12] || 0);
  const next = new Date(Date.now() + config.reminderRetryMinutes * 60 * 1000).toISOString();
  await updateRange(SHEETS.reminders, `L${rowNumber}:Q${rowNumber}`, [['Pending Retry', oldRepeat + 1, nowIso(), next, rows[idx][15] || config.followupTelegramChatId || '', telegramMessageId]]);
  return true;
}

export async function markReminderStatus(reminderId, status, notes = '') {
  const rows = await readRange(SHEETS.reminders, 'A2:R700');
  const idx = rows.findIndex((r) => r[0] === reminderId);
  if (idx < 0) return false;
  const rowNumber = idx + 2;
  await updateRange(SHEETS.reminders, `L${rowNumber}:R${rowNumber}`, [[status, rows[idx][12] || 0, rows[idx][13] || '', rows[idx][14] || '', rows[idx][15] || '', rows[idx][16] || '', notes]]);
  return true;
}

export async function updateApprovalStatus(approvalOrObjectId, status, notes = '') {
  const rows = await readRange(SHEETS.approvalQueue, 'A2:N700');
  const idx = rows.findIndex((r) => r[0] === approvalOrObjectId || r[4] === approvalOrObjectId);
  if (idx < 0) return false;
  const rowNumber = idx + 2;
  await updateRange(SHEETS.approvalQueue, `H${rowNumber}:N${rowNumber}`, [[status, rows[idx][8] || '', rows[idx][9] || '', rows[idx][10] || '', rows[idx][11] || '', notes || rows[idx][12] || '', nowIso()]]);
  return true;
}
