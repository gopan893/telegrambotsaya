'use strict';

function readEnv(env = process.env) {
  const telegramToken = env.TELEGRAM_TOKEN;
  const ownerChatId = env.OWNER_CHAT_ID || '';
  const adminIds = env.ADMIN_IDS || '';
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
    REDIS_URL: env.REDIS_URL,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
    WEBHOOK_URL: env.WEBHOOK_URL,
    TELEGRAM_WEBHOOK_URL: env.TELEGRAM_WEBHOOK_URL,
    PORT: Number(env.PORT || 10000),
    RENDER_EXTERNAL_HOSTNAME: env.RENDER_EXTERNAL_HOSTNAME,
    OWNER_CHAT_ID: ownerChatId,
    ADMIN_IDS: adminIds,
    ADMIN_SET: new Set(
      String(ownerChatId || adminIds)
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
