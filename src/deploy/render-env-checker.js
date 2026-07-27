'use strict';

const utils = require('./deploy-utils');
const store = require('./deploy-release-store');

const REQUIRED_ENV_NAMES = [
  'TELEGRAM_TOKEN',
  'OWNER_CHAT_ID',
  'DASHBOARD_ADMIN_TOKEN',
  'PORT'
];

const OPTIONAL_ENV_NAMES = [
  'REDIS_URL',
  'TELEGRAM_TOKEN_PLANNER',
  'TELEGRAM_TOKEN_CODER',
  'TELEGRAM_TOKEN_CRITIC',
  'GITHUB_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CLOUDFLARE_API_TOKEN',
  'TAVILY_API_KEY',
  'OPENWEATHER_API_KEY',
  'MISTRAL_API_KEY',
  'GROQ_API_KEY',
  'WEBHOOK_URL',
  'DATABASE_URL',
  'RENDER_EXTERNAL_HOSTNAME'
];

function checkRenderRequiredEnvNames(services) {
  const env = services?.env || process.env;
  const checks = REQUIRED_ENV_NAMES.map(name => ({
    envName: name,
    required: true,
    present: Boolean(env[name]),
    ok: Boolean(env[name]),
    note: env[name] ? 'set' : 'MISSING'
  }));

  const report = {
    ok: checks.every(c => c.ok),
    checks,
    summary: checks.every(c => c.ok)
      ? 'All required env vars set'
      : `Missing: ${checks.filter(c => !c.ok).map(c => c.envName).join(', ')}`,
    timestamp: utils.now()
  };

  store.addDeployGate(report);
  return report;
}

function checkRenderOptionalEnvNames(services) {
  const env = services?.env || process.env;
  const checks = OPTIONAL_ENV_NAMES.map(name => ({
    envName: name,
    required: false,
    present: Boolean(env[name]),
    ok: true,
    note: env[name] ? 'set' : 'not set (optional)'
  }));

  const report = {
    ok: true,
    checks,
    summary: `${checks.filter(c => c.present).length}/${checks.length} optional vars set`,
    timestamp: utils.now()
  };

  return report;
}

function buildRenderEnvSetupGuide(services) {
  return {
    ok: true,
    required: REQUIRED_ENV_NAMES.map(n => ({ envName: n })),
    optional: OPTIONAL_ENV_NAMES.map(n => ({ envName: n })),
    guide: [
      '# Render Env Setup Guide',
      '',
      '## Required (app will not start without these)',
      ...REQUIRED_ENV_NAMES.map(n => `- ${n}`),
      '',
      '## Optional (features degrade gracefully if missing)',
      ...OPTIONAL_ENV_NAMES.map(n => `- ${n}`),
      '',
      '## Notes',
      '- PORT is set automatically by Render',
      '- WEBHOOK_URL can use RENDER_EXTERNAL_HOSTNAME fallback',
      '- Never commit .env files',
      '- Use Render Dashboard > Environment to set values'
    ].join('\n')
  };
}

function detectEnvCrashRisk(services) {
  const env = services?.env || process.env;
  const risks = [];

  if (!env.TELEGRAM_TOKEN) risks.push('TELEGRAM_TOKEN missing — app cannot connect to Telegram');
  if (!env.DASHBOARD_ADMIN_TOKEN) risks.push('DASHBOARD_ADMIN_TOKEN missing — dashboard login blocked');
  if (!env.OWNER_CHAT_ID) risks.push('OWNER_CHAT_ID missing — admin commands may fail');

  if (!env.MISTRAL_API_KEY && !env.GROQ_API_KEY) {
    risks.push('No AI API key set — AI features will not work (app continues)');
  }

  if (!env.WEBHOOK_URL && !env.RENDER_EXTERNAL_HOSTNAME) {
    risks.push('No webhook URL — set WEBHOOK_URL or RENDER_EXTERNAL_HOSTNAME for Telegram integration');
  }

  return {
    ok: risks.length === 0,
    degraded: risks.filter(r => !r.includes('TELEGRAM_TOKEN') && !r.includes('DASHBOARD_ADMIN_TOKEN')),
    blockers: risks.filter(r => r.includes('TELEGRAM_TOKEN') || r.includes('DASHBOARD_ADMIN_TOKEN')),
    risks,
    timestamp: utils.now()
  };
}

module.exports = {
  checkRenderRequiredEnvNames,
  checkRenderOptionalEnvNames,
  buildRenderEnvSetupGuide,
  detectEnvCrashRisk,
  REQUIRED_ENV_NAMES,
  OPTIONAL_ENV_NAMES
};
