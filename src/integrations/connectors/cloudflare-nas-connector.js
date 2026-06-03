'use strict';

const axios = require('axios');
const sanitizer = require('../connector-result-sanitizer');

const CONNECTOR_ID = 'cloudflare_nas';

function getConfig(env = process.env) {
  return {
    cloudflareTokenConfigured: Boolean(env.CLOUDFLARE_API_TOKEN),
    cloudflareAccountConfigured: Boolean(env.CLOUDFLARE_ACCOUNT_ID),
    nasBaseUrlConfigured: Boolean(env.NAS_BASE_URL),
    nasHealthUrlConfigured: Boolean(env.NAS_HEALTH_URL),
    configured: Boolean(env.CLOUDFLARE_API_TOKEN || env.NAS_HEALTH_URL || env.NAS_BASE_URL)
  };
}

function setupPlan(config = getConfig()) {
  return {
    configured: false,
    status: 'setup_optional',
    missing: [
      config.cloudflareTokenConfigured ? '' : 'CLOUDFLARE_API_TOKEN',
      config.cloudflareAccountConfigured ? '' : 'CLOUDFLARE_ACCOUNT_ID',
      config.nasHealthUrlConfigured ? '' : 'NAS_HEALTH_URL'
    ].filter(Boolean),
    nextSteps: [
      'Set NAS_HEALTH_URL for read-only health checks.',
      'Set Cloudflare env only if tunnel diagnostics are needed.',
      'No shell/Termux command execution is supported.'
    ]
  };
}

function actionMetadata(action) {
  const readOnly = ['cloudflare_nas.status', 'cloudflare_nas.tunnel.check', 'nas.health.check', 'nas.access.diagnose'].includes(action);
  return {
    connectorId: CONNECTOR_ID,
    action,
    readOnly,
    proposalOnly: !readOnly,
    riskLevel: readOnly ? 'low' : 'high',
    requiresApproval: !readOnly
  };
}

async function runReadOnly(action, payload = {}, context = {}, services = {}) {
  const env = services.env || process.env;
  const config = getConfig(env);
  if (action === 'cloudflare_nas.status') {
    return { ok: true, connectorId: CONNECTOR_ID, action, result: config.configured ? { configured: true, ...config } : setupPlan(config) };
  }
  if (action === 'nas.health.check') {
    if (!env.NAS_HEALTH_URL) return { ok: true, connectorId: CONNECTOR_ID, action, result: setupPlan(config) };
    const res = await axios.get(env.NAS_HEALTH_URL, { timeout: 5000, validateStatus: () => true });
    return { ok: true, connectorId: CONNECTOR_ID, action, result: { status: res.status, reachable: res.status < 500, bodyPreview: sanitizer.compactText(typeof res.data === 'string' ? res.data : JSON.stringify(res.data), 300) } };
  }
  if (action === 'cloudflare_nas.tunnel.check' || action === 'nas.access.diagnose') {
    return {
      ok: true,
      connectorId: CONNECTOR_ID,
      action,
      result: {
        configured: config.configured,
        cloudflareTokenConfigured: config.cloudflareTokenConfigured,
        nasHealthUrlConfigured: config.nasHealthUrlConfigured,
        diagnostics: [
          config.nasHealthUrlConfigured ? 'NAS health URL is configured.' : 'NAS_HEALTH_URL missing.',
          config.cloudflareTokenConfigured ? 'Cloudflare token is configured.' : 'Cloudflare token missing.',
          'No mutation or shell command was executed.'
        ]
      }
    };
  }
  return { ok: false, connectorId: CONNECTOR_ID, action, error: 'UNSUPPORTED_CLOUDFLARE_NAS_READ_ACTION' };
}

function buildWritePlan(action, payload = {}, context = {}) {
  return {
    ok: true,
    connectorId: CONNECTOR_ID,
    action,
    proposalOnly: true,
    riskLevel: 'high',
    requiresApproval: true,
    dryRun: {
      wouldWrite: true,
      externalWriteBlocked: true,
      mutation: sanitizer.compactText(payload.change || payload.text || context.text || 'Cloudflare/NAS config plan', 420),
      noShell: true,
      noTermux: true
    }
  };
}

module.exports = {
  CONNECTOR_ID,
  actionMetadata,
  buildWritePlan,
  getConfig,
  runReadOnly,
  setupPlan
};
