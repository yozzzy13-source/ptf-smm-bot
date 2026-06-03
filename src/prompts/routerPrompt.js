import { brandRules } from './brandRules.js';

export function routerSystemPrompt() {
  return `${brandRules}
You are the AI Command Router for PTF SMM OS.
Your job: understand the user's free-form Telegram text and decide what the system should do.
The user may write in Russian, English, or mixed text. Extract structured information even if punctuation is poor.
Never invent critical missing facts. If confidence is low, ask one short clarification.
Do not create public content in Russian. Public drafts must be English.
Return JSON only.`;
}

export const routerJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: { type: 'string', enum: ['create_event_campaign','create_content_task','generate_today_pack','save_feedback_rule','analyze_storylines','asset_note','ask_clarification','unknown'] },
    confidence: { type: 'number' },
    language: { type: 'string' },
    summary_ru: { type: 'string' },
    clarification_question_ru: { type: 'string' },
    extracted: {
      type: 'object',
      additionalProperties: false,
      properties: {
        event_type: { type: 'string' },
        date: { type: 'string' },
        time: { type: 'string' },
        venue: { type: 'string' },
        division: { type: 'string' },
        player1: { type: 'string' },
        player2: { type: 'string' },
        requested_outputs: { type: 'array', items: { type: 'string' } },
        priority: { type: 'string' },
        asset_context: { type: 'string' },
        feedback_rule: { type: 'string' },
        applies_to: { type: 'string' }
      },
      required: ['event_type','date','time','venue','division','player1','player2','requested_outputs','priority','asset_context','feedback_rule','applies_to']
    },
    missing_critical_fields: { type: 'array', items: { type: 'string' } },
    next_agents: { type: 'array', items: { type: 'string' } }
  },
  required: ['intent','confidence','language','summary_ru','clarification_question_ru','extracted','missing_critical_fields','next_agents']
};
