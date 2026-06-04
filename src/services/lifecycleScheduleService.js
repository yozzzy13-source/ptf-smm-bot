function toDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y,m,d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(date) { return date.toISOString().slice(0,10); }
function addDays(date, n) { const d = new Date(date); d.setUTCDate(d.getUTCDate() + n); return d; }
function norm(s) { return String(s || '').toLowerCase(); }
function key(item) { return `${item.publish_date}|${item.publish_time}|${item.channel}|${item.format}|${item.title}`.toLowerCase(); }

export function enforceLifecycleDepth(plan) {
  const event = plan?.event || {};
  const eventDate = toDate(event.date);
  if (!eventDate || !event.time) return plan;
  const base = plan.publication_schedule || [];
  const existing = new Set(base.map(key));
  const defaults = buildDefaultLifecycle(event);
  const merged = [...base];
  for (const item of defaults) {
    if (!existing.has(key(item))) merged.push(item);
  }
  const sorted = merged.sort((a,b)=>`${a.publish_date} ${a.publish_time}`.localeCompare(`${b.publish_date} ${b.publish_time}`));
  const fixed = dedupeSchedule(fixPreEventAfterStart(sorted, event));
  return { ...plan, publication_schedule: fixed, user_action_tasks: dedupeUserTasks(mergeUserTasks(plan.user_action_tasks || [], buildDefaultUserTasks(event))), post_event_tail: mergeTail(plan.post_event_tail || [], buildDefaultTail(event)) };
}

function buildDefaultLifecycle(event) {
  const d = toDate(event.date);
  const dayM2 = fmt(addDays(d, -2));
  const dayM1 = fmt(addDays(d, -1));
  const day0 = fmt(d);
  const dayP1 = fmt(addDays(d, 1));
  const dayP2 = fmt(addDays(d, 2));
  const dayP3 = fmt(addDays(d, 3));
  const dayP5 = fmt(addDays(d, 5));
  return [
    sch(dayM2,'12:30','Instagram Stories','story','Тизер-сторис','Начать прогрев и показать, что приближается важный матч PRIME.','Нет конфликта: лёгкое касание, не дублирует главный постер.'),
    sch(dayM2,'19:00','Telegram','post','Короткий анонс','Сообщить внутреннему комьюнити, где и во сколько смотреть матч.','Нет конфликта: Telegram работает как внутренний канал комьюнити.'),
    sch(dayM1,'12:30','Instagram Stories','story','Сторис с акцентом на игроков','Показать человеческий/игровой угол перед матчем.','Другой формат, не дублирует анонс.'),
    sch(dayM1,'18:30','Instagram','post','Главный матчевый постер','Главный публичный анонс с визуалом.','Главный feed-пост, не конфликтует с Reels.'),
    sch(day0,'10:30','Instagram Stories','story','Напоминание в день матча','Утреннее напоминание аудитории.','Лёгкое касание в Stories.'),
    sch(day0,'14:00','Telegram','post','Напоминание в день матча','Напоминание для комьюнити до начала матча.','До начала события.'),
    sch(day0,'16:00','Telegram Stories','user task','Напоминание записать talking story','Пользователь записывает короткое говорящее видео перед матчем.','Это задача для пользователя, не обычный пост.'),
    sch(day0,'16:30','Instagram Stories','story','Сторис-отсчёт','Последнее напоминание перед началом матча.','До начала события.'),
    sch(day0,'19:30','Telegram','post','Быстрый результат','Опубликовать результат и первую реакцию после матча.','Только post-event контент.'),
    sch(dayP1,'12:30','Instagram Stories','story','Результат + лучший момент','Продлить событие через результат и короткую историю.','Хвост после события.'),
    sch(dayP1,'19:00','Instagram','reel','Highlight Reel','Использовать смонтированные лучшие моменты, если они есть.','Другой формат, не дублирует карусель.'),
    sch(dayP2,'13:00','Instagram','carousel','Карусель лучших моментов','Показать матч как историю в слайдах.','Хвост после события.'),
    sch(dayP3,'19:00','Instagram Stories','story','Реакция / цитата игрока','Добавить человеческий слой и эмоции игроков.','Другой угол, не повторяет хайлайты.'),
    sch(dayP5,'19:00','Telegram','post','Storyline лиги','Связать матч с таблицей и сюжетной линией сезона.','Контекст лиги, можно использовать дольше.')
  ];
}
function sch(publish_date,publish_time,channel,format,title,purpose,overlap_check){return{publish_date,publish_time,channel,format,title,purpose,overlap_check,status:'Planned',owner:'PTF Media',notes:'Auto-added by lifecycle depth rules'};}
function fixPreEventAfterStart(items, event) {
  const start = `${event.date} ${event.time}`;
  return items.map((item) => {
    const t = `${item.publish_date} ${item.publish_time}`;
    const isPre = /announcement|reminder|cover|poster|teaser|countdown|анонс|напомин/i.test(`${item.title} ${item.purpose}`);
    if (item.publish_date === event.date && isPre && t > start) {
      return { ...item, publish_time: '16:00', overlap_check: `${item.overlap_check || ''} Adjusted before event start.`.trim() };
    }
    return item;
  });
}

function dedupeSchedule(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const title = normalizeTitle(item.title);
    const key = `${item.publish_date}|${item.publish_time}|${norm(item.channel)}|${norm(item.format)}|${title}`;
    const softKey = `${item.publish_date}|${norm(item.channel)}|${norm(item.format)}|${title}`;
    if (seen.has(key) || seen.has(softKey)) continue;
    seen.add(key);
    seen.add(softKey);
    result.push(localizeScheduleItem(item));
  }
  return result;
}

