import { config } from '../config.js';
import { getActiveCampaign, getRecentReferenceAssets, saveGeneratedImages, saveVisualPrompts, saveSystemLog, saveVisualJob, saveVisualVersions, getLastVisualJob } from './sheetsStorage.js';
import { downloadTelegramFileBuffer } from './telegramService.js';
import { generateImageWithReferenceBuffers } from './openaiService.js';
import { shortId } from '../utils/idUtils.js';
import { escapeHtml } from '../utils/html.js';
import { visualSetKeyboard } from './telegramKeyboardService.js';
import { extractErrorDetails } from '../utils/errorUtils.js';

export function isVisualOnlyRequest(text = '') {
  const t = String(text || '').toLowerCase();
  if (t.startsWith('/generate_visual') || t.startsWith('/poster')) return true;
  const wantsImage = /(сгенер|генерир|создай|сделай|пришли|перегенер).{0,100}(постер|картин|изображ|визуал|cover|poster|обложк)/i.test(t);
  const visualContext = /(текущ|референс|вариант|главн|матчев|только|не пересоздавай|не меняй|перв|втор|оба|обе)/i.test(t);
  return wantsImage && visualContext;
}

export function isVisualRevisionRequest(text = '') {
  const t = String(text || '').toLowerCase();
  const editWords = /(перв|втор|вариант\s*[12]|оба|обе|обе версии|доработ|измени|исправ|сохрани|не\s+изменяй|не\s+меняй|ближе.*оригинал|оригинал|сделай.*темн|сделай.*светл|крупн|увелич|уменьш|перегенер|оставь|лучше|фон|композици|шрифт|цвет|логотип|лого|фото.*спортсмен|спортсмен.*фото)/i;
  const visualWords = /(вариант|постер|картин|визуал|фон|игрок|спортсмен|фото|логотип|лого|композици|оригинал|лица|лицо|цвет|шрифт)/i;
  return editWords.test(t) && visualWords.test(t);
}

export async function processVisualOnlyRequest({ text, messageMeta, runLogger, decision = null }) {
  const event = decision?.target_campaign || await getActiveCampaign();
  if (!event?.event_id) {
    return { type: 'visual_only', parseMode: 'HTML', textRu: '⚠️ <b>Не нашёл кампанию</b>\n\nСначала выбери кампанию или создай событие.' };
  }

  const isRevision = (decision?.intent === 'EDIT_VISUAL' || isVisualRevisionRequest(text)) && !/сгенер.*\d|создай.*\d|главн.*постер/i.test(text);
  const lastJob = await getLastVisualJob(event.event_id);
  const referenceAssets = await getRecentReferenceAssets(30);
  const refsToUse = pickReferences(referenceAssets, event.event_id);
  const referenceBuffers = [];
  for (const ref of refsToUse) {
    if (!ref.telegram_file_id) continue;
    try {
      const file = await downloadTelegramFileBuffer(ref.telegram_file_id);
      if (file?.buffer) referenceBuffers.push({ ...file, reference_id: ref.reference_id, reference_type: ref.reference_type });
    } catch (err) {
      runLogger?.warn?.({ err: err.message, referenceId: ref.reference_id }, 'Could not download reference for visual generation');
    }
  }

  const variantCount = parseVariantCount(text);
  const visualJob = await saveVisualJob({
    related_event_id: event.event_id,
    campaign_id: event.event_id,
    visual_type: detectVisualType(text),
    requested_variants: variantCount,
    status: isRevision ? 'Revision Requested' : 'Requested',
    reference_ids: refsToUse.map((r)=>r.reference_id),
    prompt_summary: text.slice(0, 500),
    generated_count: 0,
    last_user_feedback: isRevision ? text : '',
    next_step: 'Generate and send options to Telegram',
    raw_json: { text, decision, lastJob }
  });

  const assets = [];
  const basePrompt = buildPosterPrompt({ text, event, refsToUse, isRevision, lastJob });

  for (let i = 1; i <= variantCount; i += 1) {
    const visualId = shortId('VIS');
    const filename = `${event.date || 'ptf'}_${event.division || 'event'}_${event.player1 || 'player1'}_vs_${event.player2 || 'player2'}_${detectVisualType(text).replace(/\s+/g,'_')}_option_${i}.${config.openaiImageFormat || 'png'}`.replace(/[^a-zA-Z0-9_.-]+/g, '_');
    const revisionInstruction = isRevision
      ? `\n\nREVISION MODE: this is feedback for the latest generated poster set. Do not show a reference list. Do not create a new campaign. Preserve the best existing composition when possible. Apply the user's feedback precisely. If the user says preserve original logo or player photos, keep them as close to the provided references as possible.`
      : '';
    const fullPrompt = `${basePrompt}${revisionInstruction}\n\nOption ${i} of ${variantCount}: make this option meaningfully distinct while keeping the approved PTF identity. Do not create or modify any SMM campaign, schedule, or captions.`;
    let generated;
    try {
      generated = await generateImageWithReferenceBuffers({ prompt: fullPrompt, referenceBuffers, size: config.openaiImageSize, filename, runLogger });
    } catch (err) {
      { const d = extractErrorDetails(err); generated = { enabled: config.enableImageGeneration, error: d.short, raw_error: d.raw, drive: null, note: 'Generation failed' }; runLogger?.error?.({ err: d.short, raw: d.raw, option: i, visualJob: visualJob.visual_job_id }, 'Visual-only image generation failed'); }
    }
    assets.push({ visual_id: visualId, asset_type: detectVisualType(text), channel: detectChannel(text), use_case: 'Visual-only generation', prompt: fullPrompt, generation_status: (generated?.telegramBuffer || generated?.drive?.uploaded || generated?.url) ? (generated?.drive?.uploaded ? 'Generated + uploaded' : 'Generated / Telegram only') : generated?.error ? 'Generation Failed' : 'Generated', output_link_path: generated?.drive?.webViewLink || generated?.url || '', size: config.openaiImageSize, priority: 'High', notes: `v0.5 visual-only; job=${visualJob.visual_job_id}; option=${i}; references=${referenceBuffers.length}; mode=${generated?.mode || ''}`, generated_image: generated, option_number: i });
  }

  const savedVisuals = await saveVisualPrompts(assets, event.event_id);
  const savedImages = await saveGeneratedImages(assets, event.event_id);
  await saveVisualVersions(assets.map((a, idx)=>({ visual_job_id: visualJob.visual_job_id, option_number: idx + 1, visual_id: a.visual_id, image_id: savedImages[idx]?.image_id || '', drive_link: savedImages[idx]?.link || a.generated_image?.drive?.webViewLink || '', status: (a.generated_image?.telegramBuffer || a.generated_image?.drive?.uploaded || a.generated_image?.url) ? 'Sent / Pending Review' : 'Generation Failed', prompt: a.prompt, raw_json: a })));
  await saveSystemLog({ run_id: messageMeta.runId, level: 'INFO', agent: 'Visual Only Service v0.5', action: isRevision ? 'revise_visual_set' : 'generate_visual_set', status: 'Done', output_summary: `${savedImages.length} images generated`, raw_json: { event, refsToUse, savedVisuals, savedImages, visualJob } });

  const textRu = formatVisualOnlyReply({ event, refsToUse, referenceBuffers, savedImages, visualJob, isRevision, assets });
  return { type: 'visual_only', parseMode: 'HTML', textRu, replyMarkup: visualSetKeyboard(visualJob.visual_job_id), telegramImages: collectTelegramImages(assets, visualJob.visual_job_id) };
}

