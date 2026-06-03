
# PTF SMM Bot Architecture v0.2.0

## Core idea
Natural-language Telegram bot for Phuket Tennis Family.
The user writes in Russian or English. The bot understands intent, plans content, proposes visuals, reads source-of-truth league data, and writes everything to Google Sheets.

## Agent roles
- **AI Router** — understands free-form user requests and decides what workflow to run.
- **Content Planner Agent** — creates the campaign/content task structure.
- **Caption Agent** — creates English public-facing drafts.
- **Visual Production Agent** — decides which visual assets are needed and produces generation-ready prompts. Optional OpenAI image generation can be enabled.
- **Storyline Agent** — reads match-log context and finds story-driven content hooks.
- **Feedback & Memory Agent** — stores user rules and style corrections.

## Model architecture
For fast launch, one model can power all agents:
- `OPENAI_MODEL=gpt-4.1-mini`

Recommended production split:
- `OPENAI_ROUTER_MODEL` — stronger reasoning model.
- `OPENAI_CREATIVE_MODEL` — stronger creative/planning model.
- `OPENAI_FAST_MODEL` — quick utility tasks.
- `OPENAI_STRUCTURE_MODEL` — cheap structured formatting.
- `OPENAI_IMAGE_MODEL=gpt-image-1` — visual generation.

## Source-of-truth data
- Website is a showcase layer.
- Match Log / Player Master sheets are the source of truth.
- Storyline analysis should use match log and player master, not website scraping.

## Google Sheet tabs
Main operating sheet includes content calendar, events, storylines, context memory, visual prompts, and source registry.
