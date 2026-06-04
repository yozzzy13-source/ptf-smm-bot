import { config } from '../config.js';
import { saveMediaAvailabilityChecks } from './sheetsStorage.js';

export function buildMixedMediaNeeds(event = {}, campaignType = 'match') {
  return [
    { needed_asset_type:'player short clip', primary_format:'video story', supporting_format:'player card / graphic story', fallback_format:'9:16 story poster', search_scope:'player folders + event folder', notes:'Stories use mixed media: video if available plus graphic support.' },
    { needed_asset_type:'main match poster', primary_format:'graphic poster 4:5', supporting_format:'short player clip in Stories', fallback_format:'player cards', search_scope:'style pack + player refs', notes:'Official visual identity is required even when video exists.' },
    { needed_asset_type:'live atmosphere clips', primary_format:'vertical video', supporting_format:'talking story / graphic frame', fallback_format:'talking story + last call graphic', search_scope:'event folder / live upload folder', notes:'Live content should be video-first but not video-only.' },
    { needed_asset_type:'post-match result', primary_format:'result card + story', supporting_format:'reaction video / rally clip', fallback_format:'Telegram recap', search_scope:'event folder / match clips', notes:'Result needs both clear graphic and optional video emotion.' },
    { needed_asset_type:'highlight reel', primary_format:'edited video reel', supporting_format:'cover graphic', fallback_format:'carousel + best-rally story', search_scope:'edited highlights / selected clips', notes:'If no edited video exists, use graphics and smaller story units.' }
  ].map((x)=>({ ...x, related_event_id:event.event_id || '', campaign_id:event.event_id || '', availability: config.enableMediaScanner ? 'Scan Pending' : 'Not Scanned', status:'Prepared' }));
}

export async function prepareMediaAvailabilityForCampaign(event = {}) {
  const needs = buildMixedMediaNeeds(event);
  return saveMediaAvailabilityChecks(needs);
}
