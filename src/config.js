import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name, fallback = '') {
  return process.env[name] || fallback;
}

export const config = {
  port: Number(optional('PORT', '3000')),
  nodeEnv: optional('NODE_ENV', 'development'),
  logLevel: optional('LOG_LEVEL', optional('NODE_ENV', 'development') === 'production' ? 'info' : 'debug'),
  publicBaseUrl: optional('PUBLIC_BASE_URL'),
  webhookSecret: optional('WEBHOOK_SECRET', 'local-dev-secret'),
  adminTelegramUserIds: optional('ADMIN_TELEGRAM_USER_IDS')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
  timezone: optional('DEFAULT_TIMEZONE', 'Asia/Bangkok'),

  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),

  openaiApiKey: required('OPENAI_API_KEY'),
  openaiModel: optional('OPENAI_MODEL', 'gpt-4.1-mini'),

  spreadsheetId: required('GOOGLE_SHEETS_SPREADSHEET_ID'),
  googleServiceAccountBase64: required('GOOGLE_SERVICE_ACCOUNT_BASE64'),
  googleDriveMediaRoot: optional('GOOGLE_DRIVE_MEDIA_ROOT'),

  dryRun: optional('DRY_RUN', 'false') === 'true',
  enableAutoTelegramPublish: optional('ENABLE_AUTO_TELEGRAM_PUBLISH', 'false') === 'true',
  autoSetupSheets: optional('AUTO_SETUP_SHEETS', 'true') === 'true',
  dailyPackHour: Number(optional('DAILY_PACK_HOUR', '13')),
  dailyPackTelegramChatId: optional('DAILY_PACK_TELEGRAM_CHAT_ID'),
  eveningPublishWindow: optional('EVENING_PUBLISH_WINDOW', '18:00-21:00')
};
