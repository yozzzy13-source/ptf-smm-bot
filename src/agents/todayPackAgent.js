import { getRecentContentTasks, getRecentPublished } from '../services/sheetsStorage.js';

export async function generateTodayPackSummary() {
  const recentTasks = await getRecentContentTasks(80);
  const recentPublished = await getRecentPublished(40);
  const ready = recentTasks.filter((r) => String(r[11] || '').toLowerCase().includes('ready')).slice(-8);
  const planned = recentTasks.filter((r) => String(r[11] || '').toLowerCase().includes('plan')).slice(-8);
  return {
    ready,
    planned,
    recentPublished,
    summaryRu: `Готовый Today Pack: ${ready.length} ready-задач, ${planned.length} planned-задач. Проверь вкладку Content Calendar.`
  };
}
