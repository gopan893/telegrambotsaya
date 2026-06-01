'use strict';

const audit = require('./tool-audit');
const builtin = require('./builtin-tools');
const governance = require('./tool-governance');
const registry = require('./tool-registry');
const utils = require('./tool-utils');

async function ensureTools(services = {}) {
  await builtin.registerBuiltInTools(services);
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('TOOL_TIMEOUT')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function previewToolRun(toolId, input = {}, context = {}, services = {}) {
  await ensureTools(services);
  const tool = await registry.getTool(toolId, services);
  if (!tool) return { ok: false, reason: 'TOOL_NOT_FOUND', status: 404 };
  const decision = await governance.buildToolGovernanceDecision(tool, input, context, services);
  await audit.recordToolAudit({
    action: 'tool/previewed',
    toolId: tool.id,
    actionType: tool.actionType,
    riskLevel: decision.riskLevel,
    userId: decision.userId,
    workspaceId: decision.workspaceId,
    actorId: decision.actorId,
    actorRole: decision.actorRole,
    permission: decision.permission,
    decision: decision.allowed ? 'allowed' : 'denied',
    status: decision.allowed ? 'ok' : 'denied',
    reason: decision.reason,
    summary: { input: decision.sanitizedInput, requiresApproval: decision.requiresApproval }
  }, services);
  if (!decision.allowed) return { ok: false, reason: decision.reason, governance: decision, status: 403 };
  return {
    ok: true,
    preview: {
      tool: utils.summarizeTool(tool),
      input: decision.sanitizedInput,
      wouldRun: !decision.requiresApproval,
      requiresApproval: decision.requiresApproval,
      riskLevel: decision.riskLevel,
      warnings: decision.warnings
    },
    governance: decision
  };
}

async function runTool(toolId, input = {}, context = {}, services = {}) {
  await ensureTools(services);
  const started = Date.now();
  const tool = await registry.getTool(toolId, services);
  if (!tool) return { ok: false, reason: 'TOOL_NOT_FOUND', status: 404 };
  const decision = await governance.buildToolGovernanceDecision(tool, input, context, services);
  await audit.recordToolAudit({
    action: 'tool/run_attempted',
    toolId: tool.id,
    actionType: tool.actionType,
    riskLevel: decision.riskLevel,
    userId: decision.userId,
    workspaceId: decision.workspaceId,
    actorId: decision.actorId,
    actorRole: decision.actorRole,
    permission: decision.permission,
    decision: decision.allowed ? 'allowed' : 'denied',
    status: decision.allowed ? 'ok' : 'denied',
    reason: decision.reason
  }, services);
  if (!decision.allowed) return { ok: false, reason: decision.reason, governance: decision, status: 403 };
  if (decision.requiresApproval && !context.approvedExecution) {
    await audit.recordToolAudit({
      action: 'tool/approval_required',
      toolId: tool.id,
      actionType: tool.actionType,
      riskLevel: decision.riskLevel,
      userId: decision.userId,
      workspaceId: decision.workspaceId,
      actorId: decision.actorId,
      actorRole: decision.actorRole,
      permission: decision.permission,
      decision: 'denied',
      status: 'approval_required',
      reason: 'approval required'
    }, services);
    return { ok: false, reason: 'TOOL_REQUIRES_APPROVAL', requiresApproval: true, governance: decision, status: 403 };
  }
  const handler = registry.getToolHandler(tool.id);
  if (!handler) return { ok: false, reason: 'TOOL_HANDLER_MISSING', status: 500 };
  try {
    const result = await withTimeout(Promise.resolve(handler(decision.sanitizedInput, {
      ...context,
      actorId: decision.actorId,
      userId: decision.userId,
      workspaceId: decision.workspaceId,
      toolId: tool.id
    }, services)), tool.timeoutMs || 10000);
    const latencyMs = Date.now() - started;
    const ok = result?.ok !== false;
    await audit.recordToolRun({
      toolId: tool.id,
      actionType: tool.actionType,
      userId: decision.userId,
      workspaceId: decision.workspaceId,
      status: ok ? 'completed' : 'failed',
      success: ok,
      latencyMs,
      riskLevel: decision.riskLevel,
      requiresApproval: decision.requiresApproval,
      resultSummary: utils.compactText(result?.result?.text || result?.result?.recommendation || result?.status || '', 500),
      error: ok ? '' : (result?.error || result?.reason || 'TOOL_FAILED')
    }, services);
    await audit.recordToolAudit({
      action: ok ? 'tool/run_completed' : 'tool/run_failed',
      toolId: tool.id,
      actionType: tool.actionType,
      riskLevel: decision.riskLevel,
      userId: decision.userId,
      workspaceId: decision.workspaceId,
      actorId: decision.actorId,
      actorRole: decision.actorRole,
      permission: decision.permission,
      status: ok ? 'ok' : 'failed',
      reason: ok ? '' : (result?.error || result?.reason || 'TOOL_FAILED'),
      summary: { latencyMs, result: governance.sanitizeToolOutput(result?.result || result) }
    }, services);
    return { ok, tool: utils.summarizeTool(tool), result: governance.sanitizeToolOutput(result?.result || result), error: ok ? '' : (result?.error || result?.reason || 'TOOL_FAILED'), governance: decision, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - started;
    await audit.recordToolRun({
      toolId: tool.id,
      actionType: tool.actionType,
      userId: decision.userId,
      workspaceId: decision.workspaceId,
      status: 'failed',
      success: false,
      latencyMs,
      riskLevel: decision.riskLevel,
      requiresApproval: decision.requiresApproval,
      error: err.message
    }, services);
    await audit.recordToolAudit({
      action: 'tool/run_failed',
      toolId: tool.id,
      actionType: tool.actionType,
      riskLevel: decision.riskLevel,
      userId: decision.userId,
      workspaceId: decision.workspaceId,
      actorId: decision.actorId,
      actorRole: decision.actorRole,
      permission: decision.permission,
      status: 'failed',
      reason: err.message
    }, services);
    return { ok: false, reason: err.message, governance: decision, latencyMs };
  }
}

async function buildToolExecutionProposal(toolId, input = {}, context = {}, services = {}) {
  await ensureTools(services);
  const tool = await registry.getTool(toolId, services);
  if (!tool) return { ok: false, reason: 'TOOL_NOT_FOUND', status: 404 };
  const decision = await governance.buildToolGovernanceDecision(tool, input, context, services);
  if (!decision.allowed) return { ok: false, reason: decision.reason, governance: decision, status: 403 };
  const executor = require('../executor');
  const result = await executor.executionPlanner.createExecutionProposal({
    actorId: decision.actorId,
    userId: decision.userId,
    workspaceId: decision.workspaceId,
    sourceType: context.sourceType || 'dashboard',
    sourceId: context.sourceId || tool.id,
    title: context.title || `Run tool: ${tool.name}`,
    description: context.description || `Human-approved proposal to run tool ${tool.id}.`,
    proposedActions: [{
      type: 'tool.run',
      targetType: 'tool',
      targetId: tool.id,
      description: `Run registered tool ${tool.id}`,
      payload: {
        toolId: tool.id,
        input: decision.sanitizedInput,
        context: {
          sourceType: context.sourceType || '',
          sourceId: context.sourceId || ''
        }
      },
      riskLevel: decision.riskLevel
    }]
  }, services);
  if (result.ok) {
    await audit.recordToolAudit({
      action: 'tool/proposal_created',
      toolId: tool.id,
      actionType: tool.actionType,
      riskLevel: decision.riskLevel,
      userId: decision.userId,
      workspaceId: decision.workspaceId,
      actorId: decision.actorId,
      actorRole: decision.actorRole,
      permission: decision.permission,
      summary: { proposalId: result.proposal.id }
    }, services);
  }
  return result;
}

async function runApprovedToolAction(action = {}, services = {}) {
  const payload = action.payload || {};
  const toolId = payload.toolId || action.targetId;
  const input = payload.input || {};
  return runTool(toolId, input, {
    ...(payload.context || {}),
    approvedExecution: true,
    actorId: services.actorId || action.userId,
    userId: action.userId,
    workspaceId: action.workspaceId,
    targetId: action.targetId
  }, services);
}

module.exports = {
  buildToolExecutionProposal,
  previewToolRun,
  runApprovedToolAction,
  runTool
};
