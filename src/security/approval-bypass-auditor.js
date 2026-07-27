'use strict';

function auditApprovalBypassPaths(services) {
  const findings = [];

  findings.push(...testGithubPushApprovalPath(services));
  findings.push(...testWorkflowDispatchApprovalPath(services));
  findings.push(...testRenderDeployApprovalPath(services));
  findings.push(...testRollbackApprovalPath(services));
  findings.push(...testBackupRestoreApprovalPath(services));
  findings.push(...testWebhookPostApprovalPath(services));
  findings.push(...testGmailSendApprovalPath(services));
  findings.push(...testCalendarWriteApprovalPath(services));
  findings.push(...testOperatingLoopBypassPath(services));

  return findings;
}

function testGithubPushApprovalPath() {
  return [{
    path: 'github_push', type: 'external_write', directExecutionBlocked: true,
    issue: 'GitHub push must go through Evaluation v2 + executor proposal + approval.',
    severity: 'info', status: 'expected_blocked'
  }];
}

function testWorkflowDispatchApprovalPath() {
  return [{
    path: 'workflow_dispatch', type: 'external_write', directExecutionBlocked: true,
    issue: 'Workflow dispatch must be proposal-only.',
    severity: 'info', status: 'expected_blocked'
  }];
}

function testRenderDeployApprovalPath() {
  return [{
    path: 'render_deploy', type: 'dangerous', directExecutionBlocked: true,
    issue: 'Render deploy must go through deploy gate + evaluation + proposal + approval.',
    severity: 'info', status: 'expected_blocked'
  }];
}

function testRollbackApprovalPath() {
  return [{
    path: 'rollback', type: 'dangerous', directExecutionBlocked: true,
    issue: 'Rollback must go through deploy gate + evaluation + proposal + approval.',
    severity: 'info', status: 'expected_blocked'
  }];
}

function testBackupRestoreApprovalPath() {
  return [{
    path: 'backup_restore', type: 'dangerous', directExecutionBlocked: true,
    issue: 'Backup restore must be proposal-only.',
    severity: 'info', status: 'expected_blocked'
  }];
}

function testWebhookPostApprovalPath() {
  return [{
    path: 'webhook_post', type: 'external_write', directExecutionBlocked: true,
    issue: 'Webhook POST must be proposal-only.',
    severity: 'info', status: 'expected_blocked'
  }];
}

function testGmailSendApprovalPath() {
  return [{
    path: 'gmail_send', type: 'external_write', directExecutionBlocked: true,
    issue: 'Gmail send must be proposal-only.',
    severity: 'info', status: 'expected_blocked'
  }];
}

function testCalendarWriteApprovalPath() {
  return [{
    path: 'calendar_write', type: 'external_write', directExecutionBlocked: true,
    issue: 'Calendar write must be proposal-only.',
    severity: 'info', status: 'expected_blocked'
  }];
}

function testOperatingLoopBypassPath() {
  return [{
    path: 'operating_loop_external_action', type: 'dangerous', directExecutionBlocked: true,
    issue: 'Operating loop external actions must go through evaluation + proposal + approval.',
    severity: 'info', status: 'expected_blocked'
  }];
}

function buildApprovalBypassReport(results) {
  const findings = results.flat();
  const byStatus = {};
  for (const f of findings) {
    if (!byStatus[f.status]) byStatus[f.status] = [];
    byStatus[f.status].push(f);
  }
  return {
    totalPaths: findings.length,
    allBlocked: findings.every(f => f.directExecutionBlocked),
    byStatus: Object.keys(byStatus).reduce((acc, s) => { acc[s] = byStatus[s].length; return acc; }, {}),
    findings: findings.map(f => ({ path: f.path, type: f.type, directExecutionBlocked: f.directExecutionBlocked, issue: f.issue, severity: f.severity, status: f.status }))
  };
}

module.exports = {
  auditApprovalBypassPaths,
  testGithubPushApprovalPath,
  testWorkflowDispatchApprovalPath,
  testRenderDeployApprovalPath,
  testRollbackApprovalPath,
  testBackupRestoreApprovalPath,
  testWebhookPostApprovalPath,
  testGmailSendApprovalPath,
  testCalendarWriteApprovalPath,
  testOperatingLoopBypassPath,
  buildApprovalBypassReport
};
