import { config } from '../config.js';
import { listFilesInFolder } from './googleDriveService.js';
import { appendRows, readRange } from './googleSheetsService.js';
import { SHEETS } from '../schemas/sheetSchema.js';
import { nowIso, shortId } from '../utils/idUtils.js';
import { logger } from './logger.js';

export async function scanMediaOs({ maxFiles = config.mediaScanMaxFiles } = {}) {
  const folderRows = await safeRead(SHEETS.mediaFolderMap, 'A2:K2500');
  if (!folderRows.length) return { ok:false, message:'Media Folder Map пуст. Сначала выполни /bootstrap_media_os.' };
  const scannedRows = await safeRead(SHEETS.mediaScanLog, 'A2:M5000');
  const seenFileIds = new Set(scannedRows.map((r)=>r[2]).filter(Boolean));
  const folders = folderRows
    .map((r)=>({ key:r[0], name:r[1], id:r[2], path:r[5], purpose:r[6] }))
    .filter((f)=>f.id && isScannablePath(f.path));
  const scanLogRows = [];
  const assetRows = [];
  let scannedFolders = 0;
  let foundFiles = 0;
  for (const folder of folders) {
    if (foundFiles >= maxFiles) break;
    let files = [];
    try { files = await listFilesInFolder({ folderId:folder.id, pageSize:50 }); } catch(err){ logger.warn({err:err.message, folder}, 'Media scan folder failed'); continue; }
    scannedFolders += 1;
    for (const file of files) {
      if (foundFiles >= maxFiles) break;
      if (file.mimeType === 'application/vnd.google-apps.folder') continue;
      if (seenFileIds.has(file.id)) continue;
      const detection = detectMedia({ file, folder });
      scanLogRows.push([shortId('MSC'), nowIso(), file.id, file.name, file.mimeType, folder.id, folder.path, detection.detectedType, detection.relatedEventId, detection.relatedPlayers.join(', '), 'New', file.webViewLink || '', detection.notes]);
      assetRows.push([shortId('AST'), detection.assetType, detection.relatedPlayers.join(', '), detection.relatedEventId, '', file.webViewLink || '', '', detection.usability, '', 'Uploaded / Need Review', detection.bestFor, '', 'Assume OK until reviewed', detection.notes, 'Google Drive Scanner', nowIso()]);
      foundFiles += 1;
    }
  }
  if (scanLogRows.length) await appendRows(SHEETS.mediaScanLog, scanLogRows);
  if (assetRows.length) await appendRows(SHEETS.assetsLibrary, assetRows);
  return { ok:true, scannedFolders, newFiles: scanLogRows.length, assetsCreated: assetRows.length, maxFiles };
}

function isScannablePath(path='') {
  return /Raw_Media|Selected_Media|References|Ready_To_Publish|Published|03_Players|99_Inbox|10_References|01_Brand|05_Sponsors/i.test(path);
}

function detectMedia({ file, folder }) {
  const path = folder.path || '';
  const name = file.name || '';
  const mime = file.mimeType || '';
  const isVideo = mime.startsWith('video/') || /\.(mp4|mov|m4v|avi|webm)$/i.test(name);
  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/i.test(name);
  const isAudio = mime.startsWith('audio/') || /\.(mp3|wav|m4a)$/i.test(name);
  let detectedType = isVideo ? 'Video' : isImage ? 'Image' : isAudio ? 'Voice / Audio' : 'File';
  if (/Poster_Style_References|Style_References/i.test(path)) detectedType = 'Style Reference';
  if (/Player_References|03_Players.*Photos|02_Photos/i.test(path)) detectedType = isVideo ? 'Player Video Reference' : 'Player Photo Reference';
  if (/Logos|Logo_References/i.test(path)) detectedType = 'Logo / Brand Asset';
  if (/Raw_Media.*Videos/i.test(path)) detectedType = 'Campaign Raw Video';
  if (/Generated_Visuals|AI_Generated/i.test(path)) detectedType = 'Generated Visual';
  if (/Ready_To_Publish/i.test(path)) detectedType = 'Ready To Publish Asset';
  if (/Published/i.test(path)) detectedType = 'Published Asset';

  const eventMatch = path.match(/02_Campaigns\/Active\/([^/]+)/);
  const relatedEventId = eventMatch ? eventMatch[1] : '';
  const relatedPlayers = playersFromPath(path);
  return {
    detectedType,
    assetType: detectedType,
    relatedEventId,
    relatedPlayers,
    usability: /Ready_To_Publish|Approved|Selected/i.test(path) ? 'High' : 'Need Review',
    bestFor: bestFor(detectedType, path),
    notes: buildNotes({ detectedType, path, relatedEventId, relatedPlayers })
  };
}

function playersFromPath(path='') {
  const players = [];
  if (/Robin/i.test(path)) players.push('Robin Vercaemer');
  if (/Chris/i.test(path)) players.push('Chris Mitchell');
  const event = path.match(/(Robin|Chris).*vs.*(Robin|Chris)|(Robin).*_(?:vs)_(Chris)/i);
  if (event) {
    if (!players.includes('Robin Vercaemer')) players.push('Robin Vercaemer');
    if (!players.includes('Chris Mitchell')) players.push('Chris Mitchell');
  }
  return players;
}

function bestFor(type, path) {
  if (/Campaign Raw Video|Player Video/i.test(type)) return 'Stories / Reels / highlight recap / player content';
  if (/Style Reference/i.test(type)) return 'Visual generation style reference';
  if (/Logo/i.test(type)) return 'Poster / cover / sponsor placement';
  if (/Player Photo/i.test(type)) return 'Player reference / poster / card';
  if (/Ready/i.test(type)) return 'Publishing';
  return 'Review and classify';
}

function buildNotes({ detectedType, path, relatedEventId, relatedPlayers }) {
  const parts = [`Detected as ${detectedType}`, `Path: ${path}`];
  if (relatedEventId) parts.push(`Event/campaign: ${relatedEventId}`);
  if (relatedPlayers.length) parts.push(`Players: ${relatedPlayers.join(', ')}`);
  if (/Raw_Media\/Videos/i.test(path)) parts.push('Do not duplicate this video into player folders; bot binds event video to participating players.');
  return parts.join(' | ');
}

async function safeRead(sheet, range) { try { return await readRange(sheet, range); } catch(err){ logger.warn({err:err.message, sheet}, 'Media scanner read failed'); return []; } }
