export function classifyServiceMessage(text) {
  const t = (text || '').trim().toLowerCase();
  if (!t) return null;
  if (['/start', 'start'].includes(t)) return 'start';
  if (['/help','help','помощь','что ты умеешь','что умеешь?','зачем ты нужен','зачем ты нужен?','кто ты'].some((x) => t.includes(x))) return 'help';
  if (['привет','hello','hi','на связи','на связи?','проверь связь','проверь связь?','ты тут','ты тут?'].some((x) => t === x || t.includes(x))) return 'ping';
  if (isMediaOpsQuestion(t)) return 'media_ops_help';
  return null;
}

function isMediaOpsQuestion(t) {
  const asks = /(можешь|может|как|куда|где|что делать|правильно|нужно ли|зачем|почему|понял|поясни|объясни|проверь|находить|искать)/i.test(t);
  const mediaOps = /(media os|drive|google drive|диск|папк|директор|файл|видео|ролик|клип|референс|asset|ассет|player cards|карточк|скриншот|сайт|фронтенд|frontend|stories|reels|рилс|карусел)/i.test(t);
  const generationRequest = /(сгенер|генерир|создай постер|сделай постер|подготовь.*кампан|собери.*кампан|контент[-\s]?план)/i.test(t);
  return asks && mediaOps && !generationRequest;
}

export function serviceReply(kind) {
  if (kind === 'ping') {
    return `✅ <b>На связи</b>\n\nЯ AI SMM-бот Phuket Tennis Family. Пиши обычным текстом на русском или английском.\n\nЯ могу собрать SMM-пакет под событие: план публикаций, тексты, visual prompts, hashtags, storylines и медиа-подбор.`;
  }
  if (kind === 'media_ops_help') {
    return `🗂 <b>Media OS / логика файлов</b>\n\nЯ не должен на каждый вопрос запускать SMM-кампанию. Если ты спрашиваешь про папки, файлы, видео, player cards или сайт — я отвечаю как операционный помощник по Media OS.\n\n<b>Как хранить видео</b>\n• Видео конкретного матча кладём в папку кампании/события.\n• Видео игрока без конкретного события кладём в папку игрока.\n• Один файл не дублируем по нескольким папкам: я связываю файл с игроками/кампаниями через таблицы.\n\n<b>Типы контента</b>\nПапка Videos у игрока может быть общей. Я не требую заранее делить её на Stories/Reels/Carousel. После скана файл получает статус Need Review и подсказки: где он может подойти — Stories, Reel, player profile, recap, teaser и т.д.\n\n<b>Player cards</b>\nСкриншоты вручную после каждого матча делать не надо. Для динамических карточек правильная логика — брать данные из PlayerMaster/сайта или позже подключить frontend screenshot service. До подключения этого слоя я не буду требовать ручные скриншоты.`;
  }
  return `🤖 <b>PTF Media Bot</b>\n\n<b>Что я делаю</b>\n• создаю SMM-кампании под матчи и события\n• планирую публикации по времени и смыслу\n• готовлю Telegram / Instagram drafts на английском\n• определяю нужные визуалы: poster, Stories, carousel cover, Telegram cover, thumbnail\n• ищу storylines по match log\n• работаю с Media OS: папки, файлы, референсы, видео, asset library\n• запоминаю твои правки по стилю\n\n<b>Как писать</b>\nКоманды не нужны. Просто напиши, что произошло или что нужно подготовить. Если это вопрос про папки/файлы/сайт — я отвечу как помощник по Media OS, а не буду пересобирать кампанию.`;
}
