import { config } from '../config.js';
import { createFolderIfMissing, upsertTextFile } from './googleDriveService.js';
import { appendRows, readRange } from './googleSheetsService.js';
import { SHEETS } from '../schemas/sheetSchema.js';
import { shortId } from '../utils/idUtils.js';
import { nowIso } from '../utils/dateUtils.js';
import { logger } from './logger.js';

const ROOT_FOLDERS = [
  ['00_System','Служебные файлы, карты папок, логи импорта/экспорта'],
  ['01_Brand','Логотипы, цвета, брендовые материалы PTF'],
  ['02_Campaigns','Все кампании: матчи, турниры, рекапы, партнёрские активации'],
  ['03_Players','Материалы по игрокам: фото, видео, voice, карточки'],
  ['04_League','Сезоны, дивизионы, standings, match logs, рекапы'],
  ['05_Sponsors_Partners','Партнёры, спонсоры, логотипы, интеграции'],
  ['06_Products_Ecosystem','Продукты PTF: лига, турниры, тренировки, booking bot'],
  ['07_Content_Production','Рабочая зона: рилсы, сторис, карусели, посты в работе'],
  ['08_Ready_To_Publish','Финальные материалы по каналам, готовые к публикации'],
  ['09_Published_Archive','Архив опубликованного контента'],
  ['10_References','Общие стилевые, медиа и визуальные референсы'],
  ['11_Templates_Prompts','Шаблоны, промпты, caption templates, hashtags'],
  ['12_AI_Generated','Все AI-generated материалы'],
  ['13_Website_Assets','Материалы для сайта PTF'],
  ['14_Admin','Отчёты, планирование, внутренние заметки'],
  ['99_Inbox','Временная папка для неразобранного контента']
];

const TREE = {
  '00_System': ['Folder_Maps','Import_Logs','Export_Logs','Temp'],
  '01_Brand': ['01_Logos','02_Division_Assets','03_Brand_Guidelines','04_Colors_Fonts','05_Intro_Explainers'],
  '02_Campaigns': ['Active','Archived','Templates'],
  '03_Players': ['Robin_Vercaemer','Chris_Mitchell','_New_Players_Template'],
  '04_League': ['Seasons','Rankings','Activity_Points','Regulations_Explainers'],
  '04_League/Seasons': ['Season_1'],
  '04_League/Seasons/Season_1': ['Divisions','Standings','Match_Logs','Results_Cards','Weekly_Recaps','Monthly_Recaps','Finals'],
  '05_Sponsors_Partners': ['The_Peak_Racquet_Park','Future_Sponsors'],
  '05_Sponsors_Partners/The_Peak_Racquet_Park': ['Logos','Photos','Banners','Mentions','Approved_Integrations'],
  '06_Products_Ecosystem': ['League','Tournaments','Trainings','Booking_Bot','Membership','Weekly_Programs','Explainers'],
  '07_Content_Production': ['Reels_In_Progress','Stories_In_Progress','Carousels_In_Progress','Telegram_Posts_In_Progress','YouTube_Shorts_In_Progress'],
  '08_Ready_To_Publish': ['Instagram','Telegram','YouTube','Website'],
  '08_Ready_To_Publish/Instagram': ['Feed','Stories','Reels'],
  '08_Ready_To_Publish/Telegram': ['Posts','Stories'],
  '08_Ready_To_Publish/YouTube': ['Shorts','Longform'],
  '09_Published_Archive': ['Instagram','Telegram','YouTube','Website'],
  '09_Published_Archive/Instagram': ['Feed','Stories','Reels'],
  '09_Published_Archive/Telegram': ['Posts','Stories'],
  '09_Published_Archive/YouTube': ['Shorts','Longform'],
  '10_References': ['Poster_Style_References','Reel_Style_References','Story_Style_References','Tennis_Media_References','Community_References','Sponsor_References','Venue_References'],
  '11_Templates_Prompts': ['Poster_Prompts','Story_Prompts','Reel_Prompts','Caption_Templates','Hashtag_Bases','CTA_Templates','Negative_Prompts','Approved_Prompt_Packs'],
  '12_AI_Generated': ['Images','Captions','Schedules','Posters','Story_Cards','Reel_Covers'],
  '13_Website_Assets': ['Homepage','Events','Player_Cards','League_Pages','Banners','Explainer_Videos'],
  '14_Admin': ['Reports','Metrics','Planning','Internal_Notes'],
  '99_Inbox': ['From_Phone','From_Editor','Unsorted','To_Classify']
};

