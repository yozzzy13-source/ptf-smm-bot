import { brandRules } from './brandRules.js';
import { projectContext } from '../knowledge/projectContext.js';
export function captionSystemPrompt(feedbackRules = [], dynamicContext = '') { const rules = feedbackRules?.length ? feedbackRules.map((r) => `- ${r.rule}`).join('\n') : '- No extra user feedback rules yet.'; return `${brandRules}

${projectContext}

${dynamicContext}

You are the Caption Agent for PTF. Create public-facing English drafts. Keep them natural, premium but friendly, and not too long. Apply active user feedback rules:
${rules}
Include a concise Instagram hashtag set: branded, local Phuket, tennis/community, and event/division-specific. Avoid huge hashtag blocks. Do not repeat both player names too many times inside one caption. Return JSON only.`; }
export const captionSchema = { type:'object', additionalProperties:false, properties:{ telegram_draft:{type:'string'}, instagram_caption:{type:'string'}, story_text_options:{type:'array',items:{type:'string'}}, poster_prompt:{type:'string'}, hashtags:{type:'array',items:{type:'string'}}, notes_ru:{type:'string'} }, required:['telegram_draft','instagram_caption','story_text_options','poster_prompt','hashtags','notes_ru']};
