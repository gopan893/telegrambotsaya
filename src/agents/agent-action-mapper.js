'use strict';

const detector = require('./agent-action-detector');
const utils = require('./delegation-utils');

const SUPPORTED_ACTIONS = [
  'backup.create',
  'backup.validate',
  'recovery.check',
  'integrity.check',
  'ops.diagnostics.run',
  'ops.benchmark.light',
  'planner.task.mark_done',
  'planner.task.mark_blocked',
  'workflow.step.add',
  'workflow.step.done',
  'goal.progress.update',
  'memory.suggest_archive',
  'report.health.export',
  'report.user_summary.export',
  'tool.preview',
  'tool.run_safe_readonly',
  'restore.run',
  'import.run'
];

const UNSUPPORTED_PATTERNS = /\b(shell|arbitrary code|javascript|node -e|rm -rf|env change|config change|ubah env|delete permanen|hard delete)\b/i;

function normalizeActionType(type = '') {
  const clean = String(type || '').trim();
  if (clean === 'proposal.create') return 'report.health.export';
  if (clean === 'decision.apply') return 'report.user_summary.export';
  if (clean === 'delegation.apply') return 'report.user_summary.export';
  return clean;
}

function buildPayloadForIntent(intent = {}, text = '', context = {}) {
  const actionType = normalizeActionType(intent.actionType);
  const base = {
    text: utils.sanitizeDelegationText(text, { max: 420 }),
    source: context.source || intent.source || 'natural_chat'
  };
  if (actionType === 'backup.create') return { scope: 'workspace', workspaceId: context.workspaceId || intent.workspaceId || 'default' };
  if (actionType === 'backup.validate') return { backupId: intent.targetId || context.backupId || '' };
  if (actionType === 'planner.task.mark_done') return { taskId: intent.targetId || context.taskId || '' };
  if (actionType === 'planner.task.mark_blocked') return { taskId: intent.targetId || context.taskId || '', reason: 'Blocked via approved agent proposal.' };
  if (actionType === 'goal.progress.update') return { goalId: intent.targetId || context.goalId || '', progress: Number(context.progress || 10) };
  if (actionType === 'workflow.step.add') return { workflowId: intent.targetId || context.workflowId || '', title: 'Approved agent step', description: base.text };
  if (actionType === 'workflow.step.done') return { workflowId: intent.targetId || context.workflowId || '', stepNumber: context.stepNumber || '' };
  if (actionType === 'restore.run') return { backupId: intent.targetId || context.backupId || '', confirmationRequired: 'RESTORE' };
  if (actionType === 'import.run') return { importJobId: context.importJobId || '', confirmationRequired: 'RESTORE' };
  if (actionType === 'memory.suggest_archive') return { memoryId: intent.targetId || context.memoryId || '', reason: base.text };
  if (actionType === 'tool.preview' || actionType === 'tool.run_safe_readonly') return { toolId: context.toolId || '', input: context.input || {} };
  return base;
}

function mapIntentToActions(intent = {}, context = {}) {
  const text = context.text || context.message || '';
  if (UNSUPPORTED_PATTERNS.test(text) || UNSUPPORTED_PATTERNS.test(intent.actionType || '')) {
    return { ok: false, reason: 'UNSUPPORTED_ACTION_REQUEST', actions: [] };
  }
  const actionType = normalizeActionType(intent.actionType);
  if (!actionType || !SUPPORTED_ACTIONS.includes(actionType)) {
    return { ok: false, reason: 'ACTION_MAPPING_UNSUPPORTED', actions: [] };
  }
  const riskLevel = detector.inferActionRisk(actionType, text);
  const action = {
    type: actionType,
    toolId: actionType.startsWith('tool.') ? context.toolId || '' : '',
    targetType: intent.targetType || context.targetType || 'manual',
    targetId: intent.targetId || context.targetId || '',
    workspaceId: context.workspaceId || intent.workspaceId || 'default',
    userId: context.userId || intent.userId || '',
    description: buildActionDescription(actionType, text),
    payload: buildPayloadForIntent({ ...intent, actionType }, text, context),
    riskLevel,
    requiresApproval: true,
    reversible: !['restore.run', 'import.run'].includes(actionType) && riskLevel !== 'danger',
    expectedResult: expectedResult(actionType),
    validationPlan: validationPlan(actionType)
  };
  return { ok: true, actions: [action] };
}

function buildActionDescription(actionType, text = '') {
  const summary = utils.sanitizeDelegationText(text, { max: 180 });
  const labels = {
    'backup.create': 'Create a sanitized workspace backup',
    'backup.validate': 'Validate backup metadata and checksum',
    'recovery.check': 'Run disaster recovery check',
    'integrity.check': 'Run data integrity check',
    'ops.diagnostics.run': 'Run read-only diagnostics',
    'ops.benchmark.light': 'Run light benchmark',
    'planner.task.mark_done': 'Mark planner task as done',
    'planner.task.mark_blocked': 'Mark planner task as blocked',
    'workflow.step.add': 'Add workflow step',
    'workflow.step.done': 'Mark workflow step done',
    'goal.progress.update': 'Update goal progress',
    'memory.suggest_archive': 'Suggest memory archive',
    'report.health.export': 'Prepare health report',
    'report.user_summary.export': 'Prepare user summary report',
    'tool.preview': 'Preview registered tool safely',
    'tool.run_safe_readonly': 'Run safe read-only tool',
    'restore.run': 'Request restore flow with strong confirmation',
    'import.run': 'Request import flow with strong confirmation'
  };
  return `${labels[actionType] || actionType}${summary ? `: ${summary}` : ''}`;
}

function expectedResult(actionType) {
  if (actionType === 'restore.run') return 'Restore tidak berjalan langsung; perlu approval dan confirmation flow.';
  if (actionType === 'import.run') return 'Import tidak berjalan langsung; perlu validation, preview, approval, dan confirmation.';
  if (actionType === 'backup.create') return 'Backup aman dibuat setelah approval/run.';
  return 'Action berjalan setelah approval manusia dan dicatat di audit log.';
}

function validationPlan(actionType) {
  if (actionType.includes('backup')) return 'Cek backup manifest, checksum, dan audit log.';
  if (actionType.includes('restore') || actionType.includes('import')) return 'Cek confirmation RESTORE, integrity, checksum, dan audit log sebelum restore/import.';
  return 'Cek status source, result summary, dan audit log setelah run.';
}

module.exports = {
  SUPPORTED_ACTIONS,
  mapIntentToActions,
  normalizeActionType
};
