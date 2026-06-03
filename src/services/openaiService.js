import OpenAI from 'openai';
import { config } from '../config.js';
import { safeJsonParse } from '../utils/safeJson.js';
import { logger } from './logger.js';
import { uploadBufferToDrive } from './googleDriveService.js';

const client = new OpenAI({ apiKey: config.openaiApiKey });

export async function callJsonAgent({ system, user, schemaName, schema, temperature = 0.2, model = config.openaiModel, runLogger = logger }) {
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature,
      response_format: schema ? { type: 'json_schema', json_schema: { name: schemaName || 'agent_output', schema, strict: true } } : { type: 'json_object' }
    });
    const content = response.choices?.[0]?.message?.content || '{}';
    return { parsed: safeJsonParse(content, {}), raw: content, usage: response.usage };
  } catch (err) {
    runLogger.error({ err: err.message, model }, 'Structured output failed; trying fallback JSON object');
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: `${system}\nReturn valid JSON only.` }, { role: 'user', content: user }],
      temperature,
      response_format: { type: 'json_object' }
    });
    const content = response.choices?.[0]?.message?.content || '{}';
    return { parsed: safeJsonParse(content, {}), raw: content, usage: response.usage };
  }
}

export async function generateImageFromPrompt({ prompt, size = config.openaiImageSize, quality = config.openaiImageQuality, format = config.openaiImageFormat, model = config.openaiImageModel, filename = 'ptf-generated-image.png', runLogger = logger }) {
  if (!config.enableImageGeneration) return { enabled: false, note: 'ENABLE_IMAGE_GENERATION=false', prompt, size, quality, model };

  const response = await client.images.generate({ model, prompt, size, quality, output_format: format });
  const item = response.data?.[0] || {};
  const b64 = item.b64_json;
  if (!b64) return { enabled: true, model, size, quality, format, revised_prompt: item.revised_prompt || '', url: item.url || '', drive: null, note: 'No b64_json in image response' };

  const buffer = Buffer.from(b64, 'base64');
  const drive = await uploadBufferToDrive({ buffer, filename, mimeType: format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png' });
  runLogger.info({ model, size, quality, drive }, 'OpenAI image generation completed');
  return { enabled: true, model, size, quality, format, revised_prompt: item.revised_prompt || '', drive, url: drive?.webViewLink || item.url || '' };
}
