
# PTF SMM Bot v0.2.0

AI-powered Telegram bot for Phuket Tennis Family.

## What it does
- Understands natural-language Telegram messages in Russian/English.
- Builds event campaigns and content calendars.
- Produces English drafts for Telegram / Instagram.
- Decides which visuals are needed: poster, story card, carousel cover, Telegram cover, thumbnail, etc.
- Saves visual prompts to Google Sheets.
- Reads match-log and player master sheets as source-of-truth context for storyline analysis.
- Stores project context, brand rules, and bot memory in Google Sheets.

## Quick deploy
Use the `.env.example` file and Railway.

Important env vars:
- `TELEGRAM_BOT_TOKEN`
- `WEBHOOK_SECRET`
- `PUBLIC_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-4.1-mini` for first launch
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_BASE64`
- `MATCH_LOG_SPREADSHEET_ID`
- `MATCH_LOG_SHEET_NAME`
- `PLAYER_MASTER_SPREADSHEET_ID`
- `PLAYER_MASTER_SHEET_NAME`
- `OPENAI_IMAGE_MODEL=gpt-image-1`
- `ENABLE_IMAGE_GENERATION=false` (turn on later)

## First tests
1. `на связи?`
2. `Сделай контент-план под матч Chris Mitchell vs Robin Vercaemer 6 июня в 17:00 на The Peak, Division PRIME. Нужны анонс, сторис, Telegram, постер и обложка.`
3. `Найди storylines по последним матчам и предложи 3 контент-идеи.`
