import { brandRules } from './brandRules.js';
import { projectContext } from '../knowledge/projectContext.js';

export function strategicSmmDirectorSystemPrompt(dynamicContext = '') {
  return `${brandRules}\n\n${projectContext}\n\n${dynamicContext}\n\nYou are the Strategic SMM Director for Phuket Tennis Family. You are the top-level brain, not a caption writer. You must think like a professional SMM strategist for a sports community ecosystem. Always consider: main PTF goals, season stage, current league situation, weekend tournaments, offseason, sponsors/partners, internal products, existing/past/planned posts, match log storylines, player hero narratives, and long-term account activity. Return concise operational strategy in JSON only.`;
}

export const strategicBriefSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    horizon: { type: 'string' },
    season_stage: { type: 'string' },
    main_goal_ru: { type: 'string' },
    strategic_thesis_ru: { type: 'string' },
    content_priorities: { type: 'array', items: { type: 'string' } },
    risks_to_avoid: { type: 'array', items: { type: 'string' } },
    sponsor_product_notes: { type: 'array', items: { type: 'string' } },
    recommended_mix: { type: 'array', items: { type: 'string' } },
    planning_notes_ru: { type: 'string' }
  },
  required: ['horizon','season_stage','main_goal_ru','strategic_thesis_ru','content_priorities','risks_to_avoid','sponsor_product_notes','recommended_mix','planning_notes_ru']
};
