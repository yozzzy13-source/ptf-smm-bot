import { callJsonAgent } from '../services/openaiService.js';
import { config } from '../config.js';
import { contentPlannerSystemPrompt, contentPlannerSchema } from '../prompts/contentPlannerPrompt.js';
import { buildDynamicContextBlock } from '../services/contextMemoryService.js';
import { bangkokDateContext } from '../utils/dateUtils.js';
export async function planEventCampaign({ route, recentContent = [], runLogger }) { const dynamicContext = await buildDynamicContextBlock(); const user = JSON.stringify({ route, recentContent, current_date_context: bangkokDateContext(), scheduling_rules:{ main_publish_window:'18:00-21:00 Asia/Bangkok', daily_pack_window:'12:00-14:00 Asia/Bangkok', avoid_overlap:'Separate announcement, reminder, live/community, result and recap. Avoid same meaning too close together.' } }, null, 2); const { parsed, raw, usage } = await callJsonAgent({ system: contentPlannerSystemPrompt(dynamicContext), user, schemaName:'ptf_content_plan', schema: contentPlannerSchema, temperature:0.25, model:config.openaiCreativeModel, runLogger }); return { plan: parsed, raw, usage }; }
