import { createStorylines } from '../services/sheetsStorage.js';
import { shortId } from '../utils/idUtils.js';

// MVP placeholder: deterministic storyline creator for user-provided result text.
// Later this will read full match history and standings.
export async function analyzeStorylineFromText({ text }) {
  const lower = text.toLowerCase();
  const triggers = [];
  if (lower.includes('10-') || lower.includes('tiebreak') || lower.includes('tie-break')) triggers.push('Close Match');
  if (lower.includes('comeback') || lower.includes('камбэк')) triggers.push('Comeback');
  if (lower.includes('first win') || lower.includes('первая побед')) triggers.push('First Win');
  if (lower.includes('streak') || lower.includes('серия')) triggers.push('Streak');
  const storyline = {
    storyline_id: shortId('STY'),
    division: '',
    players: '',
    match: text.slice(0, 160),
    trigger_type: triggers.join(', ') || 'Potential Storyline',
    why_it_matters: 'Potential league story detected from user message. Needs review before publishing.',
    suggested_channel: 'Telegram / Instagram Stories',
    suggested_format: 'Short update / Story slide',
    status: 'Idea',
    telegram_draft: '',
    ig_story_idea: '',
    notes: 'MVP auto-detection. Upgrade later with full match history analysis.'
  };
  await createStorylines([storyline]);
  return storyline;
}
