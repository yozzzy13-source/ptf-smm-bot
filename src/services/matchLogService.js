
import { config } from '../config.js';
import { readRange } from './googleSheetsService.js';
import { logger } from './logger.js';

export async function getRecentMatchLog(limit = 50) {
  try {
    const rows = await readRange(config.matchLogSheetName, 'A1:Z400', config.matchLogSpreadsheetId);
    const header = rows[0] || [];
    const body = rows.slice(1).filter((r) => r.some(Boolean));
    return { header, rows: body.slice(-limit) };
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to read match log');
    return { header: [], rows: [] };
  }
}

export async function getPlayerMaster(limit = 200) {
  try {
    const rows = await readRange(config.playerMasterSheetName, 'A1:Z400', config.playerMasterSpreadsheetId);
    const header = rows[0] || [];
    const body = rows.slice(1).filter((r) => r.some(Boolean));
    return { header, rows: body.slice(0, limit) };
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to read player master');
    return { header: [], rows: [] };
  }
}

export async function getMatchLogSummary(limit = 30) {
  const [matchLog, playerMaster] = await Promise.all([getRecentMatchLog(limit), getPlayerMaster(80)]);
  return {
    match_log_header: matchLog.header,
    recent_match_log_rows: matchLog.rows,
    player_master_header: playerMaster.header,
    player_master_rows: playerMaster.rows
  };
}
