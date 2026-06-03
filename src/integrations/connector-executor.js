'use strict';

const github = require('./connectors/github-connector');
const calendar = require('./connectors/google-calendar-connector');
const gmail = require('./connectors/gmail-draft-connector');
const cloudflareNas = require('./connectors/cloudflare-nas-connector');
const webhook = require('./connectors/webhook-connector');
const permissions = require('./connector-permissions');
const qualityGates = require('./connector-quality-gates');
const rateLimit = require('./connector-rate-limit');
const store = require('./connector-execution-store');
const sanitizer = require('./connector-result-sanitizer');

const CONNECTORS = {
  github,
  google_calendar: calendar,
  calendar,
  gmail,
  cloudflare_nas: cloudflareNas,
  nas: cloudflareNas,
  webhook
};

function normalizeConnectorId(connectorId = '') {
  const clean = String(connectorId || '').trim().toLowerCase();
  if (clean === 'google-calendar') return 'google_calendar';
  if (clean === 'cloudflare-nas') return 'cloudflare_nas';
  return clean;
}

function getConnector(connectorId) {
  return CONNECTORS[normalizeConnectorId(connectorId)] || null;
}

function listConnectorsSafe(services = {}) {
  return Object.entries(CONNECTORS)
    .filter(([id]) => id === normalizeConnectorId(id))
    .map(([id, connector]) => {
      const config = connector.getConfig ? connector.getConfig(services.env || process.env) : {};
      return {
        id,
        configured: Boolean(config.configured),
        credentialStatus: sanitizer.sanitizeConnectorResult(config),
        actions: ['status']
      };
    });
}

function actionMetadata(connector, action) {
  if (connector?.actionMetadata) return connector.actionMetadata(action);
  return {
    readOnly: permissions.isReadOnlyAction(action),
    riskLevel: permissions.isReadOnlyAction(action) ? 'low' : 'medium',
    requiresApproval: !permissions.isReadOnlyAction(action)
  };
}

function normalizeContext(context = {}, services = {}) {
  return {
    workspaceId: context.workspaceId || services.workspaceId || 'default',
    userId: String(context.userId || services.userId || context.actorId || services.actorId || ''),
    actorId: String(context.actorId || services.actorId || context.userId || services.userId || ''),
    actorRole: context.actorRole || services.actorRole || 'owner',
    text: context.text || ''
  };
}

async function auditIntegration(action, summary = {}, services = {}) {
  try {
    await services.auditLog?.recordAuditLog?.({
      actorType: services.actorType || 'integration',
      actorId: services.actorId || summary.userId || '',
      action,
      targetType: summary.targetType || 'integration_connector',
      targetId: summary.id || summary.connectorId || '',
      workspaceId: summary.workspaceId || services.workspaceId || 'default',
      userId: summary.userId || services.userId || '',
      decision: summary.decision || 'allowed',
      status: summary.status || 'ok',
      afterSummary: sanitizer.sanitizeConnectorResult(summary)
    }, services);
  } catch (_) {}
}

async function recordConnectorExecution(execution = {}, services = {}) {
  const safe = sanitizer.sanitizeConnectorResult({
    id: execution.id || store.createId('integration_exec'),
    workspaceId: execution.workspaceId || 'default',
    userId: String(execution.userId || ''),
    connectorId: execution.connectorId,
    action: execution.action,
    mode: execution.mode || 'read_only',
    payload: execution.payload || {},
    riskLevel: execution.riskLevel || 'low',
    status: execution.status || 'created',
    evaluationRunId: execution.evaluationRunId || '',
    qualityGateStatus: execution.qualityGateStatus || '',
    resultSummary: sanitizer.compactText(execution.resultSummary || '', 700),
    proposalId: execution.proposalId || '',
    createdAt: execution.createdAt || store.nowIso(),
    updatedAt: store.nowIso(),
    completedAt: execution.completedAt || null
  });
  await store.upsertIntegrationItem(store.INTEGRATION_EXECUTIONS_KEY, safe, services);
  return safe;
}

async function executeReadOnlyAction(connector, action, payload = {}, context = {}, services = {}) {
  const ctx = normalizeContext(context, services);
  const metadata = actionMetadata(connector, action);
  const execution = await recordConnectorExecution({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    connectorId: connector.CONNECTOR_ID,
    action,
    mode: 'read_only',
    payload,
    riskLevel: metadata.riskLevel,
    status: 'running'
  }, services);
  try {
    const result = await connector.runReadOnly(action, payload, ctx, services);
    const safeResult = sanitizeConnectorResult(result);
    await store.appendIntegrationItem(store.INTEGRATION_EXECUTION_RESULTS_KEY, {
      id: store.createId('integration_result'),
      executionId: execution.id,
      connectorId: connector.CONNECTOR_ID,
      action,
      result: safeResult,
      createdAt: store.nowIso()
    }, 1000, services);
    const updated = await recordConnectorExecution({
      ...execution,
      status: result.ok === false ? 'failed' : 'completed',
      resultSummary: sanitizer.buildSafeSummary(safeResult, 700),
      completedAt: store.nowIso()
    }, services);
    await auditIntegration('integration/connector_read_executed', updated, services);
    return { ok: result.ok !== false, execution: updated, result: safeResult };
  } catch (err) {
    const updated = await recordConnectorExecution({
      ...execution,
      status: 'failed',
      resultSummary: err.message,
      completedAt: store.nowIso()
    }, services);
    return { ok: false, execution: updated, error: err.message };
  }
}

