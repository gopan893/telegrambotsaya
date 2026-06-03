'use strict';

const store = require('./connector-execution-store');
const sanitizer = require('./connector-result-sanitizer');

function getConnectorQualityStatus(connectorId, services = {}) {
  const connector = services.integrationConnectors?.getConnector?.(connectorId) || null;
  if (!connector) {
    return {
      connectorId,
      status: 'failed',
      passed: false,
      reasons: ['CONNECTOR_NOT_FOUND'],
      readOnlyOnly: true
    };
  }
  const config = connector.getConfig ? connector.getConfig(services.env || process.env) : { configured: true };
  const warnings = [];
  if (!config.configured) warnings.push('credentials_or_env_missing');
  return {
    connectorId,
    status: warnings.length ? 'degraded' : 'ready',
    passed: true,
    available: Boolean(config.configured),
    readOnlyOnly: warnings.length > 0,
    credentialStatus: sanitizer.sanitizeConnectorResult(config),
    warnings,
    blockedActions: warnings.length ? ['write', 'external'] : []
  };
}

async function runIntegrationQualityGate(connectorId, services = {}) {
  const status = getConnectorQualityStatus(connectorId, services);
  const run = await store.appendIntegrationItem(store.INTEGRATION_QUALITY_GATE_RUNS_KEY, {
    id: store.createId('integration_quality'),
    connectorId,
    status: status.status,
    passed: status.passed,
    credentialStatus: status.credentialStatus,
    warnings: status.warnings,
    createdAt: store.nowIso()
  }, 500, services);
  return { ok: true, run, status };
}

async function blockIfQualityGateFailed(connectorId, action, services = {}) {
  const status = getConnectorQualityStatus(connectorId, services);
  const write = !/\.(status|list|info|check|diagnose|validate|preview)$/i.test(String(action || ''));
  if (!status.passed) return { ok: false, status, reason: 'CONNECTOR_QUALITY_GATE_FAILED' };
  if (write && status.readOnlyOnly) {
    return { ok: false, status, reason: 'CONNECTOR_WRITE_BLOCKED_UNTIL_CONFIGURED' };
  }
  return { ok: true, status };
}

function buildQualityGateReport(connectorId, services = {}) {
  const status = getConnectorQualityStatus(connectorId, services);
  return [
    `Connector: ${connectorId}`,
    `Quality: ${status.status}`,
    `Read-only only: ${status.readOnlyOnly ? 'yes' : 'no'}`,
    status.warnings?.length ? `Warnings: ${status.warnings.join(', ')}` : ''
  ].filter(Boolean).join('\n');
}

module.exports = {
  blockIfQualityGateFailed,
  buildQualityGateReport,
  getConnectorQualityStatus,
  runIntegrationQualityGate
};
