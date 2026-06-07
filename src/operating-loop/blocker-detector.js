'use strict';

function nowIso() {
  return new Date().toISOString();
}

function generateBlockerId() {
  return 'blocker_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function makeBlocker(type, severity, module, title, description, suggestedAction, requiresImmediate) {
  return {
    id: generateBlockerId(),
    type,
    severity,
    module,
    title,
    description,
    suggestedAction,
    requiresImmediateAttention: requiresImmediate || false
  };
}

async function detectOperatingBlockers(snapshot, services = {}) {
  const blockers = [];

  if (!snapshot) return blockers;

  const critical = detectCriticalSafetyBlocker(snapshot);
  if (critical) blockers.push(critical);

  const deploy = detectDeployBlocker(snapshot);
  if (deploy) blockers.push(deploy);

  const dashboard = detectDashboardBlocker(snapshot);
  if (dashboard) blockers.push(dashboard);

  const executor = detectExecutorBlocker(snapshot);
  if (executor) blockers.push(executor);

  const integration = detectIntegrationGateBlocker(snapshot);
  if (integration) blockers.push(integration);

  const cost = detectCostBlocker(snapshot);
  if (cost) blockers.push(cost);

  const portfolio = detectPortfolioBlocker(snapshot);
  if (portfolio) blockers.push(portfolio);

  const lifeos = detectLifeOSBlocker(snapshot);
  if (lifeos) blockers.push(lifeos);

  return blockers;
}

function detectCriticalSafetyBlocker(snapshot) {
  const modules = snapshot.modules || {};
  const uptime = snapshot.systemUptime || process.uptime();

  if (uptime < 10) {
    return makeBlocker(
      'critical_safety',
      'critical',
      'system',
      'Application just started',
      'App uptime is under 10 seconds — system may still be initializing or crashing on startup.',
      'Wait for startup to complete or check startup logs.',
      true
    );
  }

  const observability = modules.observability || modules.monitoring || {};
  if (observability.secretIncident) {
    return makeBlocker(
      'critical_safety',
      'critical',
      'observability',
      'Secret leak detected',
      'Observability has reported a secret/credential leak incident.',
      'Investigate and rotate leaked secrets immediately. Revoke exposed tokens.',
      true
    );
  }

  if (observability.secretLeak || observability.incident?.type === 'secret_leak') {
    return makeBlocker(
      'critical_safety',
      'critical',
      'observability',
      'Secret leak detected',
      'Observability has reported a secret/credential leak incident.',
      'Investigate and rotate leaked secrets immediately. Revoke exposed tokens.',
      true
    );
  }

  return null;
}

function detectDeployBlocker(snapshot) {
  const modules = snapshot.modules || {};
  const deploy = modules.deploy || modules.cicd || {};

  if (deploy.lastDeployFailed || deploy.status === 'failed') {
    return makeBlocker(
      'deploy',
      'high',
      'deploy',
      'Last deployment failed',
      'The most recent deployment attempt has failed.',
      'Diagnose deployment failure and create a repair plan.',
      false
    );
  }

  if (deploy.rollbackInProgress || deploy.rollbackBypass) {
    return makeBlocker(
      'deploy',
      'critical',
      'deploy',
      'Rollback bypass detected',
      'A deploy/rollback bypass was detected outside the approved proposal flow.',
      'Stop the bypass and ensure rollback goes through Evaluation v2 → executor proposal → approval.',
      true
    );
  }

  return null;
}

function detectDashboardBlocker(snapshot) {
  const modules = snapshot.modules || {};
  const dashboard = modules.dashboard || {};

  if (dashboard.knownTabFallback) {
    return makeBlocker(
      'dashboard',
      'high',
      'dashboard',
      'Dashboard known tab fallback to Overview',
      'A known dashboard tab fell back to System Overview instead of its intended route.',
      'Register the missing route and ensure known tabs resolve correctly.',
      false
    );
  }

  return null;
}

function detectExecutorBlocker(snapshot) {
  const modules = snapshot.modules || {};
  const executor = modules.executor || {};

  if (executor.bypassDetected || executor.safetyBypass) {
    return makeBlocker(
      'executor',
      'critical',
      'executor',
      'Executor bypass detected',
      'An executor safety bypass or direct execution was detected outside the proposal system.',
      'Investigate the bypass source and reinforce the executor proposal gate.',
      true
    );
  }

  return null;
}

function detectIntegrationGateBlocker(snapshot) {
  const modules = snapshot.modules || {};
  const integration = modules.integrations || modules.integration || {};

  if (integration.gateFailed || integration.gateStatus === 'failed') {
    return makeBlocker(
      'integration',
      'high',
      'integrations',
      'Integration gate check failed',
      'One or more integration gate checks have failed.',
      'Review integration gate results and resolve failures.',
      false
    );
  }

  return null;
}

function detectCostBlocker(snapshot) {
  const modules = snapshot.modules || {};
  const cost = modules.cost || {};

  if (cost.budgetExceeded || cost.overBudget) {
    return makeBlocker(
      'cost',
      'medium',
      'cost',
      'Budget exceeded',
      'Operating cost has exceeded the allocated budget threshold.',
      'Review cost report and create a cost-saving plan.',
      false
    );
  }

  if (cost.highCostWarning) {
    return makeBlocker(
      'cost',
      'medium',
      'cost',
      'High operating cost detected',
      'Current operating costs are higher than expected.',
      'Consider cheaper execution modes or consolidate operations.',
      false
    );
  }

  return null;
}

function detectPortfolioBlocker(snapshot) {
  const modules = snapshot.modules || {};
  const portfolio = modules.portfolio || {};

  if (portfolio.staleProjects && portfolio.staleProjects.length > 5) {
    return makeBlocker(
      'portfolio',
      'low',
      'portfolio',
      'Multiple stale projects',
      `${portfolio.staleProjects.length} project(s) have not been updated recently.`,
      'Review portfolio staleness report and consider archiving or deprioritizing stale projects.',
      false
    );
  }

  if (portfolio.riskThresholdExceeded) {
    return makeBlocker(
      'portfolio',
      'medium',
      'portfolio',
      'Portfolio risk threshold exceeded',
      'Aggregated portfolio risk has exceeded the configured threshold.',
      'Run portfolio risk review and adjust project priorities.',
      false
    );
  }

  return null;
}

function detectLifeOSBlocker(snapshot) {
  const modules = snapshot.modules || {};
  const lifeos = modules.lifeos || modules['life-os'] || {};

  if (lifeos.pendingCriticalTasks && lifeos.pendingCriticalTasks > 0) {
    return makeBlocker(
      'lifeos',
      'medium',
      'lifeos',
      'Critical Life OS tasks pending',
      `${lifeos.pendingCriticalTasks} critical personal task(s) require attention.`,
      'Review Life OS task list and address critical items.',
      false
    );
  }

  if (lifeos.overdueReminders && lifeos.overdueReminders > 3) {
    return makeBlocker(
      'lifeos',
      'low',
      'lifeos',
      'Overdue Life OS reminders',
      `${lifeos.overdueReminders} reminder(s) are overdue.`,
      'Review and dismiss or reschedule overdue reminders.',
      false
    );
  }

  return null;
}

module.exports = {
  detectOperatingBlockers,
  detectCriticalSafetyBlocker,
  detectDeployBlocker,
  detectDashboardBlocker,
  detectExecutorBlocker,
  detectIntegrationGateBlocker,
  detectCostBlocker,
  detectPortfolioBlocker,
  detectLifeOSBlocker
};
