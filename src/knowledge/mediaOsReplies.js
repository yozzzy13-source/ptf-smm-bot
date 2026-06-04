import { escapeHtml } from '../utils/html.js';

export function buildMediaOpsReply(text = '', decision = {}) {
  const t = String(text || '').toLowerCase();
  if (/(player cards|карточк|скриншот|скрин|сайт|фронтенд|frontend|website)/i.test(t)) return playerCardReply(decision);
  if (/(stories|reels|рилс|карусел|тип|формат|папка видео|видео.*игрок|контент.*тип)/i.test(t)) return contentTypeReply(decision);
  if (/(ищи|используй|можешь находить|без привязки|папках игроков|папки игроков)/i.test(t)) return mediaRuleAcceptedReply(decision);
  return generalMediaOpsReply(decision);
}

function currentCampaignLine(decision = {}) {
  const c = decision.target_campaign || {};
  if (!c.player1 && !c.player2) return 'Текущая кампания не выбрана.';
  return `${c.player1 || ''} vs ${c.player2 || ''}${c.division ? ` · ${c.division}` : ''}`;
}

function generalMediaOpsReply(decision = {}) {
  return `🗂 <b>Media OS: как я работаю с файлами</b>\n\n<b>Фокус сейчас:</b> ${escapeHtml(currentCampaignLine(decision))}\n\n<b>Главное правило</b>\nОдин файл не нужно дублировать по нескольким папкам. Если видео относится к матчу — оно лежит в папке кампании. Если это общий материал игрока — оно лежит в папке игрока. Связь “файл → игроки → кампания → формат публикации” хранится в таблицах.\n\n<b>Где я ищу медиа для кампании</b>\n1. Папка самой кампании.\n2. Папки игроков, которые участвуют в кампании.\n3. Brand / venue / sponsor assets.\n4. Общие references и архив.\n\n<b>Что я не должен делать</b>\nЯ не должен на такой вопрос пересобирать SMM-кампанию. Это операционный вопрос по Media OS.`;
}

function mediaRuleAcceptedReply(decision = {}) {
  return `✅ <b>Принял правило Media OS</b>\n\nЯ буду искать медиа не только в папке кампании, но и в папках игроков.\n\n<b>Логика:</b>\n• файл в папке кампании = материал конкретного события;\n• файл в папке игрока = общий player media asset;\n• для кампании можно использовать player media участников как teaser / player reference / profile material;\n• player media не считается видео конкретного матча, если оно не лежит в папке события.\n\n<b>Кампания в фокусе:</b> ${escapeHtml(currentCampaignLine(decision))}`;
}

function contentTypeReply(decision = {}) {
  return `🎬 <b>Логика типов контента для видео</b>\n\nПапку игрока <code>Videos</code> не надо заранее дробить на Stories / Reels / Carousel. Это быстро станет неудобно.\n\n<b>Как правильно:</b>\n• ты складываешь видео игрока в общую папку игрока;\n• сканер заносит файл в Assets Library;\n• бот ставит статус <code>Need Review</code>;\n• бот предлагает возможное использование: Stories, Reel, player profile, teaser, recap, best rally, emotion clip.\n\n<b>Форматы определяются не только папкой, а сочетанием:</b>\n• где лежит файл;\n• имя/тип файла;\n• игрок/кампания;\n• длительность/формат, когда добавим видео-анализ;\n• твоя разметка и история публикаций.\n\n<b>Итог:</b> папка может быть общей, а пригодность для Stories/Reels/Carousel будет решаться через asset metadata.`;
}

function playerCardReply(decision = {}) {
  return `🪪 <b>Player Cards / карточки игроков</b>\n\nДа, ты прав: если карточка на сайте динамическая и обновляется после матчей, вручную делать скриншот после каждого матча — плохой workflow.\n\n<b>Правильная логика:</b>\n1. Source of truth — <code>PlayerMaster</code>, ranking/standings и сайт.\n2. Для SMM бот не должен требовать ручной скриншот.\n3. Дальше добавим один из двух вариантов:\n   • <b>data card generator</b>: бот сам собирает карточку по данным PlayerMaster;\n   • <b>frontend screenshot service</b>: бот открывает страницу игрока и делает скрин нужного блока.\n\n<b>Что сейчас:</b>\nПапка <code>Player_Cards</code> нужна только для ручных/готовых карточек, если они уже есть. Она не обязательна для каждого обновления.\n\n<b>Что заложить дальше:</b>\nДобавить команду/сценарий <code>capture_player_card</code>, который получает player profile URL, делает свежий screenshot и использует его в Stories/Reels/poster overlays.`;
}