function normalizeTitle(title = '') {
  const t = norm(title);
  if (/main.*poster|главн.*постер/.test(t)) return 'main-poster';
  if (/countdown|отсч/.test(t)) return 'countdown';
  if (/match.*day.*reminder|напомин.*день/.test(t)) return 'matchday-reminder';
  if (/teaser|тизер/.test(t)) return 'teaser';
  if (/telegram.*announcement|short.*announcement|анонс/.test(t)) return 'announcement';
  if (/result|результ/.test(t)) return 'result';
  return t.replace(/[^a-zа-я0-9]+/gi, '-').slice(0, 40);
}

function localizeScheduleItem(item = {}) {
  return {
    ...item,
    title: ruTitle(item.title),
    purpose: ruPurpose(item.purpose),
    overlap_check: ruOverlap(item.overlap_check),
    status: item.status === 'Planned' ? 'Запланировано' : item.status
  };
}

function ruTitle(v='') {
  const t = String(v || '').toLowerCase();
  if (t.includes('main poster') || t.includes('main matchday poster')) return 'Главный матчевый постер';
  if (t.includes('teaser')) return 'Тизер-сторис';
  if (t.includes('short announcement')) return 'Короткий анонс';
  if (t.includes('player angle')) return 'Сторис с акцентом на игроков';
  if (t.includes('countdown')) return 'Сторис-отсчёт';
  if (t.includes('morning matchday')) return 'Утреннее напоминание';
  if (t.includes('match day reminder')) return 'Напоминание в день матча';
  if (t.includes('talking reminder')) return 'Talking story';
  if (t.includes('last call')) return 'Последний call перед матчем';
  if (t.includes('live story')) return 'Live Stories с матча';
  if (t.includes('live update')) return 'Live update в Telegram';
  if (t.includes('quick result')) return 'Быстрый результат';
  if (t.includes('highlight reel')) return 'Highlight Reel';
  if (t.includes('carousel')) return 'Карусель';
  return v || 'Публикация';
}
function ruPurpose(v='') {
  const s = String(v || '');
  if (!s || /^[A-Za-z0-9 ,.'’:-]+$/.test(s)) return 'Поддержать прогрев/освещение события без пересечения с другими форматами.';
  return s;
}
function ruOverlap(v='') {
  const s = String(v || '');
  if (!s) return 'Проверить пересечения перед публикацией.';
  if (/no conflict|different format|before event|post-event|story only|main feed/i.test(s)) return 'Ок: по смыслу не конфликтует с соседними публикациями.';
  return s;
}

function dedupeUserTasks(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.due_date}|${item.due_time}|${norm(item.task).slice(0,70)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => ({ ...item, task_type: ruTaskType(item.task_type), status: item.status === 'Planned' ? 'Запланировано' : item.status }));
}
function ruTaskType(v='') {
  const t = String(v || '').toLowerCase();
  if (t.includes('talking')) return 'Говорящее видео';
  if (t.includes('shoot')) return 'Съёмка';
  if (t.includes('ask')) return 'Вопрос игрокам';
  return v || 'Задача';
}

function mergeUserTasks(a,b){ const keys=new Set(a.map(x=>`${x.due_date}|${x.due_time}|${x.task_type}|${x.task}`)); return [...a, ...b.filter(x=>!keys.has(`${x.due_date}|${x.due_time}|${x.task_type}|${x.task}`))]; }
function mergeTail(a,b){ const keys=new Set(a.map(x=>`${x.day}|${x.idea}`)); return [...a, ...b.filter(x=>!keys.has(`${x.day}|${x.idea}`))]; }
function buildDefaultUserTasks(event){ const d=toDate(event.date); if(!d)return[]; const day0=fmt(d); return[
  {due_date:day0,due_time:'15:30',task_type:'Talking story',task:'Записать короткое говорящее Telegram/IG Story: кто играет, где, во сколько и почему матч интересен.',why_needed:'Создать живой прогрев перед матчем.',priority:'High',status:'Planned',owner:'Kostya',notes:'Можно записать на телефоне за 30-90 минут до матча.'},
  {due_date:day0,due_time:'16:30',task_type:'Shoot',task:'Снять атмосферу: корт, разминка, игроки до матча, 2-3 коротких вертикальных клипа.',why_needed:'Материал для live stories и post-event recap.',priority:'High',status:'Planned',owner:'Kostya',notes:'Вертикально, 5-10 секунд каждый клип.'},
  {due_date:day0,due_time:'after match',task_type:'Ask players',task:'Попросить 1 короткую фразу у победителя/обоих игроков: что было ключом матча?',why_needed:'Нужны человеческие quotes для Stories/Telegram/carousel.',priority:'Medium',status:'Planned',owner:'Kostya',notes:'Можно голосом или коротким видео.'}
]; }
function buildDefaultTail(event){ return[
  {day:'D+1',idea:'Result story + one best rally',channel:'Instagram Stories',format:'story sequence',needed_asset:'score/result + 1 rally clip',purpose:'Keep momentum after event'},
  {day:'D+1/D+2',idea:'Highlight Reel',channel:'Instagram',format:'reel',needed_asset:'edited highlight clip',purpose:'Public reach and proof of league quality'},
  {day:'D+2/D+3',idea:'Карусель лучших моментов',channel:'Instagram',format:'carousel',needed_asset:'poster/cover + 3-6 stills/clips',purpose:'Tell the match as a story'},
  {day:'D+3/D+5',idea:'Реакция / цитата игрока',channel:'Stories/Telegram',format:'quote/story',needed_asset:'player quote or voice',purpose:'Make players heroes'},
  {day:'D+4/D+7',idea:'League storyline / ranking impact',channel:'Telegram/Instagram Stories',format:'storyline update',needed_asset:'match log + standings',purpose:'Connect event to season narrative'}
]; }
