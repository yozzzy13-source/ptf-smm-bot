
import { callJsonAgent } from '../services/openaiService.js';
import { config } from '../config.js';
import { createStorylines } from '../services/sheetsStorage.js';
import { buildDynamicContextBlock } from '../services/contextMemoryService.js';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    trigger_type: { type: 'string' },
    why_it_matters: { type: 'string' },
    suggested_channel: { type: 'string' },
    suggested_format: { type: 'string' },
    division: { type: 'string' },
    players: { type: 'string' },
    match: { type: 'string' },
    telegram_draft: { type: 'string' },
    ig_story_idea: { type: 'string' },
    notes: { type: 'string' }
  },
  required: ['trigger_type','why_it_matters','suggested_channel','suggested_format','division','players','match','telegram_draft','ig_story_idea','notes']
};

export async function analyzeStorylineFromText({ text, matchLogSummary = null }) {
  const dynamicContext = await buildDynamicContextBlock();
  const { parsed } = await callJsonAgent({
    system: `You are the Storyline Agent for PTF. ${dynamicContext}
Find content-worthy storylines from match results, match history, player performance and league movement. Return JSON only.`,
    user: JSON.stringify({ text, matchLogSummary }, null, 2),
    schemaName: 'ptf_storyline',
    schema,
    temperature: 0.3,
    model: config.openaiCreativeModel
  });
  await createStorylines([parsed]);
  return parsed;
}