function parseVariantCount(text = '') {
  const m = String(text || '').match(/(?:сгенерируй|сделай|создай|пришли)?\s*(\d+)\s*(?:вариант|картин|постер)/i);
  if (m) return Math.max(1, Math.min(Number(m[1]), config.maxImagesPerRequest || 2));
  return Math.max(2, Math.min(config.defaultVisualSamples || 2, config.maxImagesPerRequest || 2));
}
function detectVisualType(text='') { const t=String(text).toLowerCase(); if(t.includes('story')||t.includes('сторис')) return 'story poster'; if(t.includes('telegram')||t.includes('телеграм')) return 'telegram cover'; if(t.includes('carousel')||t.includes('карус')) return 'carousel cover'; return 'main match poster'; }
function detectChannel(text='') { const t=String(text).toLowerCase(); if(t.includes('telegram')||t.includes('телеграм')) return 'Telegram'; if(t.includes('story')||t.includes('сторис')) return 'Instagram Stories'; return 'Instagram'; }
function pickReferences(refs = [], eventId = '') {
  const active = refs.filter((r) => !String(r.status || '').toLowerCase().includes('skip') && !String(r.status || '').toLowerCase().includes('not use'));
  const related = active.filter((r)=>!r.related_event_id || r.related_event_id === eventId);
  const pool = [...related];
  // Supplement with recent active refs when event binding is incomplete or old campaign IDs differ.
  for (const r of active.slice().reverse()) {
    if (pool.length >= 12) break;
    if (!pool.find((x)=>x.reference_id === r.reference_id)) pool.push(r);
  }
  const style = pool.filter((r) => /style|стил|brand|poster/i.test(r.reference_type || '')).slice(-4);
  const players = pool.filter((r) => /player|игрок|playerref/i.test(r.reference_type || '')).slice(-3);
  const event = pool.filter((r) => /event|событ|location|локац|venue|partner|партн/i.test(r.reference_type || '')).slice(-3);
  const fallback = pool.slice(-10);
  const picked = [...players, ...style, ...event];
  const map = new Map();
  for (const r of (picked.length ? picked : fallback)) map.set(r.reference_id, r);
  return [...map.values()].slice(-10);
}

