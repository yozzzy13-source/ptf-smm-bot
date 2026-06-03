
import { callJsonAgent } from '../services/openaiService.js';
import { config } from '../config.js';
import { contentPlannerSystemPrompt, contentPlannerSchema } from '../prompts/contentPlannerPrompt.js';
import { buildDynamicContextBlock } from '../services/contextMemoryService.js';

export async function planEventCampaign({ route, recentContent = [], runLogger }) {
  const dynamicContext = await buildDynamicContextBlock();
  const user = JSON.stringify({ route, recentContent }, null, 2);
  const { parsed, raw, usage } = await callJsonAgent({
    system: contentPlannerSystemPrompt(dynamicContext),
    user,
    schemaName: 'ptf_content_plan',
    schema: contentPlannerSchema,
    temperature: 0.25,
    model: config.openaiCreativeModel,
    runLogger
  });
  return { plan: parsed, raw, usage };
}
