'use strict';

const sanitizer = require('../connector-result-sanitizer');

const CONNECTOR_ID = 'gmail';

function getConfig(env = process.env) {
  return {
    clientIdConfigured: Boolean(env.GOOGLE_CLIENT_ID),
    clientSecretConfigured: Boolean(env.GOOGLE_CLIENT_SECRET),
    redirectUriConfigured: Boolean(env.GOOGLE_REDIRECT_URI),
    configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
    sendEnabled: false
  };
}

function setupPlan(config = getConfig()) {
  return {
    configured: false,
    status: 'oauth_setup_required',
    sendEnabled: false,
    missing: [
      config.clientIdConfigured ? '' : 'GOOGLE_CLIENT_ID',
      config.clientSecretConfigured ? '' : 'GOOGLE_CLIENT_SECRET',
      config.redirectUriConfigured ? '' : 'GOOGLE_REDIRECT_URI'
    ].filter(Boolean),
    nextSteps: [
      'Configure Google OAuth env.',
      'Use draft-only mode first.',
      'Gmail send remains disabled by default.'
    ]
  };
}

function actionMetadata(action) {
  const readOnly = action === 'gmail.status';
  const disabled = action === 'gmail.send';
  return {
    connectorId: CONNECTOR_ID,
    action,
    readOnly,
    proposalOnly: !readOnly,
    disabled,
    riskLevel: disabled ? 'danger' : (readOnly ? 'low' : 'medium'),
    requiresApproval: !readOnly
  };
}

async function runReadOnly(action, payload = {}, context = {}, services = {}) {
  const config = getConfig(services.env || process.env);
  if (action !== 'gmail.status') return { ok: false, connectorId: CONNECTOR_ID, action, error: 'UNSUPPORTED_GMAIL_READ_ACTION' };
  return { ok: true, connectorId: CONNECTOR_ID, action, result: config.configured ? { configured: true, draftOnly: true, sendEnabled: false } : setupPlan(config) };
}

function buildWritePlan(action, payload = {}, context = {}) {
  if (action === 'gmail.send') {
    return {
      ok: false,
      connectorId: CONNECTOR_ID,
      action,
      error: 'GMAIL_SEND_DISABLED',
      riskLevel: 'danger',
      requiresApproval: true,
      dryRun: { externalWriteBlocked: true, reason: 'Direct Gmail send is disabled by default.' }
    };
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
      draftOnly: true,
      toPreview: sanitizer.compactText(payload.to || payload.recipient || '', 120),
      subjectPreview: sanitizer.compactText(payload.subject || payload.text || context.text || 'Gmail draft proposal', 180),
      bodyPreview: sanitizer.compactText(payload.body || payload.text || '', 420)
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
