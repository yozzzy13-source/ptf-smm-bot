import 'dotenv/config';
import { ensureSheetHeaders } from '../src/services/googleSheetsService.js';
import { HEADERS } from '../src/schemas/sheetSchema.js';

await ensureSheetHeaders(HEADERS);
console.log('✅ PTF SMM OS sheet structure ensured.');
