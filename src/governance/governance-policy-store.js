'use strict';

const POLICY_STORE = {
  governance: {
    version: '1.0.0',
    created: new Date().toISOString(),
    rules: {
      noDirectExternalWrite: true,
      noDirectGitHubPush: true,
      noDirectWorkflowDispatch: true,
      noDirectDeployRollback: true,
      noDirectGmailSend: true,
      noDirectCalendarWrite: true,
      noDirectWebhookPost: true,
      noShellExecutor: true,
      noAutoApprove: true,
      noAutoRunWriteExternalDanger: true,
      noSelfModifyingPolicy: true,
      noHiddenPolicyBypass: true,
      noUnsafeAdminBackdoor: true,
      noHardDeletePolicyLogs: true,
      noSecretExposure: true,
      noDirectRepoMutation: true,
      botToBotLoopBlocked: true
    },
    approvalFlow: [
      'dry_run',
      'evaluation_v2',
      'executor_proposal',
      'approval',
      'run'
    ],
    defaultRiskLevel: 'read_only',
    defaultActionType: 'read',
    policySimulationOnly: true,
    secretRedactionPattern: '[REDACTED_SECRET]'
  }
};

function getGovernancePolicy() {
  return JSON.parse(JSON.stringify(POLICY_STORE.governance));
}

function getGovernanceRules() {
  return { ...POLICY_STORE.governance.rules };
}

function getApprovalFlow() {
  return [...POLICY_STORE.governance.approvalFlow];
}

function validateActionAgainstPolicy(action, actionType) {
  const rules = POLICY_STORE.governance.rules;
  const violations = [];

  if (actionType === 'external_write' || actionType === 'dangerous' || actionType === 'destructive') {
    if (rules.noDirectExternalWrite) violations.push('DIRECT_EXTERNAL_WRITE_BLOCKED');
    if (rules.noAutoRunWriteExternalDanger) violations.push('AUTO_RUN_BLOCKED');
  }

  if (/github.*push/i.test(action) && rules.noDirectGitHubPush) violations.push('DIRECT_GITHUB_PUSH_BLOCKED');
  if (/workflow.*dispatch/i.test(action) && rules.noDirectWorkflowDispatch) violations.push('DIRECT_WORKFLOW_DISPATCH_BLOCKED');
  if (/deploy|rollback/i.test(action) && rules.noDirectDeployRollback) violations.push('DIRECT_DEPLOY_ROLLBACK_BLOCKED');
  if (/gmail.*send/i.test(action) && rules.noDirectGmailSend) violations.push('DIRECT_GMAIL_SEND_BLOCKED');
  if (/calendar.*(write|create|update|delete)/i.test(action) && rules.noDirectCalendarWrite) violations.push('DIRECT_CALENDAR_WRITE_BLOCKED');
  if (/webhook.*post/i.test(action) && rules.noDirectWebhookPost) violations.push('DIRECT_WEBHOOK_POST_BLOCKED');

  return {
    allowed: violations.length === 0,
    violations,
    action,
    actionType
  };
}

module.exports = {
  getGovernancePolicy,
  getGovernanceRules,
  getApprovalFlow,
  validateActionAgainstPolicy
};
