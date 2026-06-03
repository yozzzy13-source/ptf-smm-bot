import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { config } from '../config.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export function nowIso() {
  return dayjs().tz(config.timezone).format();
}

export function weekKey(date = new Date()) {
  return dayjs(date).tz(config.timezone).format('YYYY-[W]WW');
}

export function todayDate() {
  return dayjs().tz(config.timezone).format('YYYY-MM-DD');
}

export function parseHumanDateFallback(value) {
  if (!value) return '';
  return String(value).trim();
}
