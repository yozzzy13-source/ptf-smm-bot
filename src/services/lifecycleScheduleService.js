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
  return { ...plan, publication_schedule: fixPreEventAfterStart(sorted, event), user_action_tasks: mergeUserTasks(plan.user_action_tasks || [], buildDefaultUserTasks(event)), post_event_tail: mergeTail(plan.post_event_tail || [], buildDefaultTail(event)) };
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
    sch(dayM2,'12:30','Instagram Stories','story','Teaser story','Start warm-up and announce that a PRIME match is coming.','No conflict: light teaser, not same as main poster.'),
    sch(dayM2,'19:00','Telegram','post','Short announcement','Tell internal community when/where to watch and why it matters.','No conflict: Telegram internal channel.'),
    sch(dayM1,'12:30','Instagram Stories','story','Player angle story','Show one player/community angle before the match.','Different format from announcement.'),
    sch(dayM1,'18:30','Instagram','post','Main match poster','Main public announcement with image/poster.','Main feed post, should not collide with Reel.'),
    sch(day0,'10:30','Instagram Stories','story','Match day reminder','Remind audience in the morning.','Story only, light touch.'),
    sch(day0,'14:00','Telegram','post','Match day reminder','Reminder for league community before event starts.','Before event start.'),
    sch(day0,'16:00','Telegram Stories','user task','Talking story reminder','User records short talking story before match.','User task, not a regular post.'),
    sch(day0,'16:30','Instagram Stories','story','Countdown story','Final reminder before first ball.','Before event start.'),
    sch(day0,'19:30','Telegram','post','Quick result update','Post result/first reaction after match.','Post-event content only.'),
    sch(dayP1,'12:30','Instagram Stories','story','Result + best moment','Keep the event alive with quick result/story.','Post-event tail.'),
    sch(dayP1,'19:00','Instagram','reel','Highlight reel','Use edited best moments if available.','Different format from carousel.'),
    sch(dayP2,'13:00','Instagram','carousel','Best moments carousel','Show match as a story in slides.','Post-event content tail.'),
    sch(dayP3,'19:00','Instagram Stories','story','Player reaction / quote','Humanize players and community.','Different angle from highlights.'),
    sch(dayP5,'19:00','Telegram','post','League storyline update','Connect match to standings/season storyline.','Evergreen/league context.')
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
  {day:'D+2/D+3',idea:'Best moments carousel',channel:'Instagram',format:'carousel',needed_asset:'poster/cover + 3-6 stills/clips',purpose:'Tell the match as a story'},
  {day:'D+3/D+5',idea:'Player reaction / quote',channel:'Stories/Telegram',format:'quote/story',needed_asset:'player quote or voice',purpose:'Make players heroes'},
  {day:'D+4/D+7',idea:'League storyline / ranking impact',channel:'Telegram/Instagram Stories',format:'storyline update',needed_asset:'match log + standings',purpose:'Connect event to season narrative'}
]; }
