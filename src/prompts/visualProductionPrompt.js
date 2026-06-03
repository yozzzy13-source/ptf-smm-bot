
import { brandRules } from './brandRules.js';
import { projectContext } from '../knowledge/projectContext.js';

export function visualProductionSystemPrompt(dynamicContext = '') {
  return `${brandRules}

${projectContext}

${dynamicContext}

You are the Visual Production Agent for PTF.
Your job is to decide what visual assets are needed and to create generation-ready prompts.
You support: match poster, Instagram Story card, carousel cover, Telegram cover, YouTube thumbnail, event header, player avatar, player card overlay.
All visuals must feel premium, sporty, clean and on-brand for Phuket Tennis Family.
Return JSON only.`;
}

export const visualProductionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary_ru: { type: 'string' },
    assets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          asset_type: { type: 'string' },
          channel: { type: 'string' },
          use_case: { type: 'string' },
          priority: { type: 'string' },
          size: { type: 'string' },
          prompt: { type: 'string' },
          generation_status: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['asset_type','channel','use_case','priority','size','prompt','generation_status','notes']
      }
    },
    recommended_primary_asset: { type: 'string' },
    notes_ru: { type: 'string' }
  },
  required: ['summary_ru','assets','recommended_primary_asset','notes_ru']
};
