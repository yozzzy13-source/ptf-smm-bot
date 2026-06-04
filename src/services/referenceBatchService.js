import { getRecentReferenceAssets, saveAssetBindings } from './sheetsStorage.js';
import { escapeHtml } from '../utils/html.js';
import { referenceBatchKeyboard } from './telegramKeyboardService.js';

export async function buildReferenceBatchSummary({ event = {}, limit = 10 } = {}) {
  const refs = await getRecentReferenceAssets(limit);
  const active = refs.filter((r)=>!event.event_id || !r.related_event_id || r.related_event_id === event.event_id).slice(-limit);
  const guessed = active.map((r, idx)=>({ ...r, idx: idx + 1, guessed_role: guessRole(r) }));
  if (event?.event_id && guessed.length) {
    await saveAssetBindings(guessed.map((r)=>({ reference_id:r.reference_id, related_event_id:event.event_id, related_campaign_id:event.event_id, role:r.guessed_role, related_player:r.related_player || '', status:'Suggested', confidence:0.7, notes:'Auto binding suggestion from v0.5 reference batch' })));
  }
  return { refs: guessed, textRu: formatReferenceBatch({ refs: guessed, event }), replyMarkup: referenceBatchKeyboard(event?.event_id || 'active') };
}

function guessRole(r={}) {
  const t = `${r.reference_type || ''} ${r.notes || ''}`.toLowerCase();
  if (/player|игрок|портрет|avatar|photo/.test(t)) return 'player_reference';
  if (/style|стил|poster|постер|reference/.test(t)) return 'style_reference';
  if (/logo|ptf|brand|бренд/.test(t)) return 'brand_reference';
  if (/event|venue|peak|локац|партн/.test(t)) return 'event_location_reference';
  return 'unsorted_reference';
}

function formatReferenceBatch({ refs = [], event = {} }) {
  const lines = refs.map((r)=>`${r.idx}. ${escapeHtml(labelRole(r.guessed_role))} — <code>${escapeHtml(r.reference_id)}</code>${r.related_player ? ` · ${escapeHtml(r.related_player)}` : ''}`).join('\n') || 'Референсы пока не найдены.';
  return `📎 <b>Референсы для кампании</b>\n\n${event?.player1 ? `<b>Кампания:</b> ${escapeHtml(event.player1)} vs ${escapeHtml(event.player2 || '')}\n\n` : ''}${lines}\n\n<b>Следующий шаг</b>\nПодтверди пакет или сразу запускай генерацию визуалов.`;
}
function labelRole(role='') {
  const m = { player_reference:'реф игрока', style_reference:'стиль / постер-референс', brand_reference:'бренд / логотип', event_location_reference:'локация / партнёр', unsorted_reference:'не разобрано' };
  return m[role] || role;
}
