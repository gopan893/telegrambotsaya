'use strict';

const { sanitizeMobileData } = require('./mobile-utils');

const EMPTY_STATE_MESSAGES = {
  overview: 'No dashboard data available. Configure your services to get started.',
  agents: 'No agents configured. Create an agent to begin automation.',
  executor: 'No pending executions. All workflows are running smoothly.',
  integrations: 'No integrations configured. Connect your first service.',
  coding: 'No coding workspace active. Start a new coding session.',
  settings: 'No settings configured. Default values are in use.',
  security: 'No security incidents detected. Your system is secure.',
  monitoring: 'No monitoring data available. Health checks are idle.',
  memory: 'No memory entries found. Your agent has not stored any memories.',
  goals: 'No goals defined. Create a goal to start tracking progress.',
  default: 'No data available for this section.'
};

const LOADING_STATE_MESSAGES = {
  overview: 'Loading dashboard data...',
  agents: 'Loading agents...',
  executor: 'Loading executor queue...',
  integrations: 'Loading integrations...',
  coding: 'Loading coding workspace...',
  settings: 'Loading settings...',
  default: 'Loading...'
};

const DEGRADED_MODULE_MESSAGES = {
  monitoring: 'Monitoring service is degraded. Some health checks may be delayed.',
  executor: 'Executor service is degraded. Workflow execution may be slow.',
  integrations: 'Integration service is degraded. Some connectors may be unavailable.',
  knowledge: 'Knowledge base is degraded. Search results may be incomplete.',
  default: 'This module is currently unavailable or degraded. Core functionality remains unaffected.'
};

function buildDashboardErrorState(error, services) {
  const safe = sanitizeDashboardError(error, services);
  return {
    hasError: true,
    message: safe.message || 'An unexpected error occurred.',
    code: safe.code || 500,
    retryable: safe.retryable !== false,
    timestamp: new Date().toISOString()
  };
}

function buildEmptyState(tab, services) {
  const msg = EMPTY_STATE_MESSAGES[tab] || EMPTY_STATE_MESSAGES.default;
  return { tab, empty: true, message: msg, hasData: false };
}

function buildLoadingState(tab, services) {
  const msg = LOADING_STATE_MESSAGES[tab] || LOADING_STATE_MESSAGES.default;
  return { tab, loading: true, message: msg };
}

function buildDegradedModuleState(moduleName, services) {
  const msg = DEGRADED_MODULE_MESSAGES[moduleName] || DEGRADED_MODULE_MESSAGES.default;
  return {
    module: moduleName,
    degraded: true,
    message: msg,
    coreFunctionalityAvailable: true,
    timestamp: new Date().toISOString()
  };
}

function sanitizeDashboardError(error, services) {
  if (!error || typeof error === 'string') {
    return { message: error || 'Unknown error', code: 500, retryable: true };
  }
  const safe = {};
  safe.message = typeof error.message === 'string' ? error.message : 'An error occurred';
  safe.code = typeof error.code === 'number' ? error.code : 500;
  safe.retryable = error.retryable !== false;
  const sanitized = sanitizeMobileData(safe);
  const secretPatterns = [
    /(token|api[_-]?key|secret|password|credential)[=:]\s*\S+/gi,
    /\b(token|password|secret|api\s*key)\s+(is\s+)?\S+/gi,
    /(TELEGRAM_TOKEN|DATABASE_URL|REDIS_URL|DASHBOARD_ADMIN_TOKEN|GITHUB_TOKEN|GOOGLE_CLIENT_SECRET|CLOUDFLARE_API_TOKEN)/g,
    /[A-Za-z0-9]{30,}/g
  ];
  let message = sanitized.message || '';
  for (const pattern of secretPatterns) {
    message = message.replace(pattern, '[REDACTED]');
  }
  sanitized.message = message;
  return sanitized;
}

module.exports = {
  buildDashboardErrorState,
  buildEmptyState,
  buildLoadingState,
  buildDegradedModuleState,
  sanitizeDashboardError
};
