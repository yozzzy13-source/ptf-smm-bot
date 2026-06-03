import { callJsonAgent } from '../services/openaiService.js';
import { routerSystemPrompt, routerJsonSchema } from '../prompts/routerPrompt.js';
import { config } from '../config.js';
import { buildDynamicContextBlock } from '../services/contextMemoryService.js';
import { bangkokDateContext } from '../utils/dateUtils.js';
export async function routeUserMessage({ text, runLogger, conversationContext = {} }) { const dynamicContext = await buildDynamicContextBlock(); const user = JSON.stringify({ telegram_message:text, current_date_context:{ timezone:'Asia/Bangkok', ...bangkokDateContext(), instruction:'Resolve relative dates using this context. If day/month has no year, use current year.'}, recent_event_context: conversationContext.recentEvents || [] }, null, 2); const { parsed, raw, usage } = await callJsonAgent({ system: routerSystemPrompt(dynamicContext), user, schemaName:'ptf_router_output', schema:routerJsonSchema, temperature:0.1, model:config.openaiRouterModel, runLogger }); return { route: parsed, raw, usage }; }
