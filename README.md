# PTF SMM Bot — MVP v1

Telegram text → AI Command Router → Google Sheets → Content plan/drafts.

This MVP is intentionally built **without Postgres**. Google Sheets is both the working database and the human dashboard. The code still uses service layers so we can later replace Sheets with Postgres.

## What this MVP does

- Receives Telegram text messages through webhook.
- Understands Russian, English, or mixed text.
- Replies to the owner in Russian.
- Generates public PTF content drafts in English.
- Creates event campaign tasks in Google Sheets.
- Creates Telegram/Instagram/poster drafts.
- Logs every important step in `09_System Logs`.
- Deduplicates Telegram updates in `10_Dedup`.
- Saves persistent user feedback in `11_Feedback Rules`.
- Keeps autoposting disabled by default.

## Current system logic

```txt
Telegram text
→ Node.js backend on Railway
→ AI Command Router
→ Agents
→ Google Sheets
→ Telegram reply
```

## Google Sheet

Created Sheet: `PTF SMM OS`

Required tabs:

- `01_Content Calendar`
- `02_Events Matches`
- `03_Players Content`
- `04_Assets Library`
- `05_Storylines`
- `06_Templates`
- `07_Published Archive`
- `08_Partners Scouting`
- `09_System Logs`
- `10_Dedup`
- `11_Feedback Rules`

Run:

```bash
npm run setup:sheet
```

## Deployment checklist

### 1. Create Telegram bot

Open `@BotFather` in Telegram:

1. `/newbot`
2. Save the bot token.
3. Add token as `TELEGRAM_BOT_TOKEN` in Railway.

### 2. Create Google Cloud service account

1. Create service account in Google Cloud.
2. Enable Google Sheets API.
3. Download JSON key.
4. Base64 encode the JSON:

```bash
base64 -i service-account.json
```

5. Put result into `GOOGLE_SERVICE_ACCOUNT_BASE64`.
6. Share the Google Sheet with the service account email as Editor.

### 3. Create Railway project

1. Create a new Railway project.
2. Deploy from GitHub repo.
3. Add environment variables from `.env.example`.
4. Set `PUBLIC_BASE_URL` to Railway public domain.
5. Run `npm run setup:sheet` once.
6. Run `npm run set:webhook` once.

### 4. Test in Telegram

Send:

```txt
Сделай контент-план под матч Chris Mitchell vs Robin Vercaemer 6 июня в 17:00 на The Peak, Division PRIME. Нужны анонс, сторис и постер.
```

Expected result:

- Bot replies with campaign summary.
- Rows appear in Events/Content Calendar.
- Logs appear in System Logs.

## Environment variables

See `.env.example`.

## Google Drive folder structure

Create manually for now:

```txt
Phuket Tennis Family — Media OS
  01_Brand Assets
    Logos
    Player Cards
    Fonts and Colors
    Poster References
    AI Image Prompts
  02_Season 1
    Matches
    Weekly Recaps
    Playoffs and Finals
  03_Events
    2026-06-06 Chris Mitchell vs Robin Vercaemer
  04_Players
    Chris Mitchell
      Raw Footage
      Selected Clips
      Profile Reel
      Voice Answers
      Player Card
      Published
    Robin Vercaemer
      Raw Footage
      Selected Clips
      Profile Reel
      Voice Answers
      Player Card
      Published
  05_Content Production
    Need Edit
    In Review
    Ready to Publish
    Captions and Drafts
  06_Published Archive
    Instagram Reels
    Instagram Stories
    Telegram Posts
    YouTube
  07_Templates
    Captions
    Telegram Posts
    Poster Prompts
    Reel Structures
  08_Partners
  99_Backup Links
```

## MVP limitations

- No voice-to-text yet. Use iPhone dictation and send text.
- No autoposting yet.
- No Instagram API yet.
- No YouTube API yet.
- No automatic video editing yet.
- Google Sheets is the source of truth for MVP.

## Design principles

- AI prepares, owner approves.
- Public content is English.
- Bot interaction with owner can be Russian.
- Players/community are heroes.
- League is the structure, not the emotional hero.
- Avoid duplicate content and overposting similar categories.

## Next modules

1. Google Drive upload/link integration.
2. Daily Content Pack scheduler.
3. Storyline Agent reading real match history.
4. Approval buttons in Telegram.
5. Instagram scheduler/API.
6. Postgres migration.