function buildPosterPrompt({ text, event, refsToUse, isRevision, lastJob }) {
  const styleCount = refsToUse.filter((r) => /style|brand/i.test(r.reference_type || '')).length;
  const playerCount = refsToUse.filter((r) => /player/i.test(r.reference_type || '')).length;
  const eventCount = refsToUse.filter((r) => /event|location/i.test(r.reference_type || '')).length;
  return `Create premium Phuket Tennis Family visual content. This is VISUAL-ONLY mode. Do not create or modify a content campaign, schedule, captions, or publication plan.\n\nEvent:\n${event.player1} vs ${event.player2}\nDivision ${event.division || 'PRIME'}\n6 June · 17:00\n${event.venue || 'The Peak Racquet Park'}\n\nReference images available:\n- ${playerCount} player reference image(s) for appearance and identity.\n- ${styleCount} style/brand/poster reference image(s) for PTF visual direction.\n- ${eventCount} event/location/logo reference image(s).\n\nPTF visual direction:\nPremium cinematic sports poster, tropical Phuket tennis atmosphere, blue hard court, sunset / dramatic warm light, high-end commercial sports photography, clean strong typography, players as heroes, PTF identity, minimal but clear text. Include PTF branding and venue branding when reference is provided.\n\nRequired text on visual:\n${event.player1} vs ${event.player2}\nDivision ${event.division || 'PRIME'}\n6 June · 17:00\nThe Peak Racquet Park\n\n${isRevision ? `This is a revision request. Use the user's feedback and preserve the selected composition when requested. Last visual job: ${lastJob?.visual_job_id || 'unknown'}.` : ''}\n\nUser instruction:\n${text}`;
}
function formatVisualOnlyReply({ event, refsToUse, referenceBuffers, savedImages, visualJob, isRevision, assets = [] }) {
  const imgLines = (assets || []).map((a, i) => {
    const g = a.generated_image || {};
    if (g.telegramBuffer || g.drive?.uploaded || g.url) {
      const link = g.drive?.webViewLink || g.url || '';
      return `• Вариант ${i + 1}: ${link ? `<a href="${escapeHtml(link)}">открыть</a>` : 'сгенерирован и отправляется в Telegram'} (${escapeHtml(g.mode || '')})`;
    }
    return `• Вариант ${i + 1}: Generation Failed — ${escapeHtml(g.error || g.note || 'ошибка не раскрыта')}`;
  }).join('\n') || 'Картинки не сгенерированы. Проверь Railway logs / OpenAI image model.';
  const failed = (assets || []).filter((a)=>a.generated_image?.error).map((a)=>a.generated_image.error).filter(Boolean);
  const errorBlock = failed.length ? `\n\n<b>Ошибки</b>\n${failed.slice(0,3).map((e)=>`• ${escapeHtml(e)}`).join('\n')}` : '';
  return `🎨 <b>${isRevision ? 'Доработка визуала по последнему Visual Job' : 'Visual-only генерация'}</b>\n\n<b>Что важно</b>\n• Кампанию не пересоздавал\n• Schedule не менял\n• Новые публикации не создавал\n\n<b>Кампания</b>\n${escapeHtml(event.player1 || '')} vs ${escapeHtml(event.player2 || '')} · ${escapeHtml(event.division || '')} · 6 июня · 17:00\n\n<b>Референсы</b>\n• найдено — ${refsToUse.length}\n• загружено для генерации — ${referenceBuffers.length}\n\n<b>Visual Job</b>\n<code>${escapeHtml(visualJob.visual_job_id)}</code>\n\n<b>Результат</b>\n${imgLines}${errorBlock}\n\n<b>Следующий шаг</b>\nЕсли картинки пришли — выбери вариант или напиши правку. Если не пришли — пришли этот блок ошибки, теперь причина будет видна.`;
}

function collectTelegramImages(assets = [], jobId = '') {
  return (assets || []).map((a, i) => {
    const g = a?.generated_image || {};
    if (g.telegramBuffer) return { assetType: a.asset_type || 'visual', caption: `🖼 Вариант ${i + 1} · ${a.asset_type || 'Generated image'}\nVisual Job: ${jobId}`, photoBuffer: g.telegramBuffer, driveLink: g.drive?.webViewLink || '' };
    if (g.drive?.uploaded) return { assetType: a.asset_type || 'visual', caption: `🖼 Вариант ${i + 1} · ${a.asset_type || 'Generated image'}\nVisual Job: ${jobId}`, photoUrl: g.drive.directImageUrl || g.drive.webContentLink || g.drive.webViewLink || '', driveLink: g.drive.webViewLink || '' };
    if (g.url) return { assetType: a.asset_type || 'visual', caption: `🖼 Вариант ${i + 1} · ${a.asset_type || 'Generated image'}\nVisual Job: ${jobId}`, photoUrl: g.url, driveLink: '' };
    return null;
  }).filter(Boolean);
}
