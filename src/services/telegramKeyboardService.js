export function actionKeyboard(targetType, targetId, context = {}) {
  const id = compactId(targetId);
  const type = compactId(targetType);
  return { inline_keyboard: [[{ text: '✅ Утвердить', callback_data: `ptf|approve|${type}|${id}` }, { text: '✏️ Править', callback_data: `ptf|edit|${type}|${id}` }],[{ text: '⏰ Отложить', callback_data: `ptf|postpone|${type}|${id}` }, { text: '🔁 Пересобрать', callback_data: `ptf|regen|${type}|${id}` }]] };
}
export function postingKeyboard(reminderId, relatedObjectId = '') { const rid=compactId(reminderId); return { inline_keyboard: [[{ text:'✅ Опубликовал', callback_data:`ptf|posted|rem|${rid}` },{ text:'⏳ Ещё нет', callback_data:`ptf|notyet|rem|${rid}` }],[{ text:'⏰ Позже', callback_data:`ptf|postpone|rem|${rid}` },{ text:'🚫 Пропустить', callback_data:`ptf|skip|rem|${rid}` }],[{ text:'✏️ Править задачу', callback_data:`ptf|edit|rem|${rid}` }]] }; }
export function mediaIntakeKeyboard(referenceId) { const id=compactId(referenceId); return { inline_keyboard: [[{ text:'👤 Игрок', callback_data:`ptf|playerref|ref|${id}` },{ text:'🎨 Стиль', callback_data:`ptf|style|ref|${id}` }],[{ text:'🏟 Локация/партнёр', callback_data:`ptf|eventref|ref|${id}` },{ text:'🗑 Не использовать', callback_data:`ptf|skip|ref|${id}` }],[{ text:'🎨 Сгенерировать постер', callback_data:`ptf|generate|ref|${id}` }]] }; }
export function referenceBatchKeyboard(eventId = 'active') { const id=compactId(eventId); return { inline_keyboard: [[{ text:'✅ Подтвердить референсы', callback_data:`ptf|approve|refbatch|${id}` }],[{ text:'🎨 Главный постер 4:5', callback_data:`ptf|generate|visual|${id}` },{ text:'📱 Story 9:16', callback_data:`ptf|generate_story|visual|${id}` }],[{ text:'🖼 Telegram cover 16:9', callback_data:`ptf|generate_tg|visual|${id}` }]] }; }
export function visualSetKeyboard(visualJobId) { const id=compactId(visualJobId); return { inline_keyboard: [[{ text:'✅ Утвердить 1', callback_data:`ptf|approve_v1|vjob|${id}` },{ text:'✅ Утвердить 2', callback_data:`ptf|approve_v2|vjob|${id}` }],[{ text:'✏️ Править 1', callback_data:`ptf|edit_v1|vjob|${id}` },{ text:'✏️ Править 2', callback_data:`ptf|edit_v2|vjob|${id}` }],[{ text:'🔁 Перегенерировать оба', callback_data:`ptf|regen_both|vjob|${id}` }]] }; }

export function visualNextStepKeyboard(eventId = 'active') {
  const id = compactId(eventId);
  return {
    inline_keyboard: [
      [
        { text: '🎨 Главный постер 4:5', callback_data: `ptf|generate|visual_main|${id}` },
        { text: '📱 Story 9:16', callback_data: `ptf|generate|visual_story|${id}` }
      ],
      [
        { text: '🖼 Telegram cover 16:9', callback_data: `ptf|generate|visual_tg|${id}` },
        { text: '🔁 2 варианта заново', callback_data: `ptf|regen_both|visual|${id}` }
      ]
    ]
  };
}

export function campaignSelectorKeyboard(campaigns = []) { return { inline_keyboard: campaigns.slice(0,8).map((c)=>[{ text: campaignButtonLabel(c), callback_data: `ptf|focus|cmp|${compactId(c.event_id)}` }]) }; }
function campaignButtonLabel(c={}) { return `${c.player1 || 'Event'} vs ${c.player2 || ''} · ${shortDate(c.date)}`.slice(0,60); }
function shortDate(date='') { const m=String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m) return date||''; const months=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек']; return `${Number(m[3])} ${months[Number(m[2])-1]}`; }
function compactId(v) { return String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || 'unknown'; }
