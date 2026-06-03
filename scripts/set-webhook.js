import 'dotenv/config';
import { setWebhook } from '../src/services/telegramService.js';

const result = await setWebhook();
console.log(JSON.stringify(result, null, 2));
