'use strict';

function readEnv(env = process.env) {
  const telegramToken = env.TELEGRAM_TOKEN;
  const ownerChatId = env.OWNER_CHAT_ID || '';
  const adminIds = env.ADMIN_IDS || '';
  const parsedPort = Number(env.PORT || 10000);
  const dashboardEnabled = String(env.DASHBOARD_ENABLED || '').toLowerCase() === 'true';
  const dashboardAdminToken = env.DASHBOARD_ADMIN_TOKEN || '';
  const dashboardWriteToken = env.DASHBOARD_WRITE_TOKEN || '';
  const dashboardDangerToken = env.DASHBOARD_DANGER_TOKEN || '';
  const webhookBaseUrl =
    env.WEBHOOK_URL ||
    env.TELEGRAM_WEBHOOK_URL ||
    (env.RENDER_EXTERNAL_HOSTNAME ? `https://${env.RENDER_EXTERNAL_HOSTNAME}` : null);

  return {
    TELEGRAM_TOKEN: telegramToken,
    MISTRAL_API_KEY: env.MISTRAL_API_KEY,
    GROQ_API_KEY: env.GROQ_API_KEY,
    TAVILY_API_KEY: env.TAVILY_API_KEY,
    OPENWEATHER_API_KEY: env.OPENWEATHER_API_KEY,
    DATABASE_URL: env.DATABASE_URL,
    STORAGE_DRIVER: env.STORAGE_DRIVER,
    REDIS_URL: env.REDIS_URL,
    PGSSL: env.PGSSL,
    RUN_MIGRATIONS: env.RUN_MIGRATIONS,
    DASHBOARD_ENABLED: dashboardEnabled,
    DASHBOARD_ADMIN_TOKEN: dashboardAdminToken,
    DASHBOARD_WRITE_TOKEN: dashboardWriteToken,
    DASHBOARD_DANGER_TOKEN: dashboardDangerToken,
    dashboard: {
      enabled: dashboardEnabled,
      adminToken: dashboardAdminToken,
      writeToken: dashboardWriteToken,
      dangerToken: dashboardDangerToken,
      tokenConfigured: Boolean(dashboardAdminToken || dashboardWriteToken || dashboardDangerToken)
    },
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
    WEBHOOK_URL: env.WEBHOOK_URL,
    TELEGRAM_WEBHOOK_URL: env.TELEGRAM_WEBHOOK_URL,
    PORT: Number.isFinite(parsedPort) ? parsedPort : 10000,
    RENDER_EXTERNAL_HOSTNAME: env.RENDER_EXTERNAL_HOSTNAME,
    OWNER_CHAT_ID: ownerChatId,
    ADMIN_IDS: adminIds,
    ADMIN_SET: new Set(
      `${ownerChatId},${adminIds}`
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    ),
    WEBHOOK_BASE_URL: webhookBaseUrl,
    WEBHOOK_PATH: telegramToken ? `/webhook/${telegramToken}` : null,
    TELEGRAM_API: telegramToken ? `https://api.telegram.org/bot${telegramToken}` : null
  };
}

function validateConfig(config) {
  if (!config.TELEGRAM_TOKEN) {
    throw new Error('TELEGRAM_TOKEN tidak ditemukan');
  }

  if (!config.MISTRAL_API_KEY && !config.GROQ_API_KEY) {
    throw new Error('Set minimal MISTRAL_API_KEY atau GROQ_API_KEY');
  }
}

module.exports = {
  readEnv,
  validateConfig
};
