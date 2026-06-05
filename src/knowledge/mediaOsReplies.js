import { escapeHtml } from '../utils/html.js';

export function buildMediaOpsReply(text = '', decision = {}) {
  const intent = String(decision.intent || '').toUpperCase();
  const t = String(text || '').toLowerCase();

  if (intent === 'PLAYER_CARD_FRONTEND_CAPTURE' || /(player cards|карточк|скриншот|скрин|сайт|фронтенд|frontend|код|html|css|softr|страниц)/i.test(t)) {
    return playerCardReply(text, decision);
  }
  if (intent === 'MEDIA_CONTENT_TAXONOMY' || /(stories|story|reels|reel|рилс|карусел|тип|формат|папка видео|видео.*игрок|контент.*тип|подходит|как.*пойм)/i.test(t)) {
    return contentTypeReply(text, decision);
  }
  if (/(ищи|используй|можешь находить|без привязки|папках игроков|папки игроков|файл лежит|общий player media)/i.test(t)) {
    return mediaRuleAcceptedReply(decision);
  }
  return generalMediaOpsReply(text, decision);
}

function currentCampaignLine(decision = {}) {
  const c = decision.target_campaign || {};
  if (!c.player1 && !c.player2) return 'кампания не выбрана';
  return `${c.player1 || ''} vs ${c.player2 || ''}${c.division ? ` · ${c.division}` : ''}`;
}

function generalMediaOpsReply(text = '', decision = {}) {
  return `🗂 <b>Media OS</b>\n\n<b>Коротко по твоему вопросу:</b> я отвечаю как операционный помощник по файлам, а не запускаю SMM-кампанию.\n\n<b>Фокус:</b> ${escapeHtml(currentCampaignLine(decision))}\n\n<b>Базовая логика</b>\n• один файл не дублируем по разным папкам;\n• если видео относится к матчу — кладём в папку кампании;\n• если это общий материал игрока — кладём в папку игрока;\n• связи “файл → игрок → кампания → формат публикации” хранятся в таблицах после скана.\n\n<b>Следующий шаг</b>\nЕсли хочешь проверить файлы — загрузи 1–2 тестовых файла в Media OS и запусти <code>/scan_media_os</code>.`;
}

function mediaRuleAcceptedReply(decision = {}) {
  return `✅ <b>Принял правило поиска медиа</b>\n\nДа, я должен искать медиа не только в папке кампании, но и в папках игроков.\n\n<b>Как я это трактую:</b>\n• файл в папке кампании = материал конкретного события;\n• файл в папке игрока = общий player media asset;\n• для кампании можно использовать player media участников как teaser / player reference / profile material;\n• player media не считается видео конкретного матча, если оно не лежит в папке события.\n\n<b>Фокус:</b> ${escapeHtml(currentCampaignLine(decision))}`;
}

function contentTypeReply(text = '', decision = {}) {
  return `🎬 <b>Как я пойму, что видео подходит для Stories, Reels или карусели</b>\n\n<b>Главное:</b> папку игрока <code>Videos</code> не нужно заранее дробить на Stories / Reels / Carousel. Это будет неудобно и приведёт к дублям.\n\n<b>Как должно работать:</b>\n1. Ты кладёшь видео в общую папку игрока или кампании.\n2. <code>/scan_media_os</code> заносит файл в Assets Library.\n3. Файл получает статус <code>Need Review</code>.\n4. Дальше бот определяет возможные варианты использования через metadata и контекст.\n\n<b>Что будет учитываться:</b>\n• где лежит файл: игрок / кампания / архив;\n• формат: vertical / horizontal, video / photo;\n• длительность: короткий клип, длинный фрагмент, готовый reel;\n• содержание после будущего видео-анализа: rally, emotion, warm-up, talking, portrait, highlight;\n• история публикаций: использовалось или нет;\n• текущая кампания и нужный формат.\n\n<b>Практически:</b>\n• короткий вертикальный клип → Stories / Reels candidate;\n• сильный розыгрыш 10–25 сек → best rally story / Reel;\n• эмоция игрока → Stories / player profile;\n• горизонтальный длинный кусок → YouTube / archive / нарезка;\n• фото/скрин/карточка → carousel / poster / story card.\n\n<b>Итог:</b> папка может быть общей, а пригодность для Stories/Reels/Carousel определяется не папкой, а asset metadata после скана и анализа. Пока видео-анализ не подключён, я должен помечать такие файлы как <code>Need Review</code>, а не делать вид, что точно знаю содержание.`;
}

function playerCardReply(text = '', decision = {}) {
  const asksCode = /(код|html|css|блок|softr|frontend|фронтенд)/i.test(text);
  const codePart = asksCode
    ? `\n\n<b>Да, код блока/страницы сильно поможет.</b> Если ты дашь HTML/CSS/JS блока player profile или Softr custom code, мы сможем точнее понять:\n• какой контейнер надо скриншотить;\n• какие данные подтягиваются из PlayerMaster;\n• какие размеры карточки нужны для Stories/Reels;\n• как воспроизвести карточку без ручных скриншотов.\n\n<b>Лучший вариант для будущего патча:</b> не просто скриншот всей страницы, а screenshot service с Playwright/Puppeteer, который открывает URL игрока, ждёт загрузку, находит нужный CSS selector и делает screenshot конкретного блока.`
    : `\n\n<b>Технически это возможно.</b> Для этого нужен frontend screenshot service: бот открывает страницу игрока, ждёт загрузку карточки и делает screenshot нужного блока.`;

  return `🪪 <b>Player Cards / динамические карточки игроков</b>\n\nТы прав: если карточка на сайте обновляется после каждого матча, вручную делать скриншоты — плохой workflow.${codePart}\n\n<b>Что нужно будет знать боту:</b>\n• URL страницы игрока или шаблон URL;\n• как найти игрока: PlayerMaster ID / slug / имя;\n• CSS selector блока карточки;\n• нужно ли логиниться или страница публичная;\n• желаемый формат скриншота: 9:16 overlay, квадрат, 4:5, прозрачный/без фона.\n\n<b>Важное ограничение:</b> сейчас этот слой ещё не подключён. До патча с browser renderer я не должен требовать ручные скриншоты, но и не должен обещать, что уже могу снять карточку с фронтенда.\n\n<b>Правильный следующий патч:</b> <code>frontend screenshot service</code> для player cards.`;
}
