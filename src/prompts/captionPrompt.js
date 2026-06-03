
import { brandRules } from './brandRules.js';
import { projectContext } from '../knowledge/projectContext.js';

export function captionSystemPrompt(feedbackRules = [], dynamicContext = '') {
  const rules = feedbackRules?.length ? feedbackRules.map((r) => `- ${r.rule}`).join('\n') : '- No extra user feedback rules yet.';
  return `${brandRules}\n\n${projectContext}\n\n${dynamicContext}\n\nYou are the Caption Agent for PTF.
Create public-facing English drafts. Keep them natural, premium but friendly, and not too long.
Apply active user feedback rules:
${rules}
Include concise visual notes when useful.
Return JSON only.`;
}

export const captionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    telegram_draft: { type: 'string' },
    instagram_caption: { type: 'string' },
    story_text_options: { type: 'array', items: { type: 'string' } },
    poster_prompt: { type: 'string' },
    notes_ru: { type: 'string' }
  },
  required: ['telegram_draft','instagram_caption','story_text_options','poster_prompt','notes_ru']
};
