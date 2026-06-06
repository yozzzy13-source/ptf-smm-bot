export function actionKeyboard(targetType, targetId, context = {}) {
  const id = compactId(targetId);
  const type = compactId(targetType);
  return { inline_keyboard: [[{ text: '✅ Утвердить', callback_data: `ptf|approve|${type}|${id}` }, { text: '✏️ Править', callback_data: `ptf|edit|${type}|${id}` }],[{ text: '⏰ Отложить', callback_data: `ptf|postpone|${type}|${id}` }, { text: '🔁 Пересобрать', callback_data: `ptf|regen|${type}|${id}` }]] };
}
export function postingKeyboard(reminderId, relatedObjectId = '') { const rid=compactId(reminderId); return { inline_keyboard: [[{ text:'✅ Опубликовал', callback_data:`ptf|posted|rem|${rid}` },{ text:'⏳ Ещё нет', callback_data:`ptf|notyet|rem|${rid}` }],[{ text:'⏰ Позже', callback_data:`ptf|postpone|rem|${rid}` },{ text:'🚫 Пропустить', callback_data:`ptf|skip|rem|${rid}` }],[{ text:'✏️ Править задачу', callback_data:`ptf|edit|rem|${rid}` }]] }; }
export function mediaIntakeKeyboard(referenceId) {
  const id = compactId(referenceId);
  return {
    inline_keyboard: [
      [
        { text:'👤 Игрок', callback_data:`ptf|playerref|ref|${id}` },
        { text:'🪪 Player card', callback_data:`ptf|playercard|ref|${id}` }
      ],
      [
        { text:'🎨 Стиль/композиция', callback_data:`ptf|style|ref|${id}` },
        { text:'🏷 PTF logo exact', callback_data:`ptf|brandlogo|ref|${id}` }
      ],
      [
        { text:'🏟 Локация/партнёр', callback_data:`ptf|eventref|ref|${id}` },
        { text:'🏷 Venue/sponsor logo', callback_data:`ptf|venuelogo|ref|${id}` }
      ],
      [
        { text:'🗑 Не использовать', callback_data:`ptf|skip|ref|${id}` }
      ],
      [
        { text:'🎨 Сгенерировать постер', callback_data:`ptf|generate|ref|${id}` }
      ]
    ]
  };
}

export function campaignSelectorKeyboard(campaigns = []) { return { inline_keyboard: campaigns.slice(0,8).map((c)=>[{ text: campaignButtonLabel(c), callback_data: `ptf|focus|cmp|${compactId(c.event_id)}` }]) }; }
function campaignButtonLabel(c={}) { return `${c.player1 || 'Event'} vs ${c.player2 || ''} · ${shortDate(c.date)}`.slice(0,60); }
function shortDate(date='') { const m=String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m) return date||''; const months=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек']; return `${Number(m[3])} ${months[Number(m[2])-1]}`; }
function compactId(v) { return String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || 'unknown'; }
