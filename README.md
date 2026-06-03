# PTF SMM Bot v0.3.0

Strategic AI SMM OS for Phuket Tennis Family.

## What changed in v0.3
- Strategic SMM Director Agent.
- Event Lifecycle Planner with pre-event / match-day / live / post-event tail logic.
- User Action Tasks: what Kostya should shoot, say, record, ask players.
- Stronger Publication Schedule logic and lifecycle depth fallback.
- Sponsor / Product / Ecosystem strategy tables.
- Image generation support through GPT Image models, with optional Drive upload.
- Google Sheets auto-migration: new tabs are created by the bot on deploy.

## Recommended models
Use only models available in your OpenAI API account.

Fast launch:
```env
OPENAI_MODEL=gpt-4.1-mini
OPENAI_ROUTER_MODEL=gpt-4.1-mini
OPENAI_STRATEGIC_MODEL=gpt-4.1-mini
OPENAI_CREATIVE_MODEL=gpt-4.1-mini
OPENAI_ANALYST_MODEL=gpt-4.1-mini
ENABLE_IMAGE_GENERATION=false
```

Production test:
```env
OPENAI_ROUTER_MODEL=gpt-4.1-mini
OPENAI_STRATEGIC_MODEL=gpt-5.5
OPENAI_CREATIVE_MODEL=gpt-5.5
OPENAI_ANALYST_MODEL=gpt-5.5
OPENAI_FAST_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-2
ENABLE_IMAGE_GENERATION=true
MAX_IMAGES_PER_REQUEST=2
GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID=<Drive folder ID>
```

If `gpt-5.5` or `gpt-image-2` is not available in your API account, set those env vars to models you have access to.

## First v0.3 tests
1. `на связи?`
2. `через два с половиной дня у нас матч Robin Vercaemer против Chris Mitchell в 17.00 The Peak Racquet Park. Подготовь контент-план и необходимый контент вместе с временем публикации и всем необходимым`
3. `Сделай стратегию контента на ближайшие 2 недели с учетом лиги, игроков, спонсоров и будущих турниров`
4. `Сделай классный рекап двух месяцев лиги: найди интересные события, игроков, цифры и разложи это в контент-план`

## Important
The bot still does not autopost. It creates plans, assets, visual prompts/images, drafts, user tasks and schedule for approval.
