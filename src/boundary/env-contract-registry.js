'use strict';

const utils = require('./config-boundary-utils');

const ENV_CONTRACTS = [
  { name: 'NODE_ENV', category: 'runtime', requiredFor: ['core'], requiredInProduction: true, sensitive: false, defaultSafeValue: 'development', allowedValues: ['development', 'production', 'test'], dangerousIfTrue: false, description: 'Runtime environment mode' },
  { name: 'PORT', category: 'network', requiredFor: ['dashboard'], requiredInProduction: true, sensitive: false, defaultSafeValue: '3000', allowedValues: null, dangerousIfTrue: false, description: 'HTTP server port' },
  { name: 'HOST', category: 'network', requiredFor: ['dashboard'], requiredInProduction: false, sensitive: false, defaultSafeValue: '0.0.0.0', allowedValues: null, dangerousIfTrue: false, description: 'HTTP server host' },
  { name: 'DATABASE_URL', category: 'storage', requiredFor: ['core', 'agents', 'lifeos', 'knowledge'], requiredInProduction: true, sensitive: true, defaultSafeValue: null, allowedValues: null, dangerousIfTrue: false, description: 'PostgreSQL connection string' },
  { name: 'REDIS_URL', category: 'storage', requiredFor: ['dashboard', 'telegram-control'], requiredInProduction: true, sensitive: true, defaultSafeValue: null, allowedValues: null, dangerousIfTrue: false, description: 'Redis connection string' },
  { name: 'REDIS_PREFIX', category: 'storage', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: 'saya', allowedValues: null, dangerousIfTrue: false, description: 'Redis key prefix' },
  { name: 'REDIS_TTL', category: 'storage', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: '3600', allowedValues: null, dangerousIfTrue: false, description: 'Redis default TTL seconds' },
  { name: 'PG_POOL_SIZE', category: 'storage', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: '10', allowedValues: null, dangerousIfTrue: false, description: 'PostgreSQL pool size' },
  { name: 'PG_MAX_CLIENTS', category: 'storage', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: '20', allowedValues: null, dangerousIfTrue: false, description: 'PostgreSQL max clients' },
  { name: 'PG_IDLE_TIMEOUT', category: 'storage', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: '30000', allowedValues: null, dangerousIfTrue: false, description: 'PostgreSQL idle timeout ms' },
  { name: 'JSON_FALLBACK_DIR', category: 'storage', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: './data/fallback', allowedValues: null, dangerousIfTrue: false, description: 'JSON fallback storage directory' },
  { name: 'TELEGRAM_BOT_TOKEN', category: 'auth', requiredFor: ['telegram-control'], requiredInProduction: true, sensitive: true, defaultSafeValue: null, allowedValues: null, dangerousIfTrue: false, description: 'Telegram bot API token' },
  { name: 'TELEGRAM_ALLOWED_USERNAMES', category: 'auth', requiredFor: ['telegram-control'], requiredInProduction: false, sensitive: false, defaultSafeValue: '', allowedValues: null, dangerousIfTrue: false, description: 'Comma-separated allowed usernames' },
  { name: 'TELEGRAM_ADMIN_IDS', category: 'auth', requiredFor: ['telegram-control'], requiredInProduction: false, sensitive: false, defaultSafeValue: '', allowedValues: null, dangerousIfTrue: false, description: 'Comma-separated admin user IDs' },
  { name: 'SESSION_SECRET', category: 'auth', requiredFor: ['dashboard'], requiredInProduction: true, sensitive: true, defaultSafeValue: null, allowedValues: null, dangerousIfTrue: false, description: 'Dashboard session secret' },
  { name: 'ENCRYPTION_KEY', category: 'auth', requiredFor: ['privacy', 'lifeos'], requiredInProduction: true, sensitive: true, defaultSafeValue: null, allowedValues: null, dangerousIfTrue: false, description: 'Data encryption key' },
  { name: 'LOG_LEVEL', category: 'observability', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: 'info', allowedValues: ['debug', 'info', 'warn', 'error'], dangerousIfTrue: false, description: 'Logging level' },
  { name: 'LOG_FORMAT', category: 'observability', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: 'text', allowedValues: ['text', 'json'], dangerousIfTrue: false, description: 'Log output format' },
  { name: 'METRICS_ENABLED', category: 'observability', requiredFor: ['monitoring'], requiredInProduction: false, sensitive: false, defaultSafeValue: 'false', allowedValues: ['true', 'false'], dangerousIfTrue: false, description: 'Enable metrics collection' },
  { name: 'AUTO_APPROVE_ENABLED', category: 'safety', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: 'false', allowedValues: ['true', 'false'], dangerousIfTrue: true, description: 'Auto-approve operations (DANGEROUS)' },
  { name: 'AUTO_RUN_ENABLED', category: 'safety', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: 'false', allowedValues: ['true', 'false'], dangerousIfTrue: true, description: 'Auto-run commands (DANGEROUS)' },
  { name: 'SHELL_EXECUTOR_ENABLED', category: 'safety', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: 'false', allowedValues: ['true', 'false'], dangerousIfTrue: true, description: 'Shell executor enabled (DANGEROUS)' },
  { name: 'AGENT_MAX_CONCURRENCY', category: 'agents', requiredFor: ['agents'], requiredInProduction: false, sensitive: false, defaultSafeValue: '5', allowedValues: null, dangerousIfTrue: false, description: 'Max concurrent agent operations' },
  { name: 'AGENT_TIMEOUT_MS', category: 'agents', requiredFor: ['agents'], requiredInProduction: false, sensitive: false, defaultSafeValue: '300000', allowedValues: null, dangerousIfTrue: false, description: 'Agent operation timeout ms' },
  { name: 'LLM_PROVIDER', category: 'ai', requiredFor: ['agents', 'coding'], requiredInProduction: true, sensitive: false, defaultSafeValue: 'openai', allowedValues: ['openai', 'anthropic', 'azure', 'local'], dangerousIfTrue: false, description: 'LLM provider name' },
  { name: 'LLM_API_KEY', category: 'ai', requiredFor: ['agents', 'coding'], requiredInProduction: true, sensitive: true, defaultSafeValue: null, allowedValues: null, dangerousIfTrue: false, description: 'LLM API key' },
  { name: 'LLM_MODEL', category: 'ai', requiredFor: ['agents', 'coding'], requiredInProduction: false, sensitive: false, defaultSafeValue: 'gpt-4', allowedValues: null, dangerousIfTrue: false, description: 'LLM model name' },
  { name: 'LLM_MAX_TOKENS', category: 'ai', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: '4096', allowedValues: null, dangerousIfTrue: false, description: 'LLM max tokens per request' },
  { name: 'LLM_TEMPERATURE', category: 'ai', requiredFor: [], requiredInProduction: false, sensitive: false, defaultSafeValue: '0.7', allowedValues: null, dangerousIfTrue: false, description: 'LLM temperature setting' },
  { name: 'GITHUB_TOKEN', category: 'auth', requiredFor: ['githubops'], requiredInProduction: true, sensitive: true, defaultSafeValue: null, allowedValues: null, dangerousIfTrue: false, description: 'GitHub API token' },
  { name: 'GITHUB_REPO', category: 'integrations', requiredFor: ['githubops'], requiredInProduction: false, sensitive: false, defaultSafeValue: '', allowedValues: null, dangerousIfTrue: false, description: 'GitHub repository owner/name' },
  { name: 'DEPLOY_TARGET', category: 'deploy', requiredFor: ['deploy'], requiredInProduction: false, sensitive: false, defaultSafeValue: 'local', allowedValues: ['local', 'docker', 'kubernetes', 'cloud'], dangerousIfTrue: false, description: 'Deployment target type' },
  { name: 'COST_LIMIT_MONTHLY', category: 'cost', requiredFor: ['cost'], requiredInProduction: false, sensitive: false, defaultSafeValue: '100', allowedValues: null, dangerousIfTrue: false, description: 'Monthly cost limit USD' },
  { name: 'DISASTER_RECOVERY_ENABLED', category: 'reliability', requiredFor: ['disaster-recovery'], requiredInProduction: false, sensitive: false, defaultSafeValue: 'false', allowedValues: ['true', 'false'], dangerousIfTrue: false, description: 'Enable disaster recovery' },
  { name: 'BACKUP_DIR', category: 'reliability', requiredFor: ['disaster-recovery'], requiredInProduction: false, sensitive: false, defaultSafeValue: './backups', allowedValues: null, dangerousIfTrue: false, description: 'Backup directory path' },
  { name: 'PLUGINS_DIR', category: 'plugins', requiredFor: ['plugins'], requiredInProduction: false, sensitive: false, defaultSafeValue: './plugins', allowedValues: null, dangerousIfTrue: false, description: 'Plugins directory path' },
  { name: 'CORS_ORIGIN', category: 'network', requiredFor: ['dashboard'], requiredInProduction: false, sensitive: false, defaultSafeValue: '*', allowedValues: null, dangerousIfTrue: false, description: 'CORS allowed origin' },
  { name: 'RATE_LIMIT_WINDOW_MS', category: 'network', requiredFor: ['dashboard'], requiredInProduction: false, sensitive: false, defaultSafeValue: '60000', allowedValues: null, dangerousIfTrue: false, description: 'Rate limit window ms' },
  { name: 'RATE_LIMIT_MAX_REQUESTS', category: 'network', requiredFor: ['dashboard'], requiredInProduction: false, sensitive: false, defaultSafeValue: '100', allowedValues: null, dangerousIfTrue: false, description: 'Rate limit max requests per window' },
  { name: 'KNOWLEDGE_BASE_DIR', category: 'knowledge', requiredFor: ['knowledge'], requiredInProduction: false, sensitive: false, defaultSafeValue: './knowledge', allowedValues: null, dangerousIfTrue: false, description: 'Knowledge base directory' },
  { name: 'MOBILE_API_URL', category: 'mobile', requiredFor: ['mobile'], requiredInProduction: false, sensitive: false, defaultSafeValue: '', allowedValues: null, dangerousIfTrue: false, description: 'Mobile backend API URL' },
];

