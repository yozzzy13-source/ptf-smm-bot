import { callJsonAgent, generateImageFromPrompt } from '../services/openaiService.js';
import { config } from '../config.js';
import { visualProductionSystemPrompt, visualProductionSchema } from '../prompts/visualProductionPrompt.js';
import { buildDynamicContextBlock } from '../services/contextMemoryService.js';

function shouldGenerate(asset, generatedCount) {
  if (!config.enableImageGeneration) return false;
  if (generatedCount >= config.maxImagesPerRequest) return false;
  return ['match poster','story card','carousel cover','telegram cover','youtube thumbnail','event header','player avatar','story poster'].includes(String(asset.asset_type || '').toLowerCase());
}

function safeFileName(asset, event) {
  const base = `${event?.date || 'ptf'}_${event?.division || 'event'}_${asset.asset_type || 'visual'}`.replace(/[^a-z0-9_\-]+/gi,'_').slice(0,90);
  const ext = config.openaiImageFormat === 'jpeg' ? 'jpg' : config.openaiImageFormat || 'png';
  return `${base}.${ext}`;
}

export async function buildVisualPack({ route, event, tasks, drafts, strategicBrief = null, runLogger }) {
  const dynamicContext = await buildDynamicContextBlock(60);
  const user = JSON.stringify({ route, event, tasks, drafts, strategicBrief }, null, 2);
  const { parsed, raw, usage } = await callJsonAgent({ system: visualProductionSystemPrompt(dynamicContext), user, schemaName: 'ptf_visual_pack', schema: visualProductionSchema, temperature: 0.35, model: config.openaiCreativeModel, runLogger });
  const assets = [];
  let generatedCount = 0;
  for (const asset of parsed.assets || []) {
    const out = { ...asset };
    if (shouldGenerate(asset, generatedCount)) {
      try {
        const generated = await generateImageFromPrompt({ prompt: asset.prompt, size: asset.size || config.openaiImageSize, filename: safeFileName(asset, event), runLogger });
        generatedCount += 1;
        out.generation_status = generated.enabled ? (generated.drive?.uploaded ? 'Generated + uploaded' : 'Generated') : 'Prompt Ready';
        out.output_link_path = generated.drive?.webViewLink || generated.url || '';
        out.generated_image = generated;
      } catch (err) {
        runLogger.warn({ err: err.message, assetType: asset.asset_type }, 'Image generation failed; keeping prompt only');
        out.generation_status = 'Prompt Ready'; out.output_link_path = ''; out.generation_error = err.message;
      }
    }
    assets.push(out);
  }
  return { visualPack: { ...parsed, assets }, raw, usage };
}