const PLAYER_SUBFOLDERS = ['01_Profile','02_Photos','03_Videos','04_Portraits','05_Voice','06_Player_Cards','07_Approved_Assets'];
const CAMPAIGN_SUBFOLDERS = ['01_Brief','02_References','03_Raw_Media','04_Selected_Media','05_Drafts','06_Generated_Visuals','07_Approved','08_Ready_To_Publish','09_Published','10_Post_Event'];
const CAMPAIGN_REFERENCE_SUBFOLDERS = ['Player_References','Style_References','Logo_References','Venue_References','Sponsor_References'];
const CAMPAIGN_RAW_SUBFOLDERS = ['Photos','Videos','Voice'];
const CAMPAIGN_GENERATED_SUBFOLDERS = ['Main_Posters','Story_Posters','Telegram_Covers','Result_Cards','Carousel_Covers','Reel_Covers'];

export async function bootstrapMediaOs({ rootFolderId = config.mediaOsRootFolderId, createCurrentCampaign = true } = {}) {
  if (!rootFolderId) return { ok:false, message:'PTF_MEDIA_OS_ROOT_FOLDER_ID is empty. Укажи ID корневой Drive-папки.' };
  const map = new Map([['ROOT', { id: rootFolderId, path: '' }]]);
  const folderRows = [];
  let created = 0;

  for (const [name, purpose] of ROOT_FOLDERS) {
    const f = await createFolderIfMissing({ name, parentId: rootFolderId });
    map.set(name, { id: f.id, path: name });
    folderRows.push(rowFor(name, name, f.id, 'ROOT', rootFolderId, name, purpose, f.created));
    if (f.created) created += 1;
  }
  for (const [parentPath, children] of Object.entries(TREE)) {
    const parent = map.get(parentPath);
    if (!parent) continue;
    for (const child of children) {
      const fullPath = `${parentPath}/${child}`;
      const f = await createFolderIfMissing({ name: child, parentId: parent.id });
      map.set(fullPath, { id: f.id, path: fullPath });
      folderRows.push(rowFor(fullPath, child, f.id, parentPath, parent.id, fullPath, purposeForPath(fullPath), f.created));
      if (f.created) created += 1;
    }
  }

  // Player starter folders
  for (const player of ['Robin_Vercaemer','Chris_Mitchell','_New_Players_Template']) {
    const base = map.get(`03_Players/${player}`);
    if (!base) continue;
    for (const child of PLAYER_SUBFOLDERS) {
      const fullPath = `03_Players/${player}/${child}`;
      const f = await createFolderIfMissing({ name: child, parentId: base.id });
      map.set(fullPath, { id:f.id, path:fullPath });
      folderRows.push(rowFor(fullPath, child, f.id, `03_Players/${player}`, base.id, fullPath, purposeForPath(fullPath), f.created));
      if (f.created) created += 1;
    }
  }

  // Current campaign starter folder
  let campaignFolder = null;
  if (createCurrentCampaign) {
    campaignFolder = await createCampaignFolderTree({ campaignName:'2026-06-06_PRIME_Robin_vs_Chris', rootMap:map, appendToMap:false });
    for (const r of campaignFolder.folderRows || []) folderRows.push(r);
    created += campaignFolder.created || 0;
  }

  const readmeFolder = map.get('00_System') || map.get('ROOT');
  const readme = await upsertTextFile({ name:'README_RU.md', text: mediaOsReadme(), parentId: readmeFolder.id, mimeType:'text/markdown' });
  folderRows.push(rowFor('00_System/README_RU.md','README_RU.md',readme.id,'00_System',readmeFolder.id,'00_System/README_RU.md','Русская инструкция: куда складывать материалы',readme.created));

  await syncFolderRows(folderRows);
  await seedReadmeSheet();
  return { ok:true, rootFolderId, created, mapped: folderRows.length, readmeLink: readme.webViewLink || '', campaignFolderId: campaignFolder?.campaignFolderId || '' };
}

