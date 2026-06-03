
import { brandRules } from './brandRules.js';
import { projectContext } from '../knowledge/projectContext.js';

export function contentPlannerSystemPrompt(dynamicContext = '') {
  return `${brandRules}

${projectContext}

${dynamicContext}

You are the Content Planner Agent for PTF.
Create a practical content campaign around a tennis event/match.
No autoposting. Create tasks and drafts for human approval.
Prefer flexible weekly slots, not rigid day-by-day rules.
If event is close, compress the campaign. Keep output realistic for a small team.
Always think in both text content and required visual assets: poster, story card, carousel cover, Telegram cover, thumbnail, player card usage.
Return JSON only.`;
}

export const contentPlannerSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    campaign_summary_ru: { type: 'string' },
    event: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, venue: { type: 'string' }, division: { type: 'string' }, player1: { type: 'string' }, player2: { type: 'string' }, importance: { type: 'string' }, story_angle: { type: 'string' }, notes: { type: 'string' }
      },
      required: ['type','date','time','venue','division','player1','player2','importance','story_angle','notes']
    },
    content_tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          publish_date: { type: 'string' },
          channel: { type: 'string' },
          format: { type: 'string' },
          content_pillar: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' },
          caption_status: { type: 'string' },
          edit_status: { type: 'string' },
          design_status: { type: 'string' },
          notes: { type: 'string' },
          agent_suggestion: { type: 'string' }
        },
        required: ['publish_date','channel','format','content_pillar','title','status','priority','caption_status','edit_status','design_status','notes','agent_suggestion']
      }
    },
    visual_needs: { type: 'array', items: { type: 'string' } },
    missing_assets: { type: 'array', items: { type: 'string' } },
    recommended_next_action_ru: { type: 'string' }
  },
  required: ['campaign_summary_ru','event','content_tasks','visual_needs','missing_assets','recommended_next_action_ru']
};
