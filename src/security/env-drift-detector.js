'use strict';

const REQUIRED_CORE = [
  'NODE_ENV', 'PORT', 'WEBHOOK_URL', 'TELEGRAM_TOKEN',
  'OWNER_CHAT_ID', 'ADMIN_IDS', 'DASHBOARD_ADMIN_TOKEN',
  'STORAGE_DRIVER', 'DATABASE_URL', 'AI_PROVIDER'
];

const RECOMMENDED = [
  'REDIS_URL', 'APP_PUBLIC_URL', 'HEALTHCHECK_URL',
  'OBSERVABILITY_ENABLED', 'COST_GOVERNANCE_ENABLED',
  'EXECUTOR_APPROVAL_REQUIRED', 'EXTERNAL_WRITE_APPROVAL_REQUIRED',
  'INTEGRATION_EVAL_GATE_REQUIRED', 'GITHUB_PUSH_APPROVAL_REQUIRED',
  'DEPLOY_APPROVAL_REQUIRED', 'ROLLBACK_APPROVAL_REQUIRED',
  'AUTO_APPROVE_ENABLED', 'AUTO_RUN_ENABLED', 'SHELL_EXECUTOR_ENABLED'
];

const OPTIONAL_INTEGRATIONS = [
  'TELEGRAM_TOKEN_PLANNER', 'TELEGRAM_TOKEN_CODER', 'TELEGRAM_TOKEN_CRITIC',
  'TELEGRAM_TOKEN_RESEARCH', 'TELEGRAM_TOKEN_OPS', 'TELEGRAM_TOKEN_SECURITY',
  'TELEGRAM_TOKEN_MEMORY', 'TELEGRAM_TOKEN_EXECUTOR', 'TELEGRAM_TOKEN_REFLECTION',
  'GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO', 'GITHUB_DEFAULT_BRANCH',
  'RENDER_PUBLIC_URL', 'RENDER_SERVICE_ID', 'RENDER_API_KEY',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI',
  'GOOGLE_REFRESH_TOKEN', 'CLOUDFLARE_API_TOKEN',
  'TAVILY_API_KEY', 'OPENWEATHER_API_KEY',
  'GEMINI_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY'
];

function detectEnvDrift(services) {
  const env = services.env || process.env;
  const results = [];
  results.push(...compareEnvAgainstExpectedRegistry(env));
  results.push(...detectDangerousEnvFlags(env));
  results.push(...detectCommonEnvTypos(env));
  return results;
}

function compareEnvAgainstExpectedRegistry(env) {
  const drift = [];
  const allExpected = [...REQUIRED_CORE, ...RECOMMENDED, ...OPTIONAL_INTEGRATIONS];

  for (const name of allExpected) {
    const value = env[name];
    if (value === undefined || value === null || value === '') {
      if (REQUIRED_CORE.includes(name)) {
        drift.push({ envName: name, status: 'missing', severity: 'high', category: 'required', message: `Required env ${name} is not set.` });
      } else if (RECOMMENDED.includes(name)) {
        drift.push({ envName: name, status: 'missing', severity: 'medium', category: 'recommended', message: `Recommended env ${name} is not set.` });
      }
    } else {
      drift.push({ envName: name, status: 'present', severity: 'info', category: REQUIRED_CORE.includes(name) ? 'required' : RECOMMENDED.includes(name) ? 'recommended' : 'optional', message: `${name} is configured.` });
    }
  }

  return drift;
}

