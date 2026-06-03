import { callJsonAgent } from '../services/openaiService.js';
import { config } from '../config.js';
import { feedbackSystemPrompt, feedbackSchema } from '../prompts/feedbackPrompt.js';
import { saveFeedbackRule } from '../services/sheetsStorage.js';

export async function processFeedback({ text, runLogger }) {
  const { parsed } = await callJsonAgent({
    system: feedbackSystemPrompt(),
    user: text,
    schemaName: 'ptf_feedback_memory',
    schema: feedbackSchema,
    temperature: 0.1,
    model: config.openaiCreativeModel,
    runLogger
  });
  let saved = null;
  if (parsed.is_persistent_rule && parsed.rule_en) {
    saved = await saveFeedbackRule({
      scope: parsed.scope,
      rule: parsed.rule_en,
      applies_to_agent: parsed.applies_to_agent,
      source_message: text,
      status: 'Active',
      notes: parsed.rule_ru
    });
  }
  return { feedback: parsed, saved };
}