function buildEnvContractRegistry(services) {
  return ENV_CONTRACTS.map(c => ({
    name: c.name,
    category: c.category,
    requiredFor: c.requiredFor,
    requiredInProduction: c.requiredInProduction,
    sensitive: c.sensitive,
    defaultSafeValue: c.defaultSafeValue,
    allowedValues: c.allowedValues,
    dangerousIfTrue: c.dangerousIfTrue,
    description: c.description
  }));
}

function _getEnv(name, services) {
  const env = services && services.env ? services.env : process.env;
  return env[name];
}

function validateEnvContracts(services) {
  const contracts = buildEnvContractRegistry(services);
  const issues = [];
  for (const c of contracts) {
    if (c.requiredInProduction) {
      const val = _getEnv(c.name, services);
      if (!val && _getEnv('NODE_ENV', services) === 'production') {
        issues.push({ name: c.name, issue: 'missing in production', severity: 'error' });
      }
    }
  }
  return { valid: issues.length === 0, total: contracts.length, issues };
}

function detectDangerousEnvValuesByNameOnly(services) {
  const dangerous = ENV_CONTRACTS.filter(c => c.dangerousIfTrue);
  const active = [];
  for (const c of dangerous) {
    const val = _getEnv(c.name, services);
    if (val && (val === 'true' || val === '1' || val === 'yes')) {
      active.push({ name: c.name, status: 'enabled', dangerous: true, blocksReadiness: true });
    } else {
      active.push({ name: c.name, status: 'disabled', dangerous: true, blocksReadiness: false });
    }
  }
  return active;
}

function buildEnvContractReport(services) {
  const contracts = buildEnvContractRegistry(services);
  const validation = validateEnvContracts(services);
  const dangerous = detectDangerousEnvValuesByNameOnly(services);
  const byCategory = {};
  for (const c of contracts) {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c.name);
  }
  return {
    total: contracts.length,
    byCategory,
    validation,
    dangerousFlags: dangerous
  };
}

module.exports = {
  buildEnvContractRegistry,
  validateEnvContracts,
  detectDangerousEnvValuesByNameOnly,
  buildEnvContractReport,
  ENV_CONTRACTS
};
