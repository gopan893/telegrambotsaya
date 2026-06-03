'use strict';

const executor = require('../executor');
const connectorExecutor = require('./connector-executor');
const permissions = require('./connector-permissions');
const quality = require('./connector-quality-gates');
const evalGate = require('./integration-evaluation-gate');
const store = require('./connector-execution-store');
const sanitizer = require('./connector-result-sanitizer');

function normalizeContext(context = {}, services = {}) {
  return {
    workspaceId: context.workspaceId || services.workspaceId || 'default',
    userId: String(context.userId || services.userId || context.actorId || services.actorId || ''),
    actorId: String(context.actorId || services.actorId || context.userId || services.userId || ''),
    actorRole: context.actorRole || services.actorRole || 'owner',
    text: context.text || ''
  };
}

async function getPipelineStatus(pipelineId, services = {}) {
  const pipeline = await store.getIntegrationItem(store.INTEGRATION_PROPOSAL_PIPELINE_RUNS_KEY, pipelineId, services);
  if (!pipeline) return { ok: false, reason: 'PIPELINE_NOT_FOUND', status: 404 };
  return { ok: true, pipeline };
}

async function createIntegrationProposalPipeline(input = {}, services = {}) {
  const connector = connectorExecutor.getConnector(input.connectorId);
  if (!connector) return { ok: false, reason: 'CONNECTOR_NOT_FOUND', status: 404 };
  const ctx = normalizeContext(input.context || input, services);
  const metadata = connector.actionMetadata ? connector.actionMetadata(input.action) : {};
  const pipeline = sanitizer.sanitizeConnectorResult({
    id: input.id || store.createId('integration_pipeline'),
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    actorId: ctx.actorId,
    connectorId: connector.CONNECTOR_ID,
    action: input.action,
    payload: input.payload || {},
    riskLevel: input.riskLevel || metadata.riskLevel || 'medium',
    mode: metadata.readOnly ? 'read_only' : 'proposal',
    status: 'created',
    stages: {
      planCreated: true,
      preflightPassed: false,
      dryRunPassed: false,
      evaluationPassed: false,
      proposalCreated: false,
      approved: false,
      executed: false
    },
    preflight: null,
    dryRun: null,
    evaluationGate: null,
    proposalId: '',
    createdAt: store.nowIso(),
    updatedAt: store.nowIso()
  });
  await store.upsertIntegrationItem(store.INTEGRATION_PROPOSAL_PIPELINE_RUNS_KEY, pipeline, services);
  return { ok: true, pipeline };
}

async function runIntegrationPreflight(pipelineId, services = {}) {
  const current = await getPipelineStatus(pipelineId, services);
  if (!current.ok) return current;
  const pipeline = current.pipeline;
  const connector = connectorExecutor.getConnector(pipeline.connectorId);
  const ctx = normalizeContext(pipeline, services);
  const permission = await permissions.checkConnectorPermission(pipeline.connectorId, pipeline.action, {
    actorId: pipeline.actorId || ctx.actorId,
    userId: pipeline.userId || ctx.userId,
    role: services.actorRole || 'owner'
  }, { workspaceId: pipeline.workspaceId }, services);
  const qualityStatus = await quality.blockIfQualityGateFailed(pipeline.connectorId, pipeline.action, {
    ...services,
    integrationConnectors: connectorExecutor
  });
  const actionPlan = connector?.buildWritePlan?.(pipeline.action, pipeline.payload, ctx, services);
  const passed = permission.allowed && qualityStatus.ok && actionPlan?.ok !== false;
  const preflight = sanitizer.sanitizeConnectorResult({
    permission,
    qualityGate: qualityStatus.status,
    actionPlan,
    passed,
    blockers: [
      permission.allowed ? '' : permission.reason,
      qualityStatus.ok ? '' : qualityStatus.reason,
      actionPlan?.ok === false ? actionPlan.error : ''
    ].filter(Boolean)
  });
  const updated = await store.updateIntegrationItem(store.INTEGRATION_PROPOSAL_PIPELINE_RUNS_KEY, pipelineId, {
    preflight,
    stages: { ...pipeline.stages, preflightPassed: passed },
    status: passed ? 'preflight_passed' : 'blocked'
  }, services);
  return { ok: passed, pipeline: updated, preflight, reason: preflight.blockers?.join('; ') || '' };
}

