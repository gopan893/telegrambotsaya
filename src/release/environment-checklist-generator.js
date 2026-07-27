'use strict';

const utils = require('./release-utils');

const REQUIRED_ENV = [
  'NODE_ENV',
  'PORT',
  'WEBHOOK_URL',
  'TELEGRAM_TOKEN',
  'OWNER_CHAT_ID',
  'ADMIN_IDS',
  'DASHBOARD_ADMIN_TOKEN',
  'STORAGE_DRIVER',
  'DATABASE_URL',
  'AI_PROVIDER'
];

const RECOMMENDED_ENV = [
  'REDIS_URL',
  'APP_PUBLIC_URL',
  'HEALTHCHECK_URL',
  'OBSERVABILITY_ENABLED',
  'COST_GOVERNANCE_ENABLED',
  'EXECUTOR_APPROVAL_REQUIRED',
  'EXTERNAL_WRITE_APPROVAL_REQUIRED',
  'INTEGRATION_EVAL_GATE_REQUIRED',
  'GITHUB_PUSH_APPROVAL_REQUIRED',
  'DEPLOY_APPROVAL_REQUIRED',
  'ROLLBACK_APPROVAL_REQUIRED',
  'AUTO_APPROVE_ENABLED',
  'AUTO_RUN_ENABLED',
  'SHELL_EXECUTOR_ENABLED'
];

const OPTIONAL_ENV = [
  'BOT_2_TOKEN',
  'BOT_3_TOKEN',
  'BOT_4_TOKEN',
  'GITHUB_TOKEN',
  'GITHUB_REPO',
  'GITHUB_OWNER',
  'RENDER_API_KEY',
  'RENDER_SERVICE_ID',
  'RENDER_DEPLOY_HOOK_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'GMAIL_USER',
  'CALENDAR_ID',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_TUNNEL_ID',
  'SEARCH_API_KEY',
  'WEATHER_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GEMINI_KEY'
];

async function generateFinalEnvironmentChecklist(services = {}) {
  const env = services.env || process.env || {};

  const required = await classifyRequiredEnv(services);
  const recommended = await classifyRecommendedEnv(services);
  const optional = await classifyOptionalEnv(services);
  const dangerous = await detectDangerousEnvFlagStatus(services);

  return {
    title: 'Final Environment Variable Checklist',
    required,
    recommended,
    optional,
    dangerousFlags: dangerous,
    envSetupGuide: await buildEnvSetupGuide(services),
    timestamp: utils.formatTimestamp()
  };
}

async function classifyRequiredEnv(services = {}) {
  const env = services.env || process.env || {};
  return REQUIRED_ENV.map(name => ({
    name,
    configured: Boolean(env[name]),
    status: Boolean(env[name]) ? 'configured' : 'missing',
    required: true
  }));
}

async function classifyRecommendedEnv(services = {}) {
  const env = services.env || process.env || {};
  return RECOMMENDED_ENV.map(name => ({
    name,
    configured: Boolean(env[name]),
    status: Boolean(env[name]) ? 'configured' : 'not_set',
    recommended: true,
    expectedValue: name.endsWith('_ENABLED') ? 'false' : undefined
  }));
}

async function classifyOptionalEnv(services = {}) {
  const env = services.env || process.env || {};
  return OPTIONAL_ENV.map(name => ({
    name,
    configured: Boolean(env[name]),
    status: Boolean(env[name]) ? 'configured' : 'not_set',
    optional: true
  }));
}

async function detectDangerousEnvFlagStatus(services = {}) {
  const env = services.env || process.env || {};
  const flags = [];

  const dangerousFlags = {
    AUTO_APPROVE_ENABLED: { severity: 'critical', expected: 'false' },
    AUTO_RUN_ENABLED: { severity: 'critical', expected: 'false' },
    SHELL_EXECUTOR_ENABLED: { severity: 'critical', expected: 'false' },
    DANGEROUS_DEV_MODE: { severity: 'high', expected: 'false' },
    BYPASS_EVALUATION: { severity: 'critical', expected: 'false' },
    BYPASS_APPROVAL: { severity: 'critical', expected: 'false' }
  };

  for (const [name, config] of Object.entries(dangerousFlags)) {
    const value = String(env[name] || '').toLowerCase();
    if (value === 'true') {
      flags.push({
        name,
        value: '[REDACTED]',
        severity: config.severity,
        expected: config.expected,
        status: 'dangerous',
        message: `${name} is set to true! Expected: ${config.expected}`
      });
    }
  }

  const knownTypos = ['TELEGRAM_TOKEN_PLANNE', 'TELEGRAM_TOKEN_PLANNED', 'DATABSE_URL', 'DATBASE_URL'];
  for (const typo of knownTypos) {
    if (env[typo]) {
      flags.push({
        name: typo,
        value: '[REDACTED]',
        severity: 'warning',
        expected: 'not set',
        status: 'typo',
        message: `Possible typo: ${typo} found in env (did you mean the correct variable name?)`
      });
    }
  }

  return flags;
}

async function buildEnvSetupGuide(services = {}) {
  return {
    production: [
      'Copy .env.example to .env',
      'Set required variables: NODE_ENV, PORT, WEBHOOK_URL, TELEGRAM_TOKEN, OWNER_CHAT_ID, ADMIN_IDS',
      'Set DASHBOARD_ADMIN_TOKEN to a secure random string',
      'Set STORAGE_DRIVER=postgres and configure DATABASE_URL',
      'Set AI_PROVIDER and corresponding API key',
      'Ensure AUTO_APPROVE_ENABLED=false, AUTO_RUN_ENABLED=false, SHELL_EXECUTOR_ENABLED=false',
      '(Recommended) Configure REDIS_URL for caching',
      '(Recommended) Set APP_PUBLIC_URL and HEALTHCHECK_URL',
      '(Optional) Configure GitHub, Render, Google, Cloudflare tokens as needed'
    ],
    verification: [
      'Run "node --check telebot.js" to verify syntax',
      'Start bot and verify health endpoint responds at /health',
      'Open dashboard at /dashboard and verify all tabs load',
      'Verify Telegram bot responds to /start and /help',
      'Run "npm test" or individual scratch tests'
    ],
    render: [
      'Set all environment variables in Render dashboard',
      'Ensure build command is "npm install"',
      'Ensure start command is "node telebot.js"',
      'Verify WEBHOOK_URL matches your Render service URL + /webhook'
    ]
  };
}

module.exports = {
  generateFinalEnvironmentChecklist,
  classifyRequiredEnv,
  classifyRecommendedEnv,
  classifyOptionalEnv,
  detectDangerousEnvFlagStatus,
  buildEnvSetupGuide,
  REQUIRED_ENV,
  RECOMMENDED_ENV,
  OPTIONAL_ENV
};
