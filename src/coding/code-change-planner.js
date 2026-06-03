'use strict';

const { createCodingId, textArray, jsonObject, redactSecrets, DEFAULT_CONSTRAINTS } = require('./coding-utils');
const { STORAGE_KEYS } = require('./coding-workspace-store');
const { getProjectConstraints, detectMissingRepoConfig } = require('./repo-context-manager');

const AFFECTED_AREAS_MAP = {
  bug_fix: ['core', 'handlers', 'services'],
  feature_request: ['src', 'config', 'handlers'],
  phase_prompt: ['src', 'docs', 'scratch'],
  refactor: ['src', 'core', 'config'],
  dashboard_issue: ['public/dashboard', 'src/dashboard', 'src/bot'],
  telegram_bot_issue: ['src/bot', 'src/interactions', 'src/conversation'],
  database_storage_issue: ['src/storage', 'src/ai-os'],
  integration_issue: ['src/integrations', 'src/agents'],
  security_issue: ['src/governance', 'src/middleware', 'config'],
  test_regression: ['scratch', 'src'],
  deployment_issue: ['config', 'scripts'],
  github_issue_pr: ['src', 'docs']
};

function createCodeChangePlan(request = {}, context = {}, services = {}) {
  const now = new Date().toISOString();
  const planId = createCodingId('plan');
  const workspaceId = context.workspaceId || context.id || 'ws_default';
  const userId = String(request.userId || context.userId || '');
  const constraints = getProjectConstraints(workspaceId, services);
  const missing = detectMissingRepoConfig(context);

  const category = request.category || 'feature_request';
  const affectedAreas = request.affectedAreas ||
    AFFECTED_AREAS_MAP[category] || ['src'];

  const proposedFiles = request.proposedFiles || deriveProposedFiles(category, request, context);

  const implementationSteps = request.implementationSteps ||
    deriveImplementationSteps(category, request, constraints);

  const compatibilityChecklist = deriveCompatibilityChecklist(category, constraints);

  let riskLevel = 'low';
  if (category === 'security_issue' || category === 'deployment_issue') riskLevel = 'high';
  else if (category === 'refactor' || category === 'database_storage_issue') riskLevel = 'medium';

  // Dangerous patterns
  const combinedTitle = (request.title || '') + ' ' + JSON.stringify(request);
  if (/hapus\s+semua|delete\s+all|drop\s+table|rm\s+-rf|hapus.*file\s+lama|hapus.*semua.*file/i.test(combinedTitle)) {
    riskLevel = 'critical';
  } else if (/hapus|delete|drop|format|wipe/i.test(combinedTitle)) {
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
  }

  // Constraint violations
  const constraintCheck = (request.title || '') + ' ' + (request.summary || '');
  if (/pakai\s+react|gunakan\s+react|react\s+dashboard/i.test(constraintCheck)) {
    riskLevel = 'high';
  } else if (/pakai\s+typescript|gunakan\s+ts\b|next\.js|vue\.js|nuxt|svelte/i.test(constraintCheck)) {
    riskLevel = Math.max(riskLevel === 'critical' ? 3 : riskLevel === 'high' ? 2 : riskLevel === 'medium' ? 1 : 0, 2) === 2 ? 'high' : riskLevel;
  }

  const requiresApproval = riskLevel === 'high' || riskLevel === 'critical' ||
    category === 'deployment_issue' || category === 'security_issue' ||
    category === 'github_issue_pr';

  const plan = {
    id: planId,
    workspaceId,
    userId,
    category,
    title: request.title || `Code change plan: ${category}`,
    requestSummary: redactSecrets(String(request.summary || request.title || '')),
    affectedAreas,
    proposedFiles,
    implementationSteps,
    compatibilityChecklist,
    riskLevel,
    requiresApproval,
    status: requiresApproval ? 'pending_approval' : 'planned',
    constraints: { ...constraints },
    missingRepoConfig: missing,
    createdAt: now,
    updatedAt: now
  };

  // Persist if storage available
  if (services?.storageManager) {
    persistPlan(plan, services).catch(() => {});
  }

  return plan;
}

function createPlanFromBugReport(input = {}, services = {}) {
  return createCodeChangePlan(
    {
      ...input,
      category: 'bug_fix',
      title: input.title || `Bug fix: ${String(input.bugDescription || '').slice(0, 80)}`,
      summary: input.bugDescription || input.summary || '',
      affectedAreas: input.affectedAreas || ['src/bot', 'src/core']
    },
    input,
    services
  );
}