export async function createCampaignFolderTree({ campaignName, relatedEventId = '', rootMap = null, appendToMap = true } = {}) {
  const active = rootMap?.get('02_Campaigns/Active') || await findMappedFolder('02_Campaigns/Active');
  if (!active?.id) return { ok:false, message:'Не найдена папка 02_Campaigns/Active. Сначала выполни /bootstrap_media_os.' };
  const folderRows = [];
  let created = 0;
  const campaign = await createFolderIfMissing({ name:campaignName, parentId:active.id });
  const campaignPath = `02_Campaigns/Active/${campaignName}`;
  folderRows.push(rowFor(campaignPath,campaignName,campaign.id,'02_Campaigns/Active',active.id,campaignPath,'Папка конкретной кампании / события',campaign.created));
  if (campaign.created) created += 1;
  const localMap = new Map([[campaignPath,{ id:campaign.id, path:campaignPath }]]);
  for (const child of CAMPAIGN_SUBFOLDERS) {
    const p = await createFolderIfMissing({ name:child, parentId:campaign.id });
    const path = `${campaignPath}/${child}`;
    localMap.set(path,{ id:p.id, path });
    folderRows.push(rowFor(path, child, p.id, campaignPath, campaign.id, path, purposeForPath(path), p.created));
    if (p.created) created += 1;
  }
  for (const child of CAMPAIGN_REFERENCE_SUBFOLDERS) {
    const parent = localMap.get(`${campaignPath}/02_References`);
    const p = await createFolderIfMissing({ name:child, parentId:parent.id });
    const path = `${campaignPath}/02_References/${child}`;
    folderRows.push(rowFor(path, child, p.id, `${campaignPath}/02_References`, parent.id, path, purposeForPath(path), p.created));
    if (p.created) created += 1;
  }
  for (const child of CAMPAIGN_RAW_SUBFOLDERS) {
    const parent = localMap.get(`${campaignPath}/03_Raw_Media`);
    const p = await createFolderIfMissing({ name:child, parentId:parent.id });
    const path = `${campaignPath}/03_Raw_Media/${child}`;
    folderRows.push(rowFor(path, child, p.id, `${campaignPath}/03_Raw_Media`, parent.id, path, purposeForPath(path), p.created));
    if (p.created) created += 1;
  }
  for (const child of CAMPAIGN_GENERATED_SUBFOLDERS) {
    const parent = localMap.get(`${campaignPath}/06_Generated_Visuals`);
    const p = await createFolderIfMissing({ name:child, parentId:parent.id });
    const path = `${campaignPath}/06_Generated_Visuals/${child}`;
    folderRows.push(rowFor(path, child, p.id, `${campaignPath}/06_Generated_Visuals`, parent.id, path, purposeForPath(path), p.created));
    if (p.created) created += 1;
  }
  if (appendToMap) await syncFolderRows(folderRows);
  try { await appendRows(SHEETS.campaignFolderMap, [[relatedEventId || shortId('CMPF'), relatedEventId, campaignName, campaign.id, campaignPath, 'Active', nowIso(), nowIso(), 'Created/ensured by bootstrap']]); } catch(err){ logger.warn({err:err.message}, 'Campaign folder map write failed'); }
  return { ok:true, campaignFolderId: campaign.id, campaignPath, created, folderRows };
}

async function syncFolderRows(rows) {
  if (!rows.length) return;
  let existing = [];
  try { existing = await readRange(SHEETS.mediaFolderMap, 'A2:K2000'); } catch {}
  const existingIds = new Set(existing.map((r)=>r[2]).filter(Boolean));
  const newRows = rows.filter((r)=>!existingIds.has(r[2]));
  if (newRows.length) await appendRows(SHEETS.mediaFolderMap, newRows);
}

async function findMappedFolder(path) {
  try {
    const rows = await readRange(SHEETS.mediaFolderMap, 'A2:K2000');
    const row = rows.find((r)=>r[5] === path || r[0] === path);
    return row ? { key:row[0], name:row[1], id:row[2], parentKey:row[3], parentId:row[4], path:row[5] } : null;
  } catch { return null; }
}

function rowFor(key,name,id,parentKey,parentId,path,purpose,created) {
  return [key,name,id,parentKey,parentId,path,purpose,created ? 'Created' : 'Exists',nowIso(),nowIso(),created ? 'Created by bot' : 'Already existed'];
}

