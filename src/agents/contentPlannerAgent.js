import { callJsonAgent } from '../services/openaiService.js';
import { contentPlannerSystemPrompt, contentPlannerSchema } from '../prompts/contentPlannerPrompt.js';

export async function planEventCampaign({ route, recentContent = [], runLogger }) {
  const user = JSON.stringify({ route, recentContent }, null, 2);
  const { parsed, raw, usage } = await callJsonAgent({
    system: contentPlannerSystemPrompt(),
    user,
    schemaName: 'ptf_content_plan',
    schema: contentPlannerSchema,
    temperature: 0.25,
    runLogger
  });
  return { plan: parsed, raw, usage };
}