function createPlanFromFeatureRequest(input = {}, services = {}) {
  return createCodeChangePlan(
    {
      ...input,
      category: 'feature_request',
      title: input.title || `Feature: ${String(input.featureDescription || '').slice(0, 80)}`,
      summary: input.featureDescription || input.summary || ''
    },
    input,
    services
  );
}

function createPlanFromPhasePrompt(input = {}, services = {}) {
  return createCodeChangePlan(
    {
      ...input,
      category: 'phase_prompt',
      title: input.title || `Phase: ${String(input.phaseDescription || '').slice(0, 80)}`,
      summary: input.phaseDescription || input.summary || '',
      affectedAreas: ['src', 'docs', 'scratch']
    },
    input,
    services
  );
}

function createMinimalPatchStrategy(plan, services = {}) {
  if (!plan) return null;

  return {
    planId: plan.id,
    strategy: 'minimal_patch',
    description: 'Apply smallest possible change to fix the issue.',
    files: (plan.proposedFiles || []).slice(0, 3),
    steps: (plan.implementationSteps || []).slice(0, 5),
    rollback: 'Revert the changed files to previous state using git restore or backup.',
    riskLevel: plan.riskLevel || 'low'
  };
}

function createCompatibilityChecklist(plan, services = {}) {
  if (!plan) return [];
  return deriveCompatibilityChecklist(plan.category, plan.constraints);
}

function deriveProposedFiles(category, request, context) {
  const base = AFFECTED_AREAS_MAP[category] || ['src'];
  const files = [];

  for (const area of base) {
    if (area.startsWith('src/')) {
      files.push(`${area}/index.js`);
      files.push(`${area}/${category.replace(/_/g, '-')}.js`);
    } else if (area === 'config') {
      files.push('config/env.js');
    } else if (area === 'docs') {
      files.push(`docs/${category.replace(/_/g, '-')}.md`);
    } else if (area === 'scratch') {
      files.push(`scratch/test-${category.replace(/_/g, '-')}.js`);
    } else {
      files.push(`${area}/index.js`);
    }
  }

  // Deduplicate
  return [...new Set(files)].slice(0, 10);
}

function deriveImplementationSteps(category, request, constraints) {
  const steps = [
    'Review existing code in affected areas',
    'Create scratch test to reproduce the issue (if applicable)',
    'Implement the change following project constraints',
    `Ensure ${constraints.moduleSystem || 'CommonJS'} compatibility`,
    'Run node --check telebot.js to verify syntax',
    'Run relevant smoke tests',
    'Document changes if needed'
  ];

  if (category === 'bug_fix') {
    steps[0] = 'Identify the root cause of the bug';
    steps.splice(1, 0, 'Create minimal reproduction test');
  }

  if (category === 'refactor') {
    steps.unshift('Verify all existing tests pass before refactoring');
    steps.push('Run full regression test suite');
  }

  return steps.slice(0, 8);
}

function deriveCompatibilityChecklist(category, constraints) {
  const checklist = [
    'node --check telebot.js passes',
    'All existing commands still respond correctly',
    `Module system: ${constraints.moduleSystem || 'CommonJS'} — no ES modules`,
    `Runtime: ${constraints.runtime || 'Node.js 20'}`,
    'No breaking changes to bot APIs',
    'Dashboard still loads in browser'
  ];

  if (constraints.typescript === false) {
    checklist.push('No TypeScript files introduced');
  }
  if (constraints.react === false) {
    checklist.push('No React/Vue/Next.js introduced');
  }

  if (category === 'dashboard_issue') {
    checklist.push('Dashboard tabs all render correctly');
    checklist.push('PWA assets still load');
    checklist.push('Mobile responsive check');
  }

  if (category === 'database_storage_issue') {
    checklist.push('PostgreSQL schema backward compatible');
    checklist.push('JSON fallback still works');
    checklist.push('Redis cache invalidation handled');
  }

  return checklist;
}

async function persistPlan(plan, services) {
  try {
    const list = await services.storageManager.loadData(
      STORAGE_KEYS.codingChangePlans, []
    );
    const arr = Array.isArray(list) ? list : [];
    arr.push(plan);
    await services.storageManager.saveData(
      STORAGE_KEYS.codingChangePlans, arr.slice(-200)
    );
  } catch (_) {
    // silent
  }
}

module.exports = {
  createCodeChangePlan,
  createPlanFromBugReport,
  createPlanFromFeatureRequest,
  createPlanFromPhasePrompt,
  createMinimalPatchStrategy,
  createCompatibilityChecklist
};
