'use strict';

function nowIso() {
  return new Date().toISOString();
}

function generateActionId() {
  return 'action_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function makeAction(type, module, priority, title, description, opts = {}) {
  return {
    id: generateActionId(),
    type,
    module,
    priority,
    title,
    description,
    requiresApproval: opts.requiresApproval || false,
    requiresEvaluation: opts.requiresEvaluation || false,
    estimatedTokens: opts.estimatedTokens || 0,
    reasoning: opts.reasoning || ''
  };
}

async function synthesizeNextActions(snapshot, blockers = [], services = {}) {
  const actions = [];

  if (!snapshot) {
    actions.push(makeAction('read_report', 'system', 1, 'Collect system state', 'No snapshot available — collect system state first.', { reasoning: 'Initial data collection needed.' }));
    return actions;
  }

  const criticalBlocker = blockers.find(b => b.severity === 'critical');
  const highBlocker = blockers.find(b => b.severity === 'high');

  if (criticalBlocker) {
    actions.push(makeAction(
      'create_repair_plan',
      criticalBlocker.module,
      1,
      `Stabilize: ${criticalBlocker.title}`,
      criticalBlocker.description + ' ' + criticalBlocker.suggestedAction,
      { requiresEvaluation: true, requiresApproval: true, estimatedTokens: 800, reasoning: `Critical blocker: ${criticalBlocker.title}` }
    ));
    return actions;
  }

  if (highBlocker && highBlocker.type === 'deploy') {
    actions.push(makeAction(
      'create_repair_plan',
      'deploy',
      2,
      'Diagnose deployment failure',
      highBlocker.description + ' ' + highBlocker.suggestedAction,
      { requiresEvaluation: true, requiresApproval: true, estimatedTokens: 600, reasoning: 'Deploy failure needs diagnosis.' }
    ));
  }

  if (snapshot.pendingApprovals > 0) {
    actions.push(makeAction(
      'read_report',
      'system',
      3,
      'Review pending approvals',
      `${snapshot.pendingApprovals} approval(s) are pending review.`,
      { requiresApproval: false, estimatedTokens: 100, reasoning: 'Pending approvals block progress.' }
    ));
  }

  const costBlocker = blockers.find(b => b.type === 'cost');
  if (costBlocker) {
    actions.push(makeAction(
      'create_cost_saving_plan',
      'cost',
      4,
      'Reduce operating costs',
      costBlocker.description,
      { requiresEvaluation: true, requiresApproval: true, estimatedTokens: 500, reasoning: 'Cost optimization needed.' }
    ));
  }

  if (blockers.length === 0 && snapshot.healthStatus === 'healthy') {
    actions.push(makeAction(
      'read_report',
      'portfolio',
      5,
      'Review portfolio for next task',
      'All systems healthy — identify the next high-impact project task.',
      { requiresApproval: false, estimatedTokens: 200, reasoning: 'No blockers; proceed with portfolio work.' }
    ));
  }

  const lifeosBlocker = blockers.find(b => b.type === 'lifeos');
  if (lifeosBlocker && lifeosBlocker.severity === 'medium') {
    actions.push(makeAction(
      'create_lifeos_plan',
      'lifeos',
      6,
      'Address Life OS critical tasks',
      lifeosBlocker.description,
      { requiresEvaluation: false, requiresApproval: false, estimatedTokens: 300, reasoning: 'Personal tasks need attention.' }
    ));
  }

  const dashboardBlocker = blockers.find(b => b.type === 'dashboard');
  if (dashboardBlocker) {
    actions.push(makeAction(
      'create_repair_plan',
      'dashboard',
      7,
      'Fix dashboard route fallback',
      dashboardBlocker.description,
      { requiresEvaluation: true, requiresApproval: true, estimatedTokens: 400, reasoning: 'Dashboard route needs correction.' }
    ));
  }

  const integrationBlocker = blockers.find(b => b.type === 'integration');
  if (integrationBlocker) {
    actions.push(makeAction(
      'create_repair_plan',
      'integrations',
      8,
      'Resolve integration gate failures',
      integrationBlocker.description,
      { requiresEvaluation: true, requiresApproval: true, estimatedTokens: 500, reasoning: 'Integration gate needs fixing.' }
    ));
  }

  if (actions.length === 0) {
    actions.push(makeAction(
      'read_report',
      'system',
      9,
      'General system review',
      'No specific issues detected — perform a general review of system state.',
      { requiresApproval: false, estimatedTokens: 150, reasoning: 'Routine checkup.' }
    ));
  }

  return actions;
}

function rankOperatingActions(actions, services = {}) {
  if (!actions || !Array.isArray(actions)) return [];
  return actions.slice().sort((a, b) => (a.priority || 99) - (b.priority || 99));
}

async function recommendSingleBestAction(snapshot, blockers = [], services = {}) {
  const actions = await synthesizeNextActions(snapshot, blockers, services);
  const ranked = rankOperatingActions(actions, services);
  return ranked[0] || null;
}

function recommendActionForModule(moduleName, snapshot, services = {}) {
  if (!snapshot || !moduleName) return null;
  const modules = snapshot.modules || {};
  const data = modules[moduleName];

  if (!data) {
    return makeAction('read_report', moduleName, 5, `Review ${moduleName} module`, `Collect and review the ${moduleName} module state.`, { estimatedTokens: 100 });
  }

  if (data.errors && data.errors.length > 0) {
    return makeAction('create_repair_plan', moduleName, 2, `Fix errors in ${moduleName}`, `${data.errors.length} error(s) found in ${moduleName}.`, { requiresEvaluation: true, requiresApproval: true, estimatedTokens: 500 });
  }

  if (data.status === 'degraded') {
    return makeAction('create_repair_plan', moduleName, 3, `Restore ${moduleName} from degraded`, `${moduleName} is running in degraded mode.`, { requiresEvaluation: true, requiresApproval: true, estimatedTokens: 400 });
  }

  if (data.opportunities && data.opportunities.length > 0) {
    return makeAction('create_plan', moduleName, 6, `Explore opportunities in ${moduleName}`, `${data.opportunities.length} opportunity(ies) available in ${moduleName}.`, { estimatedTokens: 300 });
  }

  return makeAction('read_report', moduleName, 8, `Review ${moduleName} status`, `${moduleName} appears stable — review for potential improvements.`, { estimatedTokens: 100 });
}

function buildNextActionSummary(action, services = {}) {
  if (!action) return 'No action recommended.';
  const priorityLabel = action.priority <= 3 ? 'High' : action.priority <= 6 ? 'Medium' : 'Low';
  return `[${priorityLabel}] ${action.title} — ${action.description} (${action.module})`;
}

module.exports = {
  synthesizeNextActions,
  rankOperatingActions,
  recommendSingleBestAction,
  recommendActionForModule,
  buildNextActionSummary
};
