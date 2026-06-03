
import { SHEETS } from '../schemas/sheetSchema.js';
import { appendRow, appendRows, readRange } from './googleSheetsService.js';
import { logger } from './logger.js';
import { shortId } from '../utils/idUtils.js';
import { nowIso, weekKey } from '../utils/dateUtils.js';
import { config } from '../config.js';

export async function createEvent(event, meta = {}) {
  const eventId = event.event_id || shortId('EVT');
  await appendRow(SHEETS.eventsMatches, [
    eventId,
    event.type || 'Match',
    event.date || '',
    event.time || '',
    event.venue || '',
    event.division || '',
    event.player1 || '',
    event.player2 || '',
    event.status || 'Planned',
    event.score_result || '',
    event.importance || 'Medium',
    event.story_angle || '',
    event.asset_folder || '',
    event.website_link || '',
    meta.telegramSource || '',
    meta.createdFrom || 'Telegram AI Router',
    event.notes || '',
    event.next_action || 'Prepare content campaign'
  ]);
  return { ...event, event_id: eventId };
}

export async function createContentTasks(tasks, event = {}) {
  const rows = tasks.map((task) => {
    const id = task.content_id || shortId('CNT');
    return [
      id,
      task.week || weekKey(task.publish_date || new Date()),
      task.publish_date || '',
      task.channel || '',
      task.format || '',
      task.content_pillar || '',
      task.title || '',
      task.related_player_1 || event.player1 || '',
      task.related_player_2 || event.player2 || '',
      task.related_event_match || event.event_id || event.title || '',
      task.asset_folder || event.asset_folder || '',
      task.status || 'Draft Ready',
      task.priority || 'Medium',
      task.owner || '',
      task.caption_status || '',
      task.edit_status || '',
      task.design_status || '',
      task.published_link || '',
      task.notes || '',
      task.agent_suggestion || ''
    ];
  });
  await appendRows(SHEETS.contentCalendar, rows);
  return rows.map((row) => ({ content_id: row[0], title: row[6], channel: row[3], format: row[4], status: row[11] }));
}

export async function createStorylines(storylines) {
  const rows = storylines.map((s) => [
    s.storyline_id || shortId('STY'), nowIso(), s.division || '', s.players || '', s.match || '', s.trigger_type || '', s.why_it_matters || '', s.suggested_channel || '', s.suggested_format || '', s.status || 'Idea', s.related_content_id || '', s.telegram_draft || '', s.ig_story_idea || '', s.notes || ''
  ]);
  if (rows.length) await appendRows(SHEETS.storylines, rows);
  return rows;
}

export async function saveVisualPrompts(assets, eventId = '') {
  const rows = (assets || []).map((a) => [
    a.visual_id || shortId('VIS'),
    eventId,
    a.asset_type || '',
    a.channel || '',
    a.use_case || '',
    a.prompt || '',
    a.generation_status || 'Prompt Ready',
    a.output_link_path || '',
    a.size || '',
    a.priority || 'Medium',
    a.notes || '',
    nowIso()
  ]);
  if (rows.length) await appendRows(SHEETS.visualPrompts, rows);
  return rows.map((r) => ({ visual_id: r[0], asset_type: r[2], channel: r[3], use_case: r[4], generation_status: r[6] }));
}

export async function saveFeedbackRule(rule) {
  const id = rule.rule_id || shortId('RULE');
  await appendRow(SHEETS.feedbackRules, [
    id, nowIso(), rule.scope || 'General', rule.rule || '', rule.applies_to_agent || 'All', rule.source_message || '', rule.status || 'Active', rule.notes || ''
  ]);
  return { ...rule, rule_id: id };
}

export async function saveSystemLog(log) {
  try {
    await appendRow(SHEETS.systemLogs, [
      log.log_id || shortId('LOG'), nowIso(), log.level || 'INFO', log.run_id || '', log.agent || '', log.action || '', log.status || '', log.input_summary || '', log.output_summary || '', log.error || '', JSON.stringify(log.raw_json || {})
    ]);
  } catch (err) {
    logger.warn({ err: err.message, log }, 'System log write failed');
  }
}

export async function getRecentPublished(limit = 50) {
  try {
    const rows = await readRange(SHEETS.publishedArchive, 'A2:P200');
    return rows.slice(-limit);
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to read recent published; returning empty list');
    return [];
  }
}

export async function getRecentContentTasks(limit = 100) {
  try {
    const rows = await readRange(SHEETS.contentCalendar, 'A2:T300');
    return rows.slice(-limit);
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to read recent content tasks; returning empty list');
    return [];
  }
}

export async function getFeedbackRules(limit = 100) {
  try {
    const rows = await readRange(SHEETS.feedbackRules, 'A2:H200');
    return rows.slice(-limit).map((r) => ({ scope: r[2], rule: r[3], applies_to_agent: r[4], status: r[6] }));
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to read feedback rules; returning empty list');
    return [];
  }
}

export async function getProjectContextRows(limit = 200) {
  try {
    const rows = await readRange(SHEETS.projectContext, 'A2:H300');
    return rows.slice(0, limit);
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to read project context; returning empty list');
    return [];
  }
}

export async function getBrandRulesRows(limit = 200) {
  try {
    const rows = await readRange(SHEETS.brandRulesMemory, 'A2:H300');
    return rows.slice(0, limit);
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to read brand rules; returning empty list');
    return [];
  }
}

export async function getBotMemoryRows(limit = 200) {
  try {
    const rows = await readRange(SHEETS.botMemory, 'A2:H300');
    return rows.slice(0, limit);
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to read bot memory; returning empty list');
    return [];
  }
}

export async function getMatchLogSourceConfig() {
  try {
    const rows = await readRange(SHEETS.matchLogSources, 'A2:H50');
    return rows;
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to read match log source config; returning empty list');
    return [];
  }
}

export async function syncSourceRegistryDefaults() {
  try {
    const existing = await getMatchLogSourceConfig();
    if (existing.length) return;
    await appendRows(SHEETS.matchLogSources, [
      ['SRC-001', 'Match Log', config.matchLogSpreadsheetId, config.matchLogSheetName, 'Source of truth for results and storylines', 'Active', '', 'Configured from env'],
      ['SRC-002', 'Player Master', config.playerMasterSpreadsheetId, config.playerMasterSheetName, 'Source of truth for players, avatars and player metadata', 'Active', '', 'Configured from env']
    ]);
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to seed match log source registry');
  }
}
