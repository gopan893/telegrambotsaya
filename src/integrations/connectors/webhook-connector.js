'use strict';

const sanitizer = require('../connector-result-sanitizer');

const CONNECTOR_ID = 'webhook';

function getConfig(env = process.env) {
  return {
    urlConfigured: Boolean(env.EXTERNAL_WEBHOOK_URL),
    sharedSecretConfigured: Boolean(env.WEBHOOK_SHARED_SECRET),
    configured: Boolean(env.EXTERNAL_WEBHOOK_URL)
  };
}

function setupPlan(config = getConfig()) {
  return {
    configured: false,
    status: 'setup_optional',
    missing: [config.urlConfigured ? '' : 'EXTERNAL_WEBHOOK_URL'].filter(Boolean),
    nextSteps: [
      'Set EXTERNAL_WEBHOOK_URL in Render env.',
      'Set WEBHOOK_SHARED_SECRET if receiver requires signing.',
      'Webhook POST is proposal-only and never runs during dry-run.'
    ]
  };
}

function actionMetadata(action) {
  const readOnly = ['webhook.status', 'webhook.payload.validate', 'webhook.payload.preview'].includes(action);
  return {
    connectorId: CONNECTOR_ID,
    action,
    readOnly,
    proposalOnly: !readOnly,
    riskLevel: readOnly ? 'low' : 'medium',
    requiresApproval: !readOnly
  };
}

async function runReadOnly(action, payload = {}, context = {}, services = {}) {
  const config = getConfig(services.env || process.env);
  if (action === 'webhook.status') {
    return { ok: true, connectorId: CONNECTOR_ID, action, result: config.configured ? { configured: true, sharedSecretConfigured: config.sharedSecretConfigured } : setupPlan(config) };
  }
  if (action === 'webhook.payload.validate' || action === 'webhook.payload.preview') {
    const safePayload = sanitizer.sanitizeConnectorResult(payload);
    return {
      ok: true,
      connectorId: CONNECTOR_ID,
      action,
      result: {
        valid: !sanitizer.containsSecretLike(payload),
        configured: config.configured,
        wouldPost: false,
        payloadPreview: safePayload
      }
    };
  }
  return { ok: false, connectorId: CONNECTOR_ID, action, error: 'UNSUPPORTED_WEBHOOK_READ_ACTION' };
}

function buildWritePlan(action, payload = {}, context = {}) {
  if (sanitizer.containsSecretLike(payload)) {
    return { ok: false, connectorId: CONNECTOR_ID, action, error: 'WEBHOOK_PAYLOAD_SECRET_REJECTED', riskLevel: 'danger', requiresApproval: true };
  }
  return {
    ok: true,
    connectorId: CONNECTOR_ID,
    action,
    proposalOnly: true,
    riskLevel: 'medium',
    requiresApproval: true,
    dryRun: {
      wouldWrite: true,
      externalWriteBlocked: true,
      wouldPost: true,
      payloadPreview: sanitizer.sanitizeConnectorResult(payload),
      textPreview: sanitizer.compactText(context.text || payload.text || '', 420)
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
