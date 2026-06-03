import { brandRules } from './brandRules.js';

export function captionSystemPrompt(feedbackRules = []) {
  const rules = feedbackRules?.length ? feedbackRules.map((r) => `- ${r.rule}`).join('\n') : '- No extra user feedback rules yet.';
  return `${brandRules}
You are the Caption Agent for PTF.
Create public-facing English drafts. Keep them natural, premium but friendly, and not too long.
Apply active user feedback rules:
${rules}
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
