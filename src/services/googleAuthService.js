import { google } from 'googleapis';
import { config } from '../config.js';

let credentialsCache;
let authCache;

export function getGoogleCredentials() {
  if (credentialsCache) return credentialsCache;
  let raw;
  try {
    raw = Buffer.from(config.googleServiceAccountBase64, 'base64').toString('utf8').trim();
  } catch (err) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_BASE64 decode failed: ${err.message}`);
  }
  try {
    credentialsCache = JSON.parse(raw);
  } catch (err) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_BASE64 is not a valid base64-encoded Google service account JSON. Re-encode the downloaded .json key file and paste it as one line.');
  }
  if (credentialsCache.type !== 'service_account' || !credentialsCache.client_email || !credentialsCache.private_key) {
    throw new Error('Google credentials JSON is missing service_account fields: type/client_email/private_key.');
  }
  return credentialsCache;
}

export function getGoogleAuth() {
  if (authCache) return authCache;
  const credentials = getGoogleCredentials();
  authCache = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
  return authCache;
}
