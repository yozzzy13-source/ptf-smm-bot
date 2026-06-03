
import OpenAI from 'openai';
import { config } from '../config.js';
import { safeJsonParse } from '../utils/safeJson.js';
import { logger } from './logger.js';

const client = new OpenAI({ apiKey: config.openaiApiKey });

export async function callJsonAgent({ system, user, schemaName, schema, temperature = 0.2, model = config.openaiModel, runLogger = logger }) {
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature,
      response_format: schema ? {
        type: 'json_schema',
        json_schema: { name: schemaName || 'agent_output', schema, strict: true }
      } : { type: 'json_object' }
    });
    const content = response.choices?.[0]?.message?.content || '{}';
    const parsed = safeJsonParse(content, {});
    runLogger.debug({ model, usage: response.usage, parsed }, 'OpenAI JSON agent response');
    return { parsed, raw: content, usage: response.usage };
  } catch (err) {
    runLogger.error({ err: err.message }, 'Structured output failed; trying fallback JSON object');
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: `${system}
Return valid JSON only.` },
        { role: 'user', content: user }
      ],
      temperature,
      response_format: { type: 'json_object' }
    });
    const content = response.choices?.[0]?.message?.content || '{}';
    return { parsed: safeJsonParse(content, {}), raw: content, usage: response.usage };
  }
}

export async function generateImageFromPrompt({ prompt, size = config.openaiImageSize, quality = config.openaiImageQuality, model = config.openaiImageModel, runLogger = logger }) {
  if (!config.enableImageGeneration) {
    return { enabled: false, note: 'ENABLE_IMAGE_GENERATION=false', prompt, size, quality, model };
  }

  const response = await client.images.generate({
    model,
    prompt,
    size,
    quality
  });

  const item = response.data?.[0] || {};
  runLogger.info({ model, size, quality, revisedPrompt: item.revised_prompt }, 'OpenAI image generation completed');
  return {
    enabled: true,
    model,
    size,
    quality,
    revised_prompt: item.revised_prompt || '',
    b64_json: item.b64_json || null,
    url: item.url || null
  };
}
