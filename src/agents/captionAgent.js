import { callJsonAgent } from '../services/openaiService.js';
import { config } from '../config.js';
import { captionSystemPrompt, captionSchema } from '../prompts/captionPrompt.js';
import { buildDynamicContextBlock } from '../services/contextMemoryService.js';

export async function generateDrafts({ event, tasks, strategicBrief = null, feedbackRules = [], runLogger }) {
  const dynamicContext = await buildDynamicContextBlock(60);
  const user = JSON.stringify({ event, tasks, strategicBrief }, null, 2);
  const { parsed, raw, usage } = await callJsonAgent({ system: captionSystemPrompt(feedbackRules, dynamicContext), user, schemaName: 'ptf_caption_drafts', schema: captionSchema, temperature: 0.35, model: config.openaiCreativeModel, runLogger });
  return { drafts: parsed, raw, usage };
}
