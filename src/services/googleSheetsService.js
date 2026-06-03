
import { google } from 'googleapis';
import { config } from '../config.js';
import { logger } from './logger.js';

let sheetsClient;
let externalClients = new Map();

function getCredentials() {
  let raw;
  try {
    raw = Buffer.from(config.googleServiceAccountBase64, 'base64').toString('utf8').trim();
  } catch (err) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_BASE64 decode failed: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_BASE64 is not a valid base64-encoded Google service account JSON. Re-encode the downloaded .json key file and paste it as one line.');
  }

  if (parsed.type !== 'service_account' || !parsed.client_email || !parsed.private_key) {
    throw new Error('Google credentials JSON is missing service_account fields: type/client_email/private_key. Make sure you encoded the downloaded Service Account key JSON.');
  }

  return parsed;
}

async function buildClient() {
  const credentials = getCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

export async function getSheetsClient(spreadsheetId = config.spreadsheetId) {
  if (spreadsheetId === config.spreadsheetId) {
    if (sheetsClient) return sheetsClient;
    sheetsClient = await buildClient();
    return sheetsClient;
  }
  if (externalClients.has(spreadsheetId)) return externalClients.get(spreadsheetId);
  const client = await buildClient();
  externalClients.set(spreadsheetId, client);
  return client;
}

async function withRetry(operation, label, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await operation();
    } catch (err) {
      lastErr = err;
      const status = err?.code || err?.response?.status;
      const retryable = status === 429 || status === 500 || status === 503;
      if (!retryable || i === attempts) break;
      const delay = 400 * i * i;
      logger.warn({ label, attempt: i, status, delay, err: err.message }, 'Google Sheets operation retry');
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

export async function appendRow(sheetName, values, spreadsheetId = config.spreadsheetId) {
  const sheets = await getSheetsClient(spreadsheetId);
  const range = `'${sheetName}'!A:Z`;
  const res = await withRetry(() => sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] }
  }), `appendRow:${sheetName}`);
  logger.debug({ sheetName, updates: res.data.updates }, 'Appended row');
  return res.data;
}

export async function appendRows(sheetName, rows, spreadsheetId = config.spreadsheetId) {
  if (!rows.length) return null;
  const sheets = await getSheetsClient(spreadsheetId);
  const range = `'${sheetName}'!A:Z`;
  const res = await withRetry(() => sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows }
  }), `appendRows:${sheetName}`);
  logger.debug({ sheetName, count: rows.length }, 'Appended rows');
  return res.data;
}

export async function readRange(sheetName, a1Range = 'A:Z', spreadsheetId = config.spreadsheetId) {
  const sheets = await getSheetsClient(spreadsheetId);
  const range = `'${sheetName}'!${a1Range}`;
  const res = await withRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  }), `readRange:${sheetName}!${a1Range}`);
  return res.data.values || [];
}

export async function ensureSheetHeaders(headersMap, spreadsheetId = config.spreadsheetId) {
  const sheets = await getSheetsClient(spreadsheetId);
  const metadata = await withRetry(() => sheets.spreadsheets.get({ spreadsheetId }), 'metadata');
  const existing = new Map(metadata.data.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const requests = [];

  Object.entries(headersMap).forEach(([title, headers], index) => {
    if (!existing.has(title)) {
      requests.push({
        addSheet: {
          properties: {
            title,
            index: index + 1,
            gridProperties: { rowCount: 500, columnCount: Math.max(headers.length, 12), frozenRowCount: 1 }
          }
        }
      });
    }
  });

  if (requests.length) {
    await withRetry(() => sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } }), 'batchUpdate:addSheets');
  }

  for (const [title, headers] of Object.entries(headersMap)) {
    await withRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A1:${columnLetter(headers.length)}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] }
    }), `headers:${title}`);
  }
}

function columnLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m - 1) / 26);
  }
  return s;
}
