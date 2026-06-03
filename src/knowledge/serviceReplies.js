
export function classifyServiceMessage(text) {
  const t = (text || '').trim().toLowerCase();
  if (!t) return null;
  if (['/start', 'start'].includes(t)) return 'start';
  if (['/help', 'help', 'помощь', 'что ты умеешь', 'что умеешь?', 'зачем ты нужен', 'зачем ты нужен?', 'кто ты'].some((x) => t.includes(x))) return 'help';
  if (['привет', 'hello', 'hi', 'на связи', 'на связи?', 'проверь связь', 'проверь связь?', 'ты тут', 'ты тут?'].some((x) => t === x || t.includes(x))) return 'ping';
  return null;
}

export function serviceReply(kind) {
  if (kind === 'ping') {
    return `Да, я на связи.

Я AI SMM-бот Phuket Tennis Family. Можешь писать обычным текстом на русском или английском. Публичный контент я готовлю на английском. Я умею строить контент-планы, искать storylines по match log, готовить Telegram/Instagram drafts и понимать, какие изображения нужны: постер, stories, carousel cover, Telegram cover, thumbnail и другие.`;
  }

  return `Я AI SMM-бот Phuket Tennis Family.

Моя задача — помогать вести SMM-систему PTF без хаоса:
— создавать контент-план под матч или событие;
— готовить Telegram/Instagram drafts на английском;
— определять, какие изображения нужны, и готовить промпты/визуальные задачи;
— искать storylines по match log и движениям игроков по сезону;
— помнить твои правки по стилю;
— присылать Today’s Content Pack перед вечерним окном публикации.

Команды не обязательны. Просто напиши обычным текстом, что произошло или что нужно сделать.

Пример:
“На пятницу 17:00 The Peak, Chris против Robin, Division PRIME. Подготовь прогрев, сторис, Telegram, постер и обложку.”`;
}
