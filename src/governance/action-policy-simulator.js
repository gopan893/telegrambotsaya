'use strict';

const capabilityRegistry = require('./capability-registry');
const capabilityContracts = require('./capability-contracts');
const unifiedPermissionEngine = require('./unified-permission-engine');
const unifiedRiskEngine = require('./unified-risk-engine');
const unifiedSecretGuard = require('./unified-secret-guard');
const unifiedApprovalPolicy = require('./unified-approval-policy');
const unifiedEvaluationPolicy = require('./unified-evaluation-policy');
const unifiedCostPolicy = require('./unified-cost-policy');

const TELEGRAM_COMMAND_POLICY = {
  '/governance': { actionType: 'read', riskLevel: 'read_only', module: 'governance' },
  '/policy': { actionType: 'read', riskLevel: 'read_only', module: 'governance' },
  '/capabilities': { actionType: 'read', riskLevel: 'read_only', module: 'governance' },
  '/capability': { actionType: 'read', riskLevel: 'read_only', module: 'governance' },
  '/simulate_action': { actionType: 'dry_run', riskLevel: 'low', module: 'governance' },
  '/policycheck': { actionType: 'read', riskLevel: 'read_only', module: 'governance' },
  '/riskcheck': { actionType: 'read', riskLevel: 'read_only', module: 'governance' },
  '/secretcheck': { actionType: 'read', riskLevel: 'read_only', module: 'governance' },
  '/approvalpolicy': { actionType: 'read', riskLevel: 'read_only', module: 'governance' },
  '/evalpolicy': { actionType: 'read', riskLevel: 'read_only', module: 'governance' },
  '/blockedactions': { actionType: 'read', riskLevel: 'read_only', module: 'governance' },
  '/governance_audit': { actionType: 'read', riskLevel: 'read_only', module: 'governance' }
};

function simulateActionPolicy(action, actor, context) {
  const actionObj = typeof action === 'string' ? { name: action, action: action, actionType: 'unknown' } : action;
  const capability = capabilityRegistry.findCapabilityByAction(actionObj.name || actionObj.action || '');

  const risk = unifiedRiskEngine.buildRiskDecision(actionObj, context);
  const permission = unifiedPermissionEngine.checkGovernancePermission(actionObj, actor, context, {});
  const approval = unifiedApprovalPolicy.buildApprovalDecision(actionObj, risk, context);
  const evalReq = unifiedEvaluationPolicy.determineEvaluationRequirement(actionObj, risk, context);
  const costGuard = unifiedCostPolicy.determineCostGuardRequirement(actionObj, context);

  const secretScan = context && context.payload
    ? unifiedSecretGuard.scanGovernancePayloadForSecrets(context.payload)
    : { hasSecret: false, matches: [] };

  let simulatedOutcome = 'allow_read';
  const reasons = [];

  if (risk.blocked || risk.riskLevel === 'blocked') {
    simulatedOutcome = 'block';
    reasons.push('Action is blocked by risk engine');
  } else if (permission.allowed === false) {
    simulatedOutcome = 'block';
    reasons.push(...permission.reasons);
  } else if (approval.blocked) {
    simulatedOutcome = 'block';
    reasons.push('Action is blocked by approval policy');
  } else if (approval.requiresApproval) {
    simulatedOutcome = 'require_approval';
    reasons.push('Approval required');
  } else if (evalReq.evaluationRequired) {
    simulatedOutcome = 'require_evaluation';
    reasons.push('Evaluation v2 required');
  } else if (secretScan.hasSecret) {
    simulatedOutcome = 'create_proposal';
    reasons.push('Secret detected, proposal required');
  } else if (risk.riskLevel === 'high') {
    simulatedOutcome = 'create_proposal';
    reasons.push('High risk action');
  } else if (risk.riskLevel === 'read_only' || risk.riskLevel === 'low') {
    simulatedOutcome = 'allow_read';
  } else {
    simulatedOutcome = 'allow_dry_run';
  }

  return {
    action: actionObj.name || actionObj.action || 'unknown',
    capability: capability ? { id: capability.id, module: capability.module, riskLevel: capability.riskLevel } : null,
    risk,
    permission: { allowed: permission.allowed, role: permission.role, reasons: permission.reasons },
    approval: { requiresApproval: approval.requiresApproval, requiresExecutor: approval.requiresExecutor, requiresOwner: approval.requiresOwner, canRunDirectly: approval.canRunDirectly },
    evaluation: evalReq,
    costGuard: { required: costGuard.costGuardRequired, reason: costGuard.reason },
    secretScan: { hasSecret: secretScan.hasSecret, matchCount: secretScan.matches.length },
    simulatedOutcome,
    reasons,
    allowed: simulatedOutcome !== 'block',
    note: 'SIMULATION ONLY — no action was executed.'
  };
}