async function runIntegrationDryRun(pipelineId, services = {}) {
  const current = await getPipelineStatus(pipelineId, services);
  if (!current.ok) return current;
  const pipeline = current.pipeline;
  if (!pipeline.stages?.preflightPassed) return { ok: false, reason: 'PREFLIGHT_REQUIRED', pipeline };
  const dryRun = await connectorExecutor.runConnectorDryRun(pipeline.connectorId, pipeline.action, pipeline.payload, pipeline, services);
  const passed = dryRun.ok && dryRun.result?.ok !== false && !dryRun.result?.dryRun?.externalWriteExecuted;
  const updated = await store.updateIntegrationItem(store.INTEGRATION_PROPOSAL_PIPELINE_RUNS_KEY, pipelineId, {
    dryRun: sanitizer.sanitizeConnectorResult(dryRun),
    stages: { ...pipeline.stages, dryRunPassed: passed },
    status: passed ? 'dry_run_passed' : 'blocked'
  }, services);
  return { ok: passed, pipeline: updated, dryRun, reason: passed ? '' : (dryRun.reason || dryRun.result?.error || 'DRY_RUN_FAILED') };
}

async function runIntegrationEvaluationGate(pipelineId, services = {}) {
  const current = await getPipelineStatus(pipelineId, services);
  if (!current.ok) return current;
  const pipeline = current.pipeline;
  if (!pipeline.stages?.dryRunPassed) return { ok: false, reason: 'DRY_RUN_REQUIRED', pipeline };
  const gate = await evalGate.runEvaluationGateForIntegration({
    connectorId: pipeline.connectorId,
    action: pipeline.action,
    payload: pipeline.payload,
    riskLevel: pipeline.riskLevel,
    text: pipeline.payload?.text || pipeline.payload?.description || `${pipeline.connectorId} ${pipeline.action}`
  }, services);
  const updated = await store.updateIntegrationItem(store.INTEGRATION_PROPOSAL_PIPELINE_RUNS_KEY, pipelineId, {
    evaluationGate: sanitizer.sanitizeConnectorResult(gate),
    evaluationRunId: gate.run?.id || '',
    qualityGateStatus: gate.report?.status || '',
    stages: { ...pipeline.stages, evaluationPassed: gate.ok },
    status: gate.ok ? 'evaluation_passed' : 'blocked'
  }, services);
  return { ok: gate.ok, pipeline: updated, gate, reason: gate.reason || '' };
}

async function createExecutorProposalAfterGate(pipelineId, services = {}) {
  const current = await getPipelineStatus(pipelineId, services);
  if (!current.ok) return current;
  const pipeline = current.pipeline;
  if (!pipeline.stages?.evaluationPassed) return { ok: false, reason: 'EVALUATION_GATE_REQUIRED', pipeline, status: 400 };
  const result = await executor.executionPlanner.createExecutionProposal({
    actorId: pipeline.actorId || services.actorId || pipeline.userId,
    userId: pipeline.userId,
    workspaceId: pipeline.workspaceId,
    sourceType: 'dashboard',
    sourceId: pipeline.id,
    title: `Approved integration action: ${pipeline.connectorId}/${pipeline.action}`,
    description: 'External integration proposal created only after preflight, dry-run, and Evaluation v2 gate passed.',
    proposedActions: [{
      type: 'integration.connector.run',
      targetType: 'integration',
      targetId: pipeline.id,
      description: `Run approved connector action ${pipeline.connectorId}/${pipeline.action}`,
      payload: {
        connectorId: pipeline.connectorId,
        action: pipeline.action,
        payload: pipeline.payload,
        pipelineId: pipeline.id
      },
      riskLevel: pipeline.riskLevel || 'medium',
      requiresApproval: true
    }]
  }, services);
  if (!result.ok) return result;
  const updated = await store.updateIntegrationItem(store.INTEGRATION_PROPOSAL_PIPELINE_RUNS_KEY, pipelineId, {
    proposalId: result.proposal.id,
    stages: { ...pipeline.stages, proposalCreated: true },
    status: 'proposal_created'
  }, services);
  await connectorExecutor.recordConnectorExecution({
    workspaceId: pipeline.workspaceId,
    userId: pipeline.userId,
    connectorId: pipeline.connectorId,
    action: pipeline.action,
    mode: 'proposal',
    payload: pipeline.payload,
    riskLevel: pipeline.riskLevel,
    status: 'proposal_created',
    evaluationRunId: pipeline.evaluationRunId,
    qualityGateStatus: pipeline.qualityGateStatus,
    proposalId: result.proposal.id,
    resultSummary: 'Executor proposal created after Evaluation v2 gate.'
  }, services);
  return { ok: true, pipeline: updated, proposal: result.proposal };
}

module.exports = {
  createExecutorProposalAfterGate,
  createIntegrationProposalPipeline,
  getPipelineStatus,
  runIntegrationDryRun,
  runIntegrationEvaluationGate,
  runIntegrationPreflight
};
