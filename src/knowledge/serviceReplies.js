export function classifyServiceMessage(text) { const t=(text||'').trim().toLowerCase(); if(!t) return null; if(['/start','start'].includes(t)) return 'start'; if(['/help','help','помощь','что ты умеешь','что умеешь?','зачем ты нужен','зачем ты нужен?','кто ты'].some(x=>t.includes(x))) return 'help'; if(['привет','hello','hi','на связи','на связи?','проверь связь','проверь связь?','ты тут','ты тут?'].some(x=>t===x||t.includes(x))) return 'ping'; return null; }
export function serviceReply(kind) { if(kind==='ping') return `✅ <b>На связи</b>

Я AI SMM-бот Phuket Tennis Family. Пиши обычным текстом на русском или английском.

Я могу собрать SMM-пакет под событие: план публикаций, тексты, visual prompts, hashtags, storylines и медиа-подбор.`; return `🤖 <b>PTF Media Bot</b>

<b>Что я делаю</b>
• создаю SMM-кампании под матчи и события
• планирую публикации по времени и смыслу
• готовлю Telegram / Instagram drafts на английском
• определяю нужные визуалы: poster, Stories, carousel cover, Telegram cover, thumbnail
• ищу storylines по match log
• запоминаю твои правки по стилю

<b>Как писать</b>
Команды не нужны. Просто напиши, что произошло или что нужно подготовить.`; }
