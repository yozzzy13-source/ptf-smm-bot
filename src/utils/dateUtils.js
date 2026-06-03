import dayjs from 'dayjs';

export function nowIso() { return new Date().toISOString(); }
export function weekKey(date = new Date()) { return dayjs(date).format('YYYY-[W]WW'); }

export function bangkokDateContext() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return { isoDate: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, year: parts.year, humanRu: `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute} Bangkok time` };
}
