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
  return { uploaded: true, fileId: res.data.id, name: res.data.name, webViewLink: res.data.webViewLink, webContentLink: res.data.webContentLink };
}