function purposeForPath(path='') {
  if (path.includes('Raw_Media/Videos')) return 'Сырой видеоконтент кампании: матч, розыгрыши, атмосфера, реакции. Не дублировать в папки игроков.';
  if (path.includes('03_Players') && path.includes('03_Videos')) return 'Видео игрока, не привязанное к конкретному событию.';
  if (path.includes('References')) return 'Референсы: игроки, стиль, логотипы, площадка, партнёры.';
  if (path.includes('Generated_Visuals')) return 'Сгенерированные визуалы по кампании.';
  if (path.includes('Ready_To_Publish')) return 'Финальные материалы, готовые к публикации.';
  if (path.includes('Published')) return 'Уже опубликованные материалы.';
  if (path.includes('Inbox')) return 'Временная зона для неразобранного контента.';
  return 'Media OS folder';
}

async function seedReadmeSheet() {
  try {
    const existing = await readRange(SHEETS.mediaOsReadme, 'A2:D50');
    if (existing.length) return;
    await appendRows(SHEETS.mediaOsReadme, [
      ['Главное','Не дублировать видео','Если видео относится к матчу/событию, клади его в папку кампании. Бот свяжет этот файл и с событием, и с обоими игроками через таблицы Asset Binding / Media Scan Log. Не нужно копировать один и тот же файл в папки игроков.',nowIso()],
      ['Главное','Если видео про игрока без события','Клади в 03_Players/<Player>/03_Videos. Это evergreen/player-profile материал.',nowIso()],
      ['Главное','Если непонятно куда','Клади в 99_Inbox. Позже бот сможет классифицировать и предложить место.',nowIso()],
      ['Генерация','AI visual outputs','Сгенерированные постеры и обложки сохраняются в 12_AI_Generated и/или в папку конкретной кампании 06_Generated_Visuals.',nowIso()]
    ]);
  } catch(err){ logger.warn({err:err.message}, 'README sheet seed failed'); }
}

export function mediaOsReadme() {
  return `# Phuket Tennis Family — Media OS\n\nЭта папка — основная медиасистема PTF для SMM, визуалов, видео, кампаний, сайта и контент-производства.\n\n## Главное правило\nЕсли материал относится к конкретному событию, клади его в папку события. Если материал общий по игроку — клади его в папку игрока. Если не уверен — клади в 99_Inbox.\n\n## Очень важно про видео матча\nЕсли видео снято на матче Robin vs Chris, его НЕ нужно копировать в папку Robin и в папку Chris. Клади один оригинальный файл в папку кампании:\n\n02_Campaigns/Active/<кампания>/03_Raw_Media/Videos\n\nБот будет понимать связь так:\n- файл лежит в кампании Robin vs Chris;\n- в кампании участвуют Robin и Chris;\n- значит этот файл может использоваться и для события, и для контента каждого игрока.\n\nТак мы избегаем дублей и хаоса.\n\n## Куда что класть\n\n### Новое видео с конкретного матча\n02_Campaigns/Active/<кампания>/03_Raw_Media/Videos\n\n### Фото игроков для конкретной кампании\n02_Campaigns/Active/<кампания>/02_References/Player_References\n\n### Общие фото игрока без конкретного события\n03_Players/<игрок>/02_Photos\n\n### Видео игрока без конкретного события\n03_Players/<игрок>/03_Videos\n\n### Готовые стилевые постеры / референсы\n10_References/Poster_Style_References\n\n### Логотипы\n01_Brand/01_Logos или 05_Sponsors_Partners/<партнёр>/Logos\n\n### Готовые материалы к публикации\n08_Ready_To_Publish/<канал>\n\n### Уже опубликованное\n09_Published_Archive/<канал>\n\n### Непонятно куда\n99_Inbox\n\n## Рабочий поток\n1. Raw media → сырой контент.\n2. Selected media → отобранное.\n3. Drafts → тексты, промпты, план.\n4. Generated visuals → AI-визуалы.\n5. Approved → утверждённое.\n6. Ready to publish → готовое к публикации.\n7. Published → опубликованное.\n\n## Логика бота\nБот должен не копировать файлы между папками, а индексировать один файл и связывать его с кампанией, игроками, каналами и будущими публикациями через таблицы.\n`;
}
