'use strict';

function readEnv(env = process.env) {
  const telegramToken = env.TELEGRAM_TOKEN;
  const primaryTelegramToken = telegramToken || env.TELEGRAM_TOKEN_ORCHESTRATOR || '';
  const ownerChatId = env.OWNER_CHAT_ID || '';
  const adminIds = env.ADMIN_IDS || '';
  const parsedPort = Number(env.PORT || 10000);
  const dashboardEnabled = String(env.DASHBOARD_ENABLED || '').toLowerCase() === 'true';
  const dashboardAdminToken = env.DASHBOARD_ADMIN_TOKEN || '';
  const dashboardWriteToken = env.DASHBOARD_WRITE_TOKEN || '';
  const dashboardDangerToken = env.DASHBOARD_DANGER_TOKEN || '';
  const userDailyTokenLimit = Number(env.USER_DAILY_TOKEN_LIMIT) || 50000;
  const userHourlyMessageLimit = Number(env.USER_HOURLY_MESSAGE_LIMIT) || 30;

  const dashboardAllowedIps = env.DASHBOARD_ALLOWED_IPS
    ? env.DASHBOARD_ALLOWED_IPS.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const enablePortfolioManager = String(env.ENABLE_PORTFOLIO_MANAGER || '').toLowerCase() === 'true';
  const enableDisasterRecovery = String(env.ENABLE_DISASTER_RECOVERY || '').toLowerCase() === 'true';
  const enableAutonomousLoop = String(env.ENABLE_AUTONOMOUS_LOOP || '').toLowerCase() === 'true';
  const enableMultibot = String(env.ENABLE_MULTIBOT || '').toLowerCase() === 'true';

  const webhookBaseUrl =
    env.WEBHOOK_URL ||
    env.TELEGRAM_WEBHOOK_URL ||
    (env.RENDER_EXTERNAL_HOSTNAME ? `https://${env.RENDER_EXTERNAL_HOSTNAME}` : null);

  const multiBot = {
    TELEGRAM_TOKEN_ORCHESTRATOR: env.TELEGRAM_TOKEN_ORCHESTRATOR,
    TELEGRAM_TOKEN_PLANNER: env.TELEGRAM_TOKEN_PLANNER,
    TELEGRAM_TOKEN_CODER: env.TELEGRAM_TOKEN_CODER,
    TELEGRAM_TOKEN_CRITIC: env.TELEGRAM_TOKEN_CRITIC,
    TELEGRAM_TOKEN_RESEARCH: env.TELEGRAM_TOKEN_RESEARCH,
    TELEGRAM_TOKEN_OPS: env.TELEGRAM_TOKEN_OPS,
    TELEGRAM_TOKEN_SECURITY: env.TELEGRAM_TOKEN_SECURITY,
    TELEGRAM_TOKEN_MEMORY: env.TELEGRAM_TOKEN_MEMORY,
    TELEGRAM_TOKEN_EXECUTOR: env.TELEGRAM_TOKEN_EXECUTOR,
    TELEGRAM_TOKEN_REFLECTION: env.TELEGRAM_TOKEN_REFLECTION,
    TELEGRAM_TOKEN_PLANNE: env.TELEGRAM_TOKEN_PLANNE
  };

  return {
    TELEGRAM_TOKEN: telegramToken,
    PRIMARY_TELEGRAM_TOKEN: primaryTelegramToken,
    ...multiBot,
    TELEGRAM_USERNAME_ORCHESTRATOR: env.TELEGRAM_USERNAME_ORCHESTRATOR,
    TELEGRAM_USERNAME_PLANNER: env.TELEGRAM_USERNAME_PLANNER,
    TELEGRAM_USERNAME_CODER: env.TELEGRAM_USERNAME_CODER,
    TELEGRAM_USERNAME_CRITIC: env.TELEGRAM_USERNAME_CRITIC,
    TELEGRAM_USERNAME_RESEARCH: env.TELEGRAM_USERNAME_RESEARCH,
    TELEGRAM_USERNAME_OPS: env.TELEGRAM_USERNAME_OPS,
    TELEGRAM_USERNAME_SECURITY: env.TELEGRAM_USERNAME_SECURITY,
    TELEGRAM_USERNAME_MEMORY: env.TELEGRAM_USERNAME_MEMORY,
    TELEGRAM_USERNAME_EXECUTOR: env.TELEGRAM_USERNAME_EXECUTOR,
    TELEGRAM_USERNAME_REFLECTION: env.TELEGRAM_USERNAME_REFLECTION,
    TELEGRAM_WEBHOOK_SECRET_ORCHESTRATOR: env.TELEGRAM_WEBHOOK_SECRET_ORCHESTRATOR,
    TELEGRAM_WEBHOOK_SECRET_PLANNER: env.TELEGRAM_WEBHOOK_SECRET_PLANNER,
    TELEGRAM_WEBHOOK_SECRET_CODER: env.TELEGRAM_WEBHOOK_SECRET_CODER,
    TELEGRAM_WEBHOOK_SECRET_CRITIC: env.TELEGRAM_WEBHOOK_SECRET_CRITIC,
    TELEGRAM_WEBHOOK_SECRET_RESEARCH: env.TELEGRAM_WEBHOOK_SECRET_RESEARCH,
    TELEGRAM_WEBHOOK_SECRET_OPS: env.TELEGRAM_WEBHOOK_SECRET_OPS,
    TELEGRAM_WEBHOOK_SECRET_SECURITY: env.TELEGRAM_WEBHOOK_SECRET_SECURITY,
    TELEGRAM_WEBHOOK_SECRET_MEMORY: env.TELEGRAM_WEBHOOK_SECRET_MEMORY,
    TELEGRAM_WEBHOOK_SECRET_EXECUTOR: env.TELEGRAM_WEBHOOK_SECRET_EXECUTOR,
    TELEGRAM_WEBHOOK_SECRET_REFLECTION: env.TELEGRAM_WEBHOOK_SECRET_REFLECTION,
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
    GITHUB_TOKEN: env.GITHUB_TOKEN,
    GITHUB_OWNER: env.GITHUB_OWNER,
    GITHUB_REPO: env.GITHUB_REPO,
    REPO_NAME: env.REPO_NAME,
    CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
    GACOR_API_KEY: env.GACOR_API_KEY,
    GACOR_BASE_URL: env.GACOR_BASE_URL || 'https://rbeafse.abc-tunnel.us/v1',
    GACOR_MODEL: env.GACOR_MODEL || 'gacor',
    NAS_BASE_URL: env.NAS_BASE_URL,
    NAS_HEALTH_URL: env.NAS_HEALTH_URL,
    EXTERNAL_WEBHOOK_URL: env.EXTERNAL_WEBHOOK_URL,
    WEBHOOK_SHARED_SECRET: env.WEBHOOK_SHARED_SECRET,
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
    WEBHOOK_PATH: telegramToken ? `/webhook/${telegramToken}` : '/webhook/legacy-disabled',
    TELEGRAM_API: primaryTelegramToken ? `https://api.telegram.org/bot${primaryTelegramToken}` : null,

    USER_DAILY_TOKEN_LIMIT: userDailyTokenLimit,
    USER_HOURLY_MESSAGE_LIMIT: userHourlyMessageLimit,
    DASHBOARD_ALLOWED_IPS: dashboardAllowedIps,

    ENABLE_PORTFOLIO_MANAGER: enablePortfolioManager,
    ENABLE_DISASTER_RECOVERY: enableDisasterRecovery,
    ENABLE_AUTONOMOUS_LOOP: enableAutonomousLoop,
    ENABLE_MULTIBOT: enableMultibot,

    ALERT_ENABLED: String(env.ALERT_ENABLED || '').toLowerCase() !== 'false',
    ALERT_MIN_LEVEL: env.ALERT_MIN_LEVEL || 'warning'
  };
}

function validateConfig(config) {
  if (!config.PRIMARY_TELEGRAM_TOKEN) {
    throw new Error('TELEGRAM_TOKEN atau TELEGRAM_TOKEN_ORCHESTRATOR tidak ditemukan');
  }

  if (!config.MISTRAL_API_KEY && !config.GROQ_API_KEY) {
    throw new Error('Set minimal MISTRAL_API_KEY atau GROQ_API_KEY');
  }
}

module.exports = {
  readEnv,
  validateConfig
};
