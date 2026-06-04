
export function actionKeyboard(targetType, targetId, context = {}) {
  const id = compactId(targetId);
  const type = compactId(targetType);
  return {
    inline_keyboard: [
      [
        { text: '✅ Утвердить', callback_data: `ptf|approve|${type}|${id}` },
        { text: '✏️ Править', callback_data: `ptf|edit|${type}|${id}` }
      ],
      [
        { text: '⏰ Отложить', callback_data: `ptf|postpone|${type}|${id}` },
        { text: '🔁 Пересобрать', callback_data: `ptf|regen|${type}|${id}` }
      ]
    ]
  };
}

export function postingKeyboard(reminderId, relatedObjectId = '') {
  const rid = compactId(reminderId);
  const oid = compactId(relatedObjectId || reminderId);
  return {
    inline_keyboard: [
      [
        { text: '✅ Опубликовал', callback_data: `ptf|posted|rem|${rid}` },
        { text: '⏳ Ещё нет', callback_data: `ptf|notyet|rem|${rid}` }
      ],
      [
        { text: '⏰ Позже', callback_data: `ptf|postpone|rem|${rid}` },
        { text: '🚫 Пропустить', callback_data: `ptf|skip|rem|${rid}` }
      ],
      [
        { text: '✏️ Править задачу', callback_data: `ptf|edit|rem|${rid}` }
      ]
    ]
  };
}

export function mediaIntakeKeyboard(referenceId) {
  const id = compactId(referenceId);
  return {
    inline_keyboard: [
      [
        { text: '🎨 Запомнить как стиль', callback_data: `ptf|style|ref|${id}` },
        { text: '👤 Реф игрока', callback_data: `ptf|playerref|ref|${id}` }
      ],
      [
        { text: '🎾 Реф события', callback_data: `ptf|eventref|ref|${id}` },
        { text: '🗑 Не использовать', callback_data: `ptf|skip|ref|${id}` }
      ]
    ]
  };
}

function compactId(v) {
  return String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'unknown';
}
