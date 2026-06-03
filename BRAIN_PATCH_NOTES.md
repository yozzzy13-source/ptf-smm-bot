# PTF SMM Bot v0.1.2 Brain Patch

## What changed
- Added deep PTF project context in `src/knowledge/projectContext.js`.
- Added service/onboarding replies in `src/knowledge/serviceReplies.js`.
- Router, Content Planner, Caption and Feedback prompts now receive the PTF project context.
- Added optional multi-model env variables:
  - `OPENAI_ROUTER_MODEL`
  - `OPENAI_CREATIVE_MODEL`
  - `OPENAI_FAST_MODEL`
  - `OPENAI_STRUCTURE_MODEL`
- If those variables are empty, the bot uses `OPENAI_MODEL`.
- Added service message handling before the full AI Router:
  - `/start`
  - `на связи?`
  - `проверь связь`
  - `что ты умеешь?`
  - `зачем ты нужен?`
- Updated sheet schema to include memory/context tabs:
  - `12_Project Context`
  - `13_Brand Rules`
  - `14_Bot Memory`
  - `15_Approved Examples`
  - `16_Rejected Examples`

## Model recommendation
For v0.1 keep:
`OPENAI_MODEL=gpt-4.1-mini`

After the full chain works, upgrade to:
- Router / Storyline / Planner: stronger model
- Caption / formatting / simple summaries: cheaper fast model
