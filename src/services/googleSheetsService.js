import { google } from 'googleapis';
import { config } from '../config.js';
import { logger } from './logger.js';

let sheetsClient;

function getCredentials() {
  const raw = Buffer.from(config.googleServiceAccountBase64, 'base64').toString('utf8');
  return JSON.parse(raw);
}

export async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const credentials = getCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export async function appendRow(sheetName, values) {
  const sheets = await getSheetsClient();
  const range = `'${sheetName}'!A:Z`;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] }
  });
  logger.debug({ sheetName, updates: res.data.updates }, 'Appended row');
  return res.data;
}

export async function appendRows(sheetName, rows) {
  if (!rows.length) return null;
  const sheets = await getSheetsClient();
  const range = `'${sheetName}'!A:Z`;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows }
  });
  logger.debug({ sheetName, count: rows.length }, 'Appended rows');
  return res.data;
}

export async function readRange(sheetName, a1Range = 'A:Z') {
  const sheets = await getSheetsClient();
  const range = `'${sheetName}'!${a1Range}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range
  });
  return res.data.values || [];
}

export async function ensureSheetHeaders(headersMap) {
  const sheets = await getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: config.spreadsheetId });
  const existing = new Map(metadata.data.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const requests = [];
  Object.entries(headersMap).forEach(([title, headers], index) => {
    if (!existing.has(title)) {
      requests.push({ addSheet: { properties: { title, index: index + 1, gridProperties: { rowCount: 500, columnCount: Math.max(headers.length, 12) } } } });
    }
  });
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: config.spreadsheetId, requestBody: { requests } });
  }
  for (const [title, headers] of Object.entries(headersMap)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `'${title}'!A1:${columnLetter(headers.length)}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] }
    });
  }
}

function columnLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}
