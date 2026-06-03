
import { callJsonAgent } from '../services/openaiService.js';
import { routerSystemPrompt, routerJsonSchema } from '../prompts/routerPrompt.js';
import { config } from '../config.js';
import { buildDynamicContextBlock } from '../services/contextMemoryService.js';

export async function routeUserMessage({ text, runLogger }) {
  const dynamicContext = await buildDynamicContextBlock();
  const user = `User Telegram message:
${text}

Current date context: use Asia/Bangkok timezone. If date is vague, keep it as user wrote and ask clarification only if critical.`;
  const { parsed, raw, usage } = await callJsonAgent({
    system: routerSystemPrompt(dynamicContext),
    user,
    schemaName: 'ptf_router_output',
    schema: routerJsonSchema,
    temperature: 0.1,
    model: config.openaiRouterModel,
    runLogger
  });
  return { route: parsed, raw, usage };
}
