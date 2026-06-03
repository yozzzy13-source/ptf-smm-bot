
import { callJsonAgent, generateImageFromPrompt } from '../services/openaiService.js';
import { config } from '../config.js';
import { visualProductionSystemPrompt, visualProductionSchema } from '../prompts/visualProductionPrompt.js';
import { buildDynamicContextBlock } from '../services/contextMemoryService.js';

export async function buildVisualPack({ route, event, tasks, drafts, runLogger }) {
  const dynamicContext = await buildDynamicContextBlock();
  const user = JSON.stringify({ route, event, tasks, drafts }, null, 2);
  const { parsed, raw, usage } = await callJsonAgent({
    system: visualProductionSystemPrompt(dynamicContext),
    user,
    schemaName: 'ptf_visual_pack',
    schema: visualProductionSchema,
    temperature: 0.35,
    model: config.openaiCreativeModel,
    runLogger
  });

  const assets = [];
  for (const asset of parsed.assets || []) {
    const promptReady = { ...asset };
    if (config.enableImageGeneration && ['Match Poster','Story Card','Carousel Cover','Telegram Cover','YouTube Thumbnail','Event Header','Player Avatar'].includes(asset.asset_type)) {
      try {
        const generated = await generateImageFromPrompt({ prompt: asset.prompt, size: asset.size || config.openaiImageSize, runLogger });
        promptReady.generation_status = generated.enabled ? 'Generated' : 'Prompt Ready';
        promptReady.output_link_path = generated.url || '';
        promptReady.generated_image = generated;
      } catch (err) {
        runLogger.warn({ err: err.message, assetType: asset.asset_type }, 'Image generation failed; keeping prompt only');
        promptReady.generation_status = 'Prompt Ready';
        promptReady.output_link_path = '';
      }
    }
    assets.push(promptReady);
  }

  return { visualPack: { ...parsed, assets }, raw, usage };
}
