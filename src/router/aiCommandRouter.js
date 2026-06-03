import { callJsonAgent } from '../services/openaiService.js';
import { routerSystemPrompt, routerJsonSchema } from '../prompts/routerPrompt.js';

export async function routeUserMessage({ text, runLogger }) {
  const user = `User Telegram message:\n${text}\n\nCurrent date context: use Asia/Bangkok timezone. If date is vague, keep it as user wrote and ask clarification only if critical.`;
  const { parsed, raw, usage } = await callJsonAgent({
    system: routerSystemPrompt(),
    user,
    schemaName: 'ptf_router_output',
    schema: routerJsonSchema,
    temperature: 0.1,
    runLogger
  });
  return { route: parsed, raw, usage };
}