async function runConnectorDryRun(connectorId, action, payload = {}, context = {}, services = {}) {
  const connector = getConnector(connectorId);
  if (!connector) return { ok: false, reason: 'CONNECTOR_NOT_FOUND' };
  const ctx = normalizeContext(context, services);
  const metadata = actionMetadata(connector, action);
  const result = metadata.readOnly
    ? { ok: true, connectorId: connector.CONNECTOR_ID, action, dryRun: { readOnly: true, wouldWrite: false, payload: sanitizer.sanitizeConnectorResult(payload) } }
    : connector.buildWritePlan(action, payload, ctx, services);
  const execution = await recordConnectorExecution({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    connectorId: connector.CONNECTOR_ID,
    action,
    mode: 'dry_run',
    payload,
    riskLevel: result.riskLevel || metadata.riskLevel,
    status: result.ok === false ? 'blocked' : 'completed',
    resultSummary: sanitizer.buildSafeSummary(result, 700),
    completedAt: store.nowIso()
  }, services);
  await auditIntegration('integration/connector_dry_run_executed', execution, services);
  return { ok: result.ok !== false, execution, result: sanitizeConnectorResult(result) };
}

async function createWriteActionProposal(connector, action, payload = {}, context = {}, services = {}) {
  const pipeline = require('./integration-proposal-pipeline');
  const created = await pipeline.createIntegrationProposalPipeline({
    connectorId: connector.CONNECTOR_ID,
    action,
    payload,
    context
  }, services);
  if (!created.ok) return created;
  await pipeline.runIntegrationPreflight(created.pipeline.id, services);
  await pipeline.runIntegrationDryRun(created.pipeline.id, services);
  await pipeline.runIntegrationEvaluationGate(created.pipeline.id, services);
  return pipeline.createExecutorProposalAfterGate(created.pipeline.id, services);
}

async function runApprovedConnectorAction(actionEnvelope = {}, services = {}) {
  const connectorId = actionEnvelope.connectorId || actionEnvelope.payload?.connectorId;
  const action = actionEnvelope.action || actionEnvelope.payload?.action;
  const payload = actionEnvelope.payload?.payload || actionEnvelope.payload || {};
  const connector = getConnector(connectorId);
  if (!connector) return { ok: false, reason: 'CONNECTOR_NOT_FOUND' };
  const ctx = normalizeContext(actionEnvelope.context || actionEnvelope, services);
  if (sanitizer.containsSecretLike(payload)) return { ok: false, reason: 'CONNECTOR_PAYLOAD_SECRET_REJECTED' };
  const metadata = actionMetadata(connector, action);
  if (metadata.readOnly) return executeReadOnlyAction(connector, action, payload, ctx, services);
  if (typeof connector.runApprovedWrite === 'function') {
    return connector.runApprovedWrite(action, payload, ctx, services);
  }
  const dry = connector.buildWritePlan ? connector.buildWritePlan(action, payload, ctx, services) : null;
  const execution = await recordConnectorExecution({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    connectorId: connector.CONNECTOR_ID,
    action,
    mode: 'approved_run',
    payload,
    riskLevel: metadata.riskLevel,
    status: 'completed',
    resultSummary: 'Approved connector run reached v1 safe boundary. No unimplemented external write handler was executed.',
    completedAt: store.nowIso()
  }, services);
  return {
    ok: true,
    execution,
    result: sanitizeConnectorResult({
      connectorId: connector.CONNECTOR_ID,
      action,
      approved: true,
      externalWriteHandler: 'not_implemented_v1',
      dryRun: dry?.dryRun || dry
    })
  };
}

async function executeConnectorAction(connectorId, action, payload = {}, context = {}, services = {}) {
  const connector = getConnector(connectorId);
  if (!connector) return { ok: false, reason: 'CONNECTOR_NOT_FOUND', status: 404 };
  const ctx = normalizeContext(context, services);
  const metadata = actionMetadata(connector, action);
  if (sanitizer.containsSecretLike(payload)) return { ok: false, reason: 'CONNECTOR_PAYLOAD_SECRET_REJECTED', status: 400 };
  const actor = { actorId: ctx.actorId || ctx.userId, userId: ctx.userId, role: ctx.actorRole };
  const perm = await permissions.checkConnectorPermission(connector.CONNECTOR_ID, action, actor, { workspaceId: ctx.workspaceId }, services);
  if (!perm.allowed) {
    await auditIntegration('integration/permission_denied', { ...ctx, connectorId: connector.CONNECTOR_ID, action, decision: 'denied', reason: perm.reason }, services);
    return { ok: false, reason: perm.reason, permission: perm, status: 403 };
  }
  const rate = await rateLimit.enforceConnectorRateLimit(connector.CONNECTOR_ID, action, ctx.userId, ctx.workspaceId, services, {
    mode: metadata.readOnly ? 'read_only' : 'proposal'
  });
  if (!rate.allowed) return { ok: false, reason: rate.reason, rateLimit: rate, status: 429 };
  const quality = await qualityGates.blockIfQualityGateFailed(connector.CONNECTOR_ID, action, {
    ...services,
    integrationConnectors: module.exports
  });
  if (!quality.ok) return { ok: false, reason: quality.reason, qualityGate: quality.status, status: 400 };
  if (metadata.readOnly) {
    return executeReadOnlyAction(connector, action, payload, ctx, services);
  }
  return createWriteActionProposal(connector, action, payload, ctx, services);
}

function sanitizeConnectorResult(result) {
  return sanitizer.sanitizeConnectorResult(result);
}

module.exports = {
  CONNECTORS,
  createWriteActionProposal,
  executeConnectorAction,
  executeReadOnlyAction,
  getConnector,
  listConnectorsSafe,
  normalizeConnectorId,
  recordConnectorExecution,
  runApprovedConnectorAction,
  runConnectorDryRun,
  sanitizeConnectorResult
};