function simulateTelegramCommand(command, args, actor) {
  const cmdLower = String(command || '').toLowerCase().trim().split(' ')[0];
  const policy = TELEGRAM_COMMAND_POLICY[cmdLower] || { actionType: 'read', riskLevel: 'read_only', module: 'telegram_control' };

  const action = {
    name: command,
    action: command,
    actionType: policy.actionType,
    module: policy.module
  };

  const context = { args, module: policy.module };
  return {
    ...simulateActionPolicy(action, actor, context),
    command: cmdLower,
    note: 'SIMULATION ONLY — no command was executed.'
  };
}

function simulateNaturalIntent(intent, actor) {
  const intentLower = String(intent || '').toLowerCase();
  let actionType = 'read';
  let riskLevel = 'read_only';
  let module = 'conversation';

  if (/policy|kebijakan|aturan|capability|kemampuan|izin/.test(intentLower)) {
    actionType = 'read';
    riskLevel = 'read_only';
    module = 'governance';
  } else if (/push|commit|deploy|rollback/.test(intentLower)) {
    actionType = 'external_write';
    riskLevel = 'high';
    module = 'githubops';
  } else if (/simulasi|simulate|coba|test|dry.run/.test(intentLower)) {
    actionType = 'dry_run';
    riskLevel = 'low';
    module = 'governance';
  } else if (/gmail|kirim.*(email|gmail)|send.*gmail/.test(intentLower)) {
    actionType = 'external_write';
    riskLevel = 'high';
    module = 'gmail';
  } else if (/restore|recover|pulihkan/.test(intentLower)) {
    actionType = 'dangerous';
    riskLevel = 'danger';
    module = 'backup';
  } else if (/memory|knowledge|simpan.*(token|secret|password)/.test(intentLower)) {
    actionType = 'internal_write';
    riskLevel = 'medium';
    module = 'memory';
  } else if (/operating.*loop.*deploy|otomatis.*deploy/.test(intentLower)) {
    actionType = 'external_write';
    riskLevel = 'high';
    module = 'operating_loop';
  }

  const action = { name: intent, action: intent, actionType, module };
  const context = { payload: intent, module };
  return {
    ...simulateActionPolicy(action, actor, context),
    intent: intentLower,
    detectedIntent: { actionType, riskLevel, module },
    note: 'SIMULATION ONLY — no action was executed.'
  };
}

function simulateModuleCapability(capabilityId, actor) {
  const capability = capabilityRegistry.getCapability(capabilityId);
  if (!capability) {
    return { error: `Capability "${capabilityId}" not found`, simulation: null };
  }

  const action = {
    name: capability.id,
    action: capability.id,
    actionType: capability.actionType,
    module: capability.module,
    externalSystem: capability.externalSystem
  };

  const context = { module: capability.module, capability };
  return {
    ...simulateActionPolicy(action, actor, context),
    capability: { id: capability.id, module: capability.module, name: capability.name },
    note: 'SIMULATION ONLY — no capability was invoked.'
  };
}

function buildPolicySimulationReport(simulation) {
  if (!simulation) return { error: 'No simulation data' };
  if (simulation.error) return simulation;

  const lines = [
    '=== Policy Simulation Report ===',
    `Action: ${simulation.action}`,
    `Outcome: ${simulation.simulatedOutcome}`,
    `Allowed: ${simulation.allowed ? '✅ Yes' : '❌ No'}`,
    '',
    'Risk Assessment:',
    `  Level: ${simulation.risk.riskLevel}`,
    `  Score: ${simulation.risk.riskScore}`,
    ...(simulation.risk.factors.length ? [`  Factors: ${simulation.risk.factors.join(', ')}`] : []),
    '',
    `Permission: ${simulation.permission.allowed ? '✅ Granted' : '❌ Denied'} (role: ${simulation.permission.role})`,
    `Approval: ${simulation.approval.requiresApproval ? '✅ Required' : '❌ Not required'}`,
    `Evaluation: ${simulation.evaluation.evaluationRequired ? '✅ Required' : '❌ Not required'}`,
    `Cost Guard: ${simulation.costGuard.required ? '✅ Required' : '❌ Not required'}`,
    `Secret Scan: ${simulation.secretScan.hasSecret ? '⚠️ Secrets found' : '✅ No secrets'}`,
    '',
    ...(simulation.reasons.length ? [`Reasons: ${simulation.reasons.join('; ')}`] : []),
    '',
    simulation.note
  ];

  return lines.join('\n');
}

module.exports = {
  simulateActionPolicy,
  simulateTelegramCommand,
  simulateNaturalIntent,
  simulateModuleCapability,
  buildPolicySimulationReport,
  TELEGRAM_COMMAND_POLICY
};
