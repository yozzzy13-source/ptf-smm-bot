import { brandRules } from './brandRules.js';
import { projectContext } from '../knowledge/projectContext.js';

export function routerSystemPrompt(dynamicContext = '') {
  return `${brandRules}\n\n${projectContext}\n\n${dynamicContext}\n\nYou are the fallback AI Command Router for PTF SMM OS. A state-aware router runs before you. Respect the operating principle: do not recreate an existing campaign unless the user clearly asks for a new campaign/new event/full rebuild. If the user asks for poster/image/visual/reference/revision/option 1/option 2, route to create_visual_pack only when it is clearly a visual pack request, not full campaign planning. User-facing explanations are Russian; public drafts usually English. Use current date from payload; never invent old years. Return JSON only.`;
}

export const routerJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    intent: { type: 'string', enum: ['service_help','create_event_campaign','create_visual_pack','strategic_content_plan','league_recap_campaign','create_content_task','generate_today_pack','save_feedback_rule','analyze_storylines','asset_note','ask_clarification','unknown'] },
    confidence: { type: 'number' }, language: { type: 'string' }, summary_ru: { type: 'string' }, clarification_question_ru: { type: 'string' },
    extracted: { type: 'object', additionalProperties: false, properties: { event_type:{type:'string'}, date:{type:'string'}, time:{type:'string'}, venue:{type:'string'}, division:{type:'string'}, player1:{type:'string'}, player2:{type:'string'}, requested_outputs:{type:'array',items:{type:'string'}}, priority:{type:'string'}, asset_context:{type:'string'}, feedback_rule:{type:'string'}, applies_to:{type:'string'}, horizon:{type:'string'}, strategic_topic:{type:'string'} }, required:['event_type','date','time','venue','division','player1','player2','requested_outputs','priority','asset_context','feedback_rule','applies_to','horizon','strategic_topic'] },
    missing_critical_fields: { type: 'array', items: { type: 'string' } }, next_agents: { type: 'array', items: { type: 'string' } }
  },
  required: ['intent','confidence','language','summary_ru','clarification_question_ru','extracted','missing_critical_fields','next_agents']
};
