import { callJsonAgent } from '../services/openaiService.js';
import { routerSystemPrompt, routerJsonSchema } from '../prompts/routerPrompt.js';
import { config } from '../config.js';
import { buildDynamicContextBlock } from '../services/contextMemoryService.js';

export async function routeUserMessage({ text, runLogger, conversationContext = {} }) {
  const dynamicContext = await buildDynamicContextBlock(60);
  const now = new Date();
  const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const bangkokTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const user = JSON.stringify({ user_message: text, current_date_bangkok: bangkokDate, current_time_bangkok: bangkokTime, conversationContext }, null, 2);
  const { parsed, raw, usage } = await callJsonAgent({ system: routerSystemPrompt(dynamicContext), user, schemaName: 'ptf_router_output', schema: routerJsonSchema, temperature: 0.1, model: config.openaiRouterModel, runLogger });
  return { route: parsed, raw, usage };
}