function detectDangerousEnvFlags(env) {
  const issues = [];

  if (env.AUTO_APPROVE_ENABLED === 'true' || env.AUTO_APPROVE_ENABLED === true) {
    issues.push({ envName: 'AUTO_APPROVE_ENABLED', status: 'dangerous', severity: 'critical', category: 'safety', message: 'AUTO_APPROVE_ENABLED is true! This disables approval safety.' });
  }
  if (env.AUTO_RUN_ENABLED === 'true' || env.AUTO_RUN_ENABLED === true) {
    issues.push({ envName: 'AUTO_RUN_ENABLED', status: 'dangerous', severity: 'critical', category: 'safety', message: 'AUTO_RUN_ENABLED is true! Actions will run without approval.' });
  }
  if (env.SHELL_EXECUTOR_ENABLED === 'true' || env.SHELL_EXECUTOR_ENABLED === true) {
    issues.push({ envName: 'SHELL_EXECUTOR_ENABLED', status: 'dangerous', severity: 'critical', category: 'safety', message: 'SHELL_EXECUTOR_ENABLED is true! Shell execution is dangerous.' });
  }
  if (!env.DASHBOARD_ADMIN_TOKEN) {
    issues.push({ envName: 'DASHBOARD_ADMIN_TOKEN', status: 'missing_dangerous', severity: 'critical', category: 'safety', message: 'DASHBOARD_ADMIN_TOKEN is not set. Dashboard is unprotected.' });
  }
  if (!env.OWNER_CHAT_ID) {
    issues.push({ envName: 'OWNER_CHAT_ID', status: 'missing_dangerous', severity: 'critical', category: 'safety', message: 'OWNER_CHAT_ID is not set. No owner defined.' });
  }
  if (!env.ADMIN_IDS || env.ADMIN_IDS.trim() === '') {
    issues.push({ envName: 'ADMIN_IDS', status: 'empty', severity: 'high', category: 'safety', message: 'ADMIN_IDS is empty. No admins defined.' });
  }
  if (env.WEBHOOK_URL && env.APP_PUBLIC_URL && env.WEBHOOK_URL !== env.APP_PUBLIC_URL) {
    issues.push({ envName: 'WEBHOOK_URL vs APP_PUBLIC_URL', status: 'mismatch', severity: 'medium', category: 'consistency', message: 'WEBHOOK_URL and APP_PUBLIC_URL do not match.' });
  }
  if (env.RENDER_PUBLIC_URL && env.WEBHOOK_URL && env.RENDER_PUBLIC_URL !== env.WEBHOOK_URL) {
    issues.push({ envName: 'RENDER_PUBLIC_URL vs WEBHOOK_URL', status: 'mismatch', severity: 'medium', category: 'consistency', message: 'RENDER_PUBLIC_URL and WEBHOOK_URL do not match.' });
  }
  if (!env.DATABASE_URL && env.NODE_ENV === 'production') {
    issues.push({ envName: 'DATABASE_URL', status: 'missing_production', severity: 'high', category: 'production', message: 'DATABASE_URL not set in production.' });
  }

  const aiProvider = env.AI_PROVIDER || '';
  if (aiProvider) {
    const providerKeyMap = {
      openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY',
      groq: 'GROQ_API_KEY', mistral: 'MISTRAL_API_KEY',
      tavily: 'TAVILY_API_KEY'
    };
    const keyNeeded = providerKeyMap[aiProvider.toLowerCase()];
    if (keyNeeded && !env[keyNeeded]) {
      issues.push({ envName: keyNeeded, status: 'missing_for_provider', severity: 'high', category: 'ai_provider', message: `${keyNeeded} is not set but AI_PROVIDER is ${aiProvider}.` });
    }
  }

  return issues;
}

const COMMON_TYPOS = [
  { typo: 'TELEGRAM_TOKEN_PLANNE', correct: 'TELEGRAM_TOKEN_PLANNER' },
  { typo: 'DATBASE_URL', correct: 'DATABASE_URL' },
  { typo: 'GITHUB_TOKN', correct: 'GITHUB_TOKEN' },
  { typo: 'DASHBOARD_TOKEN', correct: 'DASHBOARD_ADMIN_TOKEN' },
  { typo: 'ADMIN_TOKEN', correct: 'DASHBOARD_ADMIN_TOKEN' },
  { typo: 'OWNER_ID', correct: 'OWNER_CHAT_ID' },
  { typo: 'REDIS_ULR', correct: 'REDIS_URL' },
  { typo: 'RENDER_KEY', correct: 'RENDER_API_KEY' },
  { typo: 'GOOGLE_SECRET', correct: 'GOOGLE_CLIENT_SECRET' },
  { typo: 'CLOUDFLARE_TOKEN', correct: 'CLOUDFLARE_API_TOKEN' }
];

function detectCommonEnvTypos(env) {
  const issues = [];
  for (const { typo, correct } of COMMON_TYPOS) {
    if (env[typo] !== undefined && env[typo] !== null && env[typo] !== '') {
      issues.push({ envName: typo, status: 'typo', severity: 'medium', category: 'typo', message: `Possible typo: "${typo}" should probably be "${correct}".` });
    }
  }
  return issues;
}

function buildEnvDriftReport(results) {
  const byCategory = {};
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
    if (bySeverity[r.severity]) bySeverity[r.severity]++;
  }

  return {
    totalIssues: results.length,
    totalCritical: bySeverity.critical,
    totalHigh: bySeverity.high,
    byCategory: Object.keys(byCategory).map(c => ({ category: c, count: byCategory[c].length })),
    bySeverity,
    issues: results.map(r => ({
      envName: r.envName,
      status: r.status,
      severity: r.severity,
      category: r.category,
      message: r.message
    }))
  };
}

module.exports = {
  REQUIRED_CORE,
  RECOMMENDED,
  OPTIONAL_INTEGRATIONS,
  detectEnvDrift,
  compareEnvAgainstExpectedRegistry,
  detectDangerousEnvFlags,
  detectCommonEnvTypos,
  buildEnvDriftReport
};
