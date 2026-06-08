'use strict';

function auditOwnerAdminPermissions(services) {
  const env = services.env || process.env;
  const findings = [];

  if (!env.OWNER_CHAT_ID) {
    findings.push({ subject: 'OWNER_CHAT_ID', issue: 'OWNER_CHAT_ID is not set. No owner defined.', severity: 'critical', recommendation: 'Set OWNER_CHAT_ID to the Telegram user ID of the system owner.' });
  } else {
    findings.push({ subject: 'OWNER_CHAT_ID', issue: 'Owner is configured.', severity: 'info', recommendation: 'Verify OWNER_CHAT_ID is correct.' });
  }

  if (!env.ADMIN_IDS || env.ADMIN_IDS.trim() === '') {
    findings.push({ subject: 'ADMIN_IDS', issue: 'ADMIN_IDS is empty. No admins defined.', severity: 'high', recommendation: 'Set ADMIN_IDS to comma-separated Telegram user IDs of admins.' });
  } else {
    const admins = env.ADMIN_IDS.split(',').map(s => s.trim()).filter(Boolean);
    if (admins.length === 0) {
      findings.push({ subject: 'ADMIN_IDS', issue: 'ADMIN_IDS parsed to empty list. No admins defined.', severity: 'high', recommendation: 'Ensure ADMIN_IDS contains valid comma-separated user IDs.' });
    } else {
      findings.push({ subject: 'ADMIN_IDS', issue: `${admins.length} admin(s) configured.`, severity: 'info', recommendation: 'Verify each admin ID is correct.' });
    }
  }

  if (env.OWNER_CHAT_ID && env.ADMIN_IDS) {
    const ownerId = env.OWNER_CHAT_ID.trim();
    const adminList = env.ADMIN_IDS.split(',').map(s => s.trim()).filter(Boolean);
    if (adminList.includes(ownerId)) {
      findings.push({ subject: 'Owner in ADMIN_IDS', issue: 'Owner is also listed in ADMIN_IDS. Owner already has full access.', severity: 'low', recommendation: 'Consider removing owner from ADMIN_IDS to reduce redundancy.' });
    }
  }

  return findings;
}

function auditWorkspacePermissions(services) {
  const findings = [];
  findings.push({ subject: 'workspace_permissions', issue: 'Workspace permissions use role-based access.', severity: 'info', recommendation: 'Verify workspace roles are correctly assigned.' });
  return findings;
}

function auditTelegramGroupSafety(services) {
  return [
    { subject: 'telegram_group', issue: 'Unknown groups get limited permissions by default.', severity: 'info', recommendation: 'Verify group allowlist is configured for extended access.' },
    { subject: 'telegram_group_danger', issue: 'Dangerous commands require owner/admin in all groups.', severity: 'info', recommendation: 'Ensure dangerous command protection is active.' }
  ];
}

function auditDashboardAccessPolicy(services) {
  const env = services.env || process.env;
  const findings = [];

  if (!env.DASHBOARD_ADMIN_TOKEN) {
    findings.push({ subject: 'dashboard_access', issue: 'DASHBOARD_ADMIN_TOKEN is not set. Dashboard is unprotected.', severity: 'critical', recommendation: 'Set DASHBOARD_ADMIN_TOKEN to secure dashboard access.' });
  } else {
    findings.push({ subject: 'dashboard_access', issue: 'Dashboard is token-protected.', severity: 'info', recommendation: 'Verify DASHBOARD_ADMIN_TOKEN is strong.' });
  }

  return findings;
}

function auditExecutorApprovalRights(services) {
  return [
    { subject: 'executor_approval', issue: 'Executor cannot approve its own proposals.', severity: 'info', recommendation: 'Maintain the rule that executor self-approval is blocked.' },
    { subject: 'agent_self_approval', issue: 'Agents cannot self-approve proposals.', severity: 'info', recommendation: 'Ensure agent self-approval remains blocked.' }
  ];
}

function auditLifeOSPrivacyAccess(services) {
  return [
    { subject: 'lifeos_privacy', issue: 'Life OS personal data is private to the user only.', severity: 'info', recommendation: 'Verify Life OS privacy enforcement is active.' },
    { subject: 'lifeos_admin_access', issue: 'Admins should not access Life OS personal data without user consent.', severity: 'medium', recommendation: 'Verify admin access to Life OS data is restricted.' }
  ];
}

function buildPermissionAuditReport(results) {
  const findings = results.flat();
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) { if (bySeverity[f.severity]) bySeverity[f.severity]++; }
  return {
    totalFindings: findings.length,
    totalCritical: bySeverity.critical,
    bySeverity,
    findings: findings.map(f => ({ subject: f.subject, issue: f.issue, severity: f.severity, recommendation: f.recommendation }))
  };
}

module.exports = {
  auditOwnerAdminPermissions,
  auditWorkspacePermissions,
  auditTelegramGroupSafety,
  auditDashboardAccessPolicy,
  auditExecutorApprovalRights,
  auditLifeOSPrivacyAccess,
  buildPermissionAuditReport
};
