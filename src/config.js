import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name, fallback = '') {
  return process.env[name] || fallback;
}

const defaultModel = optional('OPENAI_MODEL', 'gpt-4.1-mini');

export const config = {
  port: Number(optional('PORT', '3000')),
  nodeEnv: optional('NODE_ENV', 'development'),
  logLevel: optional('LOG_LEVEL', optional('NODE_ENV', 'development') === 'production' ? 'info' : 'debug'),
  publicBaseUrl: optional('PUBLIC_BASE_URL'),
  webhookSecret: optional('WEBHOOK_SECRET', 'local-dev-secret'),
  adminTelegramUserIds: optional('ADMIN_TELEGRAM_USER_IDS').split(',').map((x) => x.trim()).filter(Boolean),
  timezone: optional('DEFAULT_TIMEZONE', 'Asia/Bangkok'),

  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),

  openaiApiKey: required('OPENAI_API_KEY'),
  openaiModel: defaultModel,
  openaiRouterModel: optional('OPENAI_ROUTER_MODEL', defaultModel),
  openaiStrategicModel: optional('OPENAI_STRATEGIC_MODEL', optional('OPENAI_CREATIVE_MODEL', defaultModel)),
  openaiCreativeModel: optional('OPENAI_CREATIVE_MODEL', defaultModel),
  openaiAnalystModel: optional('OPENAI_ANALYST_MODEL', optional('OPENAI_STRATEGIC_MODEL', defaultModel)),
  openaiFastModel: optional('OPENAI_FAST_MODEL', defaultModel),
  openaiStructureModel: optional('OPENAI_STRUCTURE_MODEL', defaultModel),
  openaiImageModel: optional('OPENAI_IMAGE_MODEL', 'gpt-image-2'),
  openaiImageSize: optional('OPENAI_IMAGE_SIZE', '1024x1536'),
  openaiImageQuality: optional('OPENAI_IMAGE_QUALITY', 'medium'),
  openaiImageFormat: optional('OPENAI_IMAGE_FORMAT', 'png'),
  enableImageGeneration: optional('ENABLE_IMAGE_GENERATION', 'false') === 'true',
  maxImagesPerRequest: Number(optional('MAX_IMAGES_PER_REQUEST', '2')),

  spreadsheetId: required('GOOGLE_SHEETS_SPREADSHEET_ID'),
  googleServiceAccountBase64: required('GOOGLE_SERVICE_ACCOUNT_BASE64'),
  googleDriveMediaRoot: optional('GOOGLE_DRIVE_MEDIA_ROOT'),
  googleDriveMediaRootFolderId: optional('GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID', optional('GOOGLE_DRIVE_MEDIA_ROOT')),

  matchLogSpreadsheetId: optional('MATCH_LOG_SPREADSHEET_ID', required('GOOGLE_SHEETS_SPREADSHEET_ID')),
  matchLogSheetName: optional('MATCH_LOG_SHEET_NAME', 'Cross_Division_Match_Log'),
  playerMasterSpreadsheetId: optional('PLAYER_MASTER_SPREADSHEET_ID', optional('MATCH_LOG_SPREADSHEET_ID', required('GOOGLE_SHEETS_SPREADSHEET_ID'))),
  playerMasterSheetName: optional('PLAYER_MASTER_SHEET_NAME', 'Players_Master'),
  websiteBaseUrl: optional('PTF_WEBSITE_URL', 'https://ptf.softr.app'),

  dryRun: optional('DRY_RUN', 'false') === 'true',
  enableAutoTelegramPublish: optional('ENABLE_AUTO_TELEGRAM_PUBLISH', 'false') === 'true',
  sendGeneratedImagesToTelegram: optional('SEND_GENERATED_IMAGES_TO_TELEGRAM', 'true') === 'true',
  telegramMaxMediaSend: Number(optional('TELEGRAM_MAX_MEDIA_SEND', '2')),
  autoSetupSheets: optional('AUTO_SETUP_SHEETS', 'true') === 'true',
  seedStrategicDefaults: optional('SEED_STRATEGIC_DEFAULTS', 'true') === 'true',
  dailyPackHour: Number(optional('DAILY_PACK_HOUR', '13')),
  dailyPackTelegramChatId: optional('DAILY_PACK_TELEGRAM_CHAT_ID'),
  eveningPublishWindow: optional('EVENING_PUBLISH_WINDOW', '18:00-21:00')
};
