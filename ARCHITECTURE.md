# Architecture

## MVP v1

```txt
Telegram Bot
  receives text
  sends replies

Express Webhook Server
  validates update
  deduplicates by update/chat/message ID
  routes text to orchestrator

AI Command Router
  classifies intent
  extracts structured data
  asks clarification if confidence low

Agents
  Content Planner Agent
  Caption Agent
  Feedback & Memory Agent
  Daily Content Assistant
  Storyline Agent MVP placeholder

Storage
  Google Sheets via service account

Logs
  Railway logs
  Google Sheet: 09_System Logs
```

## Core components

### AI Command Router

Reads free-form text and returns structured JSON:

- intent
- confidence
- extracted event fields
- missing critical fields
- next agents

### Orchestrator

Runs agents in sequence. Agents do not talk to each other directly in MVP.

### Content Planner Agent

Creates campaign tasks around events.

### Caption Agent

Creates English Telegram/Instagram/Story/Poster drafts.

### Feedback Agent

Decides whether owner feedback should become a persistent rule.

### Dedup Service

Prevents repeated Telegram updates from creating duplicate events/tasks.

## Later migration to Postgres

Replace `sheetsStorage.js` with a Postgres-backed storage implementation while keeping agent/orchestrator APIs mostly unchanged.
