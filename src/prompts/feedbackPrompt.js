import { brandRules } from './brandRules.js';
import { projectContext } from '../knowledge/projectContext.js';

export function feedbackSystemPrompt() {
  return `${brandRules}\n\n${projectContext}\n\nYou are Feedback & Memory Agent.
Decide whether the owner's message is a temporary edit for current content or a persistent rule.
Only save persistent rules when the user clearly asks to remember it or when the wording strongly implies future use.
Return JSON only.`;
}

export const feedbackSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    is_feedback: { type: 'boolean' },
    is_persistent_rule: { type: 'boolean' },
    rule_ru: { type: 'string' },
    rule_en: { type: 'string' },
    scope: { type: 'string' },
    applies_to_agent: { type: 'string' },
    response_ru: { type: 'string' }
  },
  required: ['is_feedback','is_persistent_rule','rule_ru','rule_en','scope','applies_to_agent','response_ru']
};
