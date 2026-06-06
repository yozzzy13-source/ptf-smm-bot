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
  const refPlan = buildReferencePlan(refsToUse, event);
  const referenceBuffers = [];
  for (const ref of refPlan.generationRefs) {
    if (!ref.telegram_file_id) continue;
    try {
      const file = await downloadTelegramFileBuffer(ref.telegram_file_id);
      if (file?.buffer) {
        referenceBuffers.push({
          ...file,
          reference_id: ref.reference_id,
          reference_type: ref.reference_type,
          reference_role: classifyReferenceRole(ref),
          original_filename: referenceLabel(ref)
        });
      }
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
  const basePrompt = buildPosterPrompt({ text, event, refsToUse, isRevision, lastJob, refPlan });

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

function buildPosterPrompt({ text, event, refsToUse, isRevision, lastJob, refPlan = null }) {
  const plan = refPlan || buildReferencePlan(refsToUse, event);
  const playerCount = plan.playerRefs.length;
  const styleCount = plan.styleRefs.length;
  const exactLogoCount = plan.exactLogoRefs.length;
  const venueLogoCount = plan.venueLogoRefs.length;

  const playerInstruction = `PLAYER IDENTITY LOCK:
- Use ONLY the player reference images as player identity/appearance references.
- Do NOT use people from style/poster reference images as players.
- Default layout: Player 1 (${event.player1 || 'Player 1'}) on the LEFT, Player 2 (${event.player2 || 'Player 2'}) on the RIGHT.
- Keep player faces and body proportions as close to the provided player references as possible.
- If player references conflict with style references, player references win.`;

  const styleInstruction = `STYLE REFERENCES:
- Style/poster references are for mood, lighting, typography, composition, sports-poster energy and premium PTF atmosphere ONLY.
- Never copy players, faces, names, logos or opponent identities from style references.
- Do not invent extra players.`;

  const logoInstruction = `LOGO / BRAND RULES:
- Exact logo assets are NOT identity references and must not be redrawn or reinterpreted.
- Reserve a clean safe area for the PTF logo overlay in the TOP-CENTER of the poster.
- Do not generate a fake, modified, decorative, palm-tree-added, warped or re-styled PTF logo.
- If a venue/sponsor logo is needed, leave a clean placement area; do not redesign it.
- If the model cannot preserve a logo exactly, leave space for overlay instead of drawing a distorted logo.`;

  const overlayNote = plan.exactLogoRefs.length
    ? `Exact logo overlay expected after generation: ${plan.exactLogoRefs.map(referenceLabel).join(', ')}.`
    : 'No exact logo selected yet; keep top-center area clean for future logo overlay.';

  return `Create premium Phuket Tennis Family visual content. This is VISUAL-ONLY mode. Do not create or modify a content campaign, schedule, captions, or publication plan.

Event:
${event.player1} vs ${event.player2}
Division ${event.division || 'PRIME'}
6 June · 17:00
${event.venue || 'The Peak Racquet Park'}

Reference package:
- ${playerCount} player identity reference image(s).
- ${styleCount} style/composition reference image(s).
- ${exactLogoCount} exact PTF/brand logo asset(s) reserved for overlay.
- ${venueLogoCount} exact venue/sponsor logo asset(s), used only when selected for this event.

${playerInstruction}

${styleInstruction}

${logoInstruction}

Overlay instruction:
${overlayNote}

PTF visual direction:
Premium cinematic sports poster, tropical Phuket tennis atmosphere, blue hard court, sunset / dramatic warm light, high-end commercial sports photography, clean strong typography, players as heroes, minimal but clear text. Leave top-center negative space for exact PTF logo overlay.

Required text on visual:
${event.player1} vs ${event.player2}
Division ${event.division || 'PRIME'}
6 June · 17:00
The Peak Racquet Park

${isRevision ? `This is a revision request. Use the user's feedback and preserve the selected composition when requested. Last visual job: ${lastJob?.visual_job_id || 'unknown'}.` : ''}

User instruction:
${text}`;
}

function classifyReferenceRole(ref = {}) {
  const type = String(ref.reference_type || '').toLowerCase();
  if (/brand logo exact|ptf logo|exact logo/.test(type)) return 'brand_logo_exact';
  if (/venue|sponsor|partner|location|локац|партн/.test(type) && /logo|exact/.test(type)) return 'venue_logo_exact';
  if (/player card/.test(type)) return 'player_card';
  if (/player|игрок|playerref/.test(type)) return 'player_ref';
  if (/style|стил|poster|composition|brand reference/.test(type)) return 'style_ref';
  if (/event|событ|venue|location|partner/.test(type)) return 'event_ref';
  return 'other_ref';
}

function referenceLabel(ref = {}) {
  const notes = parseMaybeJson(ref.notes);
  return notes.display_label || notes.original_filename || ref.reference_id || 'reference';
}

function parseMaybeJson(value = '') {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildReferencePlan(refs = [], event = {}) {
  const unique = [];
  const seen = new Set();
  for (const ref of refs || []) {
    if (!ref?.reference_id || seen.has(ref.reference_id)) continue;
    seen.add(ref.reference_id);
    unique.push(ref);
  }

  const playerRefs = unique.filter((r) => classifyReferenceRole(r) === 'player_ref').slice(-2);
  const playerCards = unique.filter((r) => classifyReferenceRole(r) === 'player_card').slice(-2);
  const styleRefs = unique.filter((r) => classifyReferenceRole(r) === 'style_ref').slice(-4);
  const exactLogoRefs = unique.filter((r) => classifyReferenceRole(r) === 'brand_logo_exact').slice(-2);
  const venueLogoRefs = unique.filter((r) => classifyReferenceRole(r) === 'venue_logo_exact').slice(-2);
  const eventRefs = unique.filter((r) => classifyReferenceRole(r) === 'event_ref').slice(-2);

  // Exact logos are intentionally excluded from generation refs to avoid distorted/redrawn logos.
  // The prompt reserves space for overlay. Logo compositing can be added as a later deterministic pipeline.
  const generationRefs = [...playerRefs, ...styleRefs, ...eventRefs, ...playerCards].slice(-8);

  return { unique, playerRefs, playerCards, styleRefs, exactLogoRefs, venueLogoRefs, eventRefs, generationRefs };
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
