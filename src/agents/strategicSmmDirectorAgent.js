import { callJsonAgent } from '../services/openaiService.js';
import { config } from '../config.js';
import { strategicSmmDirectorSystemPrompt, strategicBriefSchema } from '../prompts/strategicSmmDirectorPrompt.js';
import { buildDynamicContextBlock } from '../services/contextMemoryService.js';

export async function buildStrategicBrief({ route, recentContent, recentPublished, recentEvents, publicationSchedule, matchLogSummary, partners = [], products = [], runLogger }) {
  const dynamicContext = await buildDynamicContextBlock(60);
  const user = JSON.stringify({ route, recentContent, recentPublished, recentEvents, publicationSchedule, matchLogSummary, partners, products }, null, 2);
  const { parsed, raw, usage } = await callJsonAgent({
    system: strategicSmmDirectorSystemPrompt(dynamicContext),
    user,
    schemaName: 'ptf_strategic_smm_brief',
    schema: strategicBriefSchema,
    temperature: 0.25,
    model: config.openaiStrategicModel,
    runLogger
  });
  return { strategicBrief: parsed, raw, usage };
}
