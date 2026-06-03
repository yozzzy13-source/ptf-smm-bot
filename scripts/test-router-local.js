import 'dotenv/config';
import { routeUserMessage } from '../src/router/aiCommandRouter.js';
import { makeRunLogger } from '../src/services/logger.js';

const text = process.argv.slice(2).join(' ') || 'Сделай контент-план под матч Chris Mitchell vs Robin Vercaemer 6 июня в 17:00 на The Peak, Division PRIME. Нужны анонс, сторис и постер.';
const runLogger = makeRunLogger('LOCAL-TEST');
const result = await routeUserMessage({ text, runLogger });
console.log(JSON.stringify(result.route, null, 2));
