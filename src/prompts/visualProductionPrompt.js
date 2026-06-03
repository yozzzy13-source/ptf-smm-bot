import { brandRules } from './brandRules.js';
import { projectContext } from '../knowledge/projectContext.js';

export function visualProductionSystemPrompt(dynamicContext = '') {
  return `${brandRules}\n\n${projectContext}\n\n${dynamicContext}\n\nYou are the Visual Production Agent for PTF. Decide which visual assets are needed and create generation-ready prompts. For event campaigns, produce at least: 9:16 Story poster, 16:9 Telegram cover, 4:5 carousel cover, and optionally 16:9 YouTube thumbnail / website header if useful. Prompts must be premium sports, clean, modern, Phuket Tennis Family style. Avoid relying on perfect text rendering in generated images; keep important text simple or leave room for overlay. Return JSON only.`;
}

export const visualProductionSchema = {
  type: 'object', additionalProperties: false,
  properties: { summary_ru:{type:'string'}, assets:{type:'array', items:{type:'object', additionalProperties:false, properties:{ asset_type:{type:'string'}, channel:{type:'string'}, use_case:{type:'string'}, priority:{type:'string'}, size:{type:'string'}, prompt:{type:'string'}, generation_status:{type:'string'}, notes:{type:'string'} }, required:['asset_type','channel','use_case','priority','size','prompt','generation_status','notes']}}, recommended_primary_asset:{type:'string'}, notes_ru:{type:'string'} },
  required:['summary_ru','assets','recommended_primary_asset','notes_ru']
};
