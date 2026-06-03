import { callJsonAgent } from '../services/openaiService.js';
import { captionSystemPrompt, captionSchema } from '../prompts/captionPrompt.js';

export async function generateDrafts({ event, tasks, feedbackRules = [], runLogger }) {
  const user = JSON.stringify({ event, tasks }, null, 2);
  const { parsed, raw, usage } = await callJsonAgent({
    system: captionSystemPrompt(feedbackRules),
    user,
    schemaName: 'ptf_caption_drafts',
    schema: captionSchema,
    temperature: 0.35,
    runLogger
  });
  return { drafts: parsed, raw, usage };
}
