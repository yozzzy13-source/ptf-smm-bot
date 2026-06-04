import { google } from 'googleapis';
import { config } from '../config.js';
import { getGoogleAuth } from './googleAuthService.js';
import { logger } from './logger.js';
import { Readable } from 'stream';

let driveClient;
function getDriveClient() {
  if (driveClient) return driveClient;
  driveClient = google.drive({ version: 'v3', auth: getGoogleAuth() });
  return driveClient;
}

export async function uploadBufferToDrive({ buffer, filename, mimeType = 'image/png', folderId = config.googleDriveMediaRootFolderId }) {
  if (!folderId) return { uploaded: false, reason: 'GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID is empty' };
  const drive = getDriveClient();
  const media = { mimeType, body: Readable.from(buffer) };
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media,
    fields: 'id,name,webViewLink,webContentLink'
  });
  try {
    await drive.permissions.create({ fileId: res.data.id, requestBody: { role: 'reader', type: 'anyone' } });
  } catch (err) {
    logger.warn({ err: err.message, fileId: res.data.id }, 'Could not make generated image publicly readable');
  }
  const directImageUrl = `https://drive.google.com/uc?export=view&id=${res.data.id}`;
  return { uploaded: true, fileId: res.data.id, name: res.data.name, webViewLink: res.data.webViewLink, webContentLink: res.data.webContentLink, directImageUrl };
}

export async function createFolderIfMissing({ name, parentId }) {
  if (!parentId) throw new Error('createFolderIfMissing requires parentId');
  const drive = getDriveClient();
  const escapedName = String(name).replace(/'/g, "\\'");
  const q = `'${parentId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const found = await drive.files.list({ q, fields: 'files(id,name,webViewLink)', spaces: 'drive', pageSize: 10 });
  if (found.data.files?.length) return { ...found.data.files[0], created: false };
  const res = await drive.files.create({ requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id,name,webViewLink' });
  return { ...res.data, created: true };
}

export async function upsertTextFile({ name, text, parentId, mimeType = 'text/markdown' }) {
  if (!parentId) throw new Error('upsertTextFile requires parentId');
  const drive = getDriveClient();
  const escapedName = String(name).replace(/'/g, "\\'");
  const q = `'${parentId}' in parents and name = '${escapedName}' and trashed = false`;
  const found = await drive.files.list({ q, fields: 'files(id,name,webViewLink)', spaces: 'drive', pageSize: 10 });
  const media = { mimeType, body: Readable.from(Buffer.from(text, 'utf8')) };
  if (found.data.files?.length) {
    const file = found.data.files[0];
    const res = await drive.files.update({ fileId: file.id, media, fields: 'id,name,webViewLink' });
    return { ...res.data, updated: true, created: false };
  }
  const res = await drive.files.create({ requestBody: { name, parents: [parentId] }, media, fields: 'id,name,webViewLink' });
  return { ...res.data, created: true, updated: false };
}

export async function listFilesInFolder({ folderId, pageSize = 100 }) {
  if (!folderId) return [];
  const drive = getDriveClient();
  const files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,webViewLink,createdTime,modifiedTime,parents,size)',
      spaces: 'drive',
      pageSize,
      pageToken
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken && files.length < pageSize);
  return files.slice(0, pageSize);
}

export async function listFoldersInFolder({ folderId, pageSize = 200 }) {
  const files = await listFilesInFolder({ folderId, pageSize });
  return files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
}
