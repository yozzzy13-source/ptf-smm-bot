import { brandRules } from './brandRules.js';
import { projectContext } from '../knowledge/projectContext.js';

export function contentPlannerSystemPrompt(dynamicContext = '') {
  return `${brandRules}\n\n${projectContext}\n\n${dynamicContext}\n\nYou are the Event Lifecycle Planner for PTF. Create a rich, realistic, professional SMM campaign, not a minimal task list.\n\nSTRICT RULES:\n1. Use current date context from payload. Never invent 2024 unless explicitly provided.\n2. Divide an event campaign into phases: Pre-event warm-up, Match-day before start, Live/user capture tasks, First 24h after match, Post-event tail for 3-7 days.\n3. If event is 2-3 days away, minimum useful plan: 3-5 IG Stories before event, 1 IG post/reel if material allows, 1-2 Telegram posts, user talking-story reminders, match-day reminders, result update, and a post-event tail.\n4. Never schedule pre-event covers, announcements, or reminders after event start time. After start time only live/result/reaction/highlight tasks are allowed.\n5. Telegram Stories are usually user tasks: tell the user what to record/say and when.\n6. Every Instagram/Telegram post should have a visual requirement.\n7. Create user_action_tasks: what to shoot, what to say, what to ask players, what asset/slogan/voice note is needed.\n8. Create a 5-7 day post-event content tail when the event is important.\n9. Avoid repeating both player names in every title. Mention matchup once; then use short titles like Main poster, Countdown story, Result update.\n10. Return JSON only.`;
}

export const contentPlannerSchema = {
  type:'object', additionalProperties:false,
  properties:{
    campaign_summary_ru:{type:'string'},
    lifecycle_strategy_ru:{type:'string'},
    event:{type:'object', additionalProperties:false, properties:{ type:{type:'string'}, date:{type:'string'}, time:{type:'string'}, venue:{type:'string'}, division:{type:'string'}, player1:{type:'string'}, player2:{type:'string'}, importance:{type:'string'}, story_angle:{type:'string'}, notes:{type:'string'} }, required:['type','date','time','venue','division','player1','player2','importance','story_angle','notes']},
    content_tasks:{type:'array', items:{type:'object', additionalProperties:false, properties:{ publish_date:{type:'string'}, channel:{type:'string'}, format:{type:'string'}, content_pillar:{type:'string'}, title:{type:'string'}, status:{type:'string'}, priority:{type:'string'}, caption_status:{type:'string'}, edit_status:{type:'string'}, design_status:{type:'string'}, notes:{type:'string'}, agent_suggestion:{type:'string'}}, required:['publish_date','channel','format','content_pillar','title','status','priority','caption_status','edit_status','design_status','notes','agent_suggestion']}},
    publication_schedule:{type:'array', items:{type:'object', additionalProperties:false, properties:{ publish_date:{type:'string'}, publish_time:{type:'string'}, channel:{type:'string'}, format:{type:'string'}, title:{type:'string'}, purpose:{type:'string'}, overlap_check:{type:'string'}, status:{type:'string'}, owner:{type:'string'}, notes:{type:'string'}}, required:['publish_date','publish_time','channel','format','title','purpose','overlap_check','status','owner','notes']}},
    user_action_tasks:{type:'array', items:{type:'object', additionalProperties:false, properties:{ due_date:{type:'string'}, due_time:{type:'string'}, task_type:{type:'string'}, task:{type:'string'}, why_needed:{type:'string'}, priority:{type:'string'}, status:{type:'string'}, owner:{type:'string'}, notes:{type:'string'}}, required:['due_date','due_time','task_type','task','why_needed','priority','status','owner','notes']}},
    post_event_tail:{type:'array', items:{type:'object', additionalProperties:false, properties:{ day:{type:'string'}, idea:{type:'string'}, channel:{type:'string'}, format:{type:'string'}, needed_asset:{type:'string'}, purpose:{type:'string'}}, required:['day','idea','channel','format','needed_asset','purpose']}},
    visual_needs:{type:'array', items:{type:'string'}},
    missing_assets:{type:'array', items:{type:'string'}},
    recommended_next_action_ru:{type:'string'}
  },
  required:['campaign_summary_ru','lifecycle_strategy_ru','event','content_tasks','publication_schedule','user_action_tasks','post_event_tail','visual_needs','missing_assets','recommended_next_action_ru']
};
