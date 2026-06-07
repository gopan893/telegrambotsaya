'use strict';

const RISK_LEVELS = ['read_only', 'low', 'medium', 'high', 'danger'];
const RISK_RANK = { read_only: 0, low: 1, medium: 2, high: 3, danger: 4 };

const DANGER_ACTIONS = [
  'push', 'deploy', 'rollback', 'restore', 'backup_danger',
  'shell_exec', 'workflow_dispatch', 'hard_delete'
];

const HIGH_ACTIONS = [
  'approve', 'run_exec', 'propose_push', 'propose_deploy',
  'propose_rollback', 'propose_workflow_run', 'propose_incident_repair',
  'propose_incident_rollback', 'gmail_send', 'calendar_write',
  'webhook_post', 'github_create', 'permission_change'
];

const MEDIUM_ACTIONS = [
  'reject', 'cancel_exec', 'backup_create', 'memory_cleanup',
  'goal_create', 'operator_proposal', 'portfolio_proposal',
  'budget_set', 'close_incident', 'run_routine'
];

const LOW_ACTIONS = [
  'settings_change', 'multibot_toggle', 'routine_toggle',
  'council_start', 'debate_start', 'task_done', 'habit_checkin',
  'mood_log', 'energy_log', 'code_request', 'code_plan',
  'commit_plan', 'push_plan', 'post_deploy_check', 'selfheal_run',
  'integration_eval', 'economy_toggle', 'quality_toggle',
  'compress_toggle', 'remember_project'
];

function classifyTelegramCommandRisk(command) {
  if (!command) return { level: 'unknown', rank: -1, explanation: 'No command provided' };

  const riskLevel = command.riskLevel || 'read_only';
  const rank = RISK_RANK[riskLevel] !== undefined ? RISK_RANK[riskLevel] : 0;
  const actionType = command.module || 'unknown';

  const explanations = {
    read_only: 'Read-only information request. No side effects.',
    low: 'Low-risk action. May change user preferences or non-critical settings.',
    medium: 'Medium-risk action. May modify data or trigger non-critical operations.',
    high: 'High-risk action. May write data or trigger significant operations. Requires approval.',
    danger: 'Dangerous action. May cause data loss, deploy changes, or external mutations. Requires approval and evaluation.'
  };

  return {
    level: riskLevel,
    rank,
    actionType,
    explanation: explanations[riskLevel] || 'Unknown risk level',
    requiresApproval: RISK_RANK[riskLevel] >= RISK_RANK['high'],
    requiresEvaluation: RISK_RANK[riskLevel] >= RISK_RANK['high']
  };
}

function classifyTelegramNaturalRisk(intent) {
  if (!intent) return { level: 'unknown', rank: -1, explanation: 'No intent' };

  const intentStr = typeof intent === 'string' ? intent : (intent.intent || '');

  if (HIGH_ACTIONS.some(a => intentStr.includes(a))) {
    return { level: 'high', rank: 3, actionType: intentStr, explanation: 'High-risk action. Requires approval and evaluation.', requiresApproval: true, requiresEvaluation: true };
  }
  if (DANGER_ACTIONS.some(a => intentStr.includes(a))) {
    return { level: 'danger', rank: 4, actionType: intentStr, explanation: 'Dangerous action. May cause data loss or external mutations.', requiresApproval: true, requiresEvaluation: true };
  }
  if (MEDIUM_ACTIONS.some(a => intentStr.includes(a))) {
    return { level: 'medium', rank: 2, actionType: intentStr, explanation: 'Medium-risk action. May modify data.', requiresApproval: false, requiresEvaluation: false };
  }
  if (LOW_ACTIONS.some(a => intentStr.includes(a))) {
    return { level: 'low', rank: 1, actionType: intentStr, explanation: 'Low-risk action.', requiresApproval: false, requiresEvaluation: false };
  }

  const readOnlyIntents = ['help', 'menu', 'status', 'health', 'whoami', 'dashboard',
    'greeting', 'thanks', 'confirmation', 'rejection', 'unknown', 'followup_answer',
    'prod_health', 'list_incidents', 'usage_check', 'daily_plan', 'weekly_plan',
    'tasks', 'habits', 'focus', 'reminders', 'knowledge', 'portfolio', 'goals',
    'priorities', 'plans', 'integrations', 'backup', 'briefing', 'portfolioreport',
    'lifereport', 'decision_memory', 'knowledge_search', 'tool_recommendation'];

  if (readOnlyIntents.includes(intentStr)) {
    return { level: 'read_only', rank: 0, actionType: intentStr, explanation: 'Read-only information request.', requiresApproval: false, requiresEvaluation: false };
  }

  return { level: 'read_only', rank: 0, actionType: intentStr, explanation: 'Default read-only classification.', requiresApproval: false, requiresEvaluation: false };
}

function requiresEvaluationGate(risk, actionType) {
  if (!risk) return false;
  const rank = typeof risk === 'object' ? risk.rank : RISK_RANK[risk] || 0;
  return rank >= RISK_RANK['high'];
}

function requiresExecutorProposal(risk, actionType) {
  if (!risk) return false;
  const rank = typeof risk === 'object' ? risk.rank : RISK_RANK[risk] || 0;
  return rank >= RISK_RANK['medium'] && (actionType ? !['read_only', 'low'].includes(actionType) : true);
}

function buildRiskExplanation(risk) {
  if (!risk) return 'Unknown risk';
  if (typeof risk === 'string') {
    const found = RISK_LEVELS.find(l => l === risk);
    if (!found) return `Unknown risk level: ${risk}`;
    const descriptions = {
      read_only: 'Read-only. No side effects.',
      low: 'Low risk. Safe to proceed.',
      medium: 'Medium risk. Consider approval.',
      high: 'High risk. Requires approval and evaluation.',
      danger: 'Danger. Requires approval and evaluation.'
    };
    return descriptions[risk] || 'Unknown risk';
  }
  return risk.explanation || 'No explanation';
}

module.exports = {
  RISK_LEVELS,
  RISK_RANK,
  classifyTelegramCommandRisk,
  classifyTelegramNaturalRisk,
  requiresEvaluationGate,
  requiresExecutorProposal,
  buildRiskExplanation
};
