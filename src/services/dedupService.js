import { SHEETS } from '../schemas/sheetSchema.js';
import { appendRow, readRange } from './googleSheetsService.js';
import { nowIso } from '../utils/dateUtils.js';
import { logger } from './logger.js';

const memoryCache = new Set();

export async function isDuplicate(dedupKey) {
  if (!dedupKey) return false;
  if (memoryCache.has(dedupKey)) return true;
  try {
    const rows = await readRange(SHEETS.dedup, 'A2:A1000');
    const found = rows.some((r) => r[0] === dedupKey);
    if (found) memoryCache.add(dedupKey);
    return found;
  } catch (err) {
    logger.warn({ err: err.message }, 'Dedup read failed; falling back to memory only');
    return false;
  }
}

export async function markProcessed(dedupKey, source = 'telegram', notes = '') {
  if (!dedupKey) return;
  memoryCache.add(dedupKey);
  try {
    await appendRow(SHEETS.dedup, [dedupKey, nowIso(), source, 'Processed', notes]);
  } catch (err) {
    logger.warn({ err: err.message }, 'Dedup write failed');
  }
}
