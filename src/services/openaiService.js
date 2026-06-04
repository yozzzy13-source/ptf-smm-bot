import OpenAI from 'openai';
import { config } from '../config.js';
import { safeJsonParse } from '../utils/safeJson.js';
import { logger } from './logger.js';
import { uploadBufferToDrive } from './googleDriveService.js';
import { extractErrorDetails } from '../utils/errorUtils.js';

const client = new OpenAI({ apiKey: config.openaiApiKey });

function supportsCustomTemperature(model = '') {
  const m = String(model || '').toLowerCase();
  if (m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return false;
  return true;
}

function buildChatParams({ model, messages, temperature, response_format }) {
  const params = { model, messages };
  if (response_format) params.response_format = response_format;
  if (supportsCustomTemperature(model) && temperature !== undefined && temperature !== null) params.temperature = temperature;
  return params;
}

function toAgentError(err, context = {}) {
  const details = extractErrorDetails(err);
  const e = new Error(`OpenAI request failed — ${details.short}`);
  e.details = details;
  e.context = context;
  e.original = err;
  return e;
}

export async function callJsonAgent({ system, user, schemaName, schema, temperature = 0.2, model = config.openaiModel, runLogger = logger }) {
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];
  const response_format = schema ? { type: 'json_schema', json_schema: { name: schemaName || 'agent_output', schema, strict: true } } : { type: 'json_object' };
  const temperatureSent = supportsCustomTemperature(model) ? temperature : 'omitted_model_default';

  // 1) Strict structured output.
  try {
    runLogger.debug({ model, schemaName, temperatureSent, responseFormat: response_format?.type }, 'OpenAI JSON agent call');
    const response = await client.chat.completions.create(buildChatParams({ model, messages, temperature, response_format }));
    const content = response.choices?.[0]?.message?.content || '{}';
    return { parsed: safeJsonParse(content, {}), raw: content, usage: response.usage, model, temperatureSent };
  } catch (err) {
    const d = extractErrorDetails(err);
    runLogger.error({ err: d.short, raw: d.raw, model, schemaName, temperatureSent }, 'Strict structured output failed; trying json_object fallback');
  }

  // 2) JSON object fallback.
  try {
    const fallbackMessages = [{ role: 'system', content: `${system}\nReturn valid JSON only.` }, { role: 'user', content: user }];
    const response = await client.chat.completions.create(buildChatParams({
      model,
      messages: fallbackMessages,
      temperature,
      response_format: { type: 'json_object' }
    }));
    const content = response.choices?.[0]?.message?.content || '{}';
    return { parsed: safeJsonParse(content, {}), raw: content, usage: response.usage, model, temperatureSent };
  } catch (err) {
    const d = extractErrorDetails(err);
    runLogger.error({ err: d.short, raw: d.raw, model, schemaName, temperatureSent }, 'json_object fallback failed; trying plain JSON prompt');
  }

  // 3) Plain text fallback. Some models/endpoints reject response_format.
  try {
    const plainMessages = [{ role: 'system', content: `${system}\nYou must answer with valid compact JSON only. No markdown.` }, { role: 'user', content: user }];
    const response = await client.chat.completions.create(buildChatParams({ model, messages: plainMessages, temperature }));
    const content = response.choices?.[0]?.message?.content || '{}';
    return { parsed: safeJsonParse(content, {}), raw: content, usage: response.usage, model, temperatureSent };
  } catch (err) {
    throw toAgentError(err, { model, schemaName, temperatureSent });
  }
}

export async function generateImageFromPrompt({ prompt, size = config.openaiImageSize, quality = config.openaiImageQuality, format = config.openaiImageFormat, model = config.openaiImageModel, filename = 'ptf-generated-image.png', runLogger = logger }) {
  if (!config.enableImageGeneration) return { enabled: false, note: 'ENABLE_IMAGE_GENERATION=false', prompt, size, quality, model };

  try {
    const params = { model, prompt, size, quality };
    if (format) params.output_format = format;
    const response = await client.images.generate(params);
    const item = response.data?.[0] || {};
    const b64 = item.b64_json;
    if (!b64) return { enabled: true, model, size, quality, format, revised_prompt: item.revised_prompt || '', url: item.url || '', drive: null, note: 'No b64_json in image response' };

    const buffer = Buffer.from(b64, 'base64');
    const drive = await uploadBufferToDrive({ buffer, filename, mimeType: format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png' });
    runLogger.info({ model, size, quality, drive }, 'OpenAI image generation completed');
    return { enabled: true, model, size, quality, format, revised_prompt: item.revised_prompt || '', drive, url: drive?.webViewLink || item.url || '' };
  } catch (err) {
    throw toAgentError(err, { model, image: true, size, quality, format });
  }
}
