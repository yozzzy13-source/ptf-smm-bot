
# v0.2.0 Visual + Match Log Patch

## Added
- Visual Production Agent
- OpenAI image model config (`OPENAI_IMAGE_MODEL`, `ENABLE_IMAGE_GENERATION`)
- Match log + player master reading architecture
- New Google Sheet tabs:
  - 17_Visual Prompts
  - 18_Match Log Sources
  - 19_Player Master Snapshot
  - 20_Match Log Snapshot
- Dynamic context loading from Sheets memory tabs
- Stronger architecture notes for multi-model setup

## Important
For first stable launch, keep:
- `OPENAI_MODEL=gpt-4.1-mini`
- `ENABLE_IMAGE_GENERATION=false`

After full workflow stability is confirmed, switch to agent-specific models and optionally enable image generation.
