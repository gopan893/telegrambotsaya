'use strict';

const { generateId, now, truncate, sanitizeImprovementText } = require('./improvement-utils');

const AGENTS = ['opencode', 'codex', 'hermes', 'security', 'ops', 'cost'];
const VALID_STATUSES = ['draft', 'reviewing', 'proposal_created', 'approved', 'done', 'archived'];
const RISK_LEVELS = ['low', 'medium', 'high'];

const AGENT_MODULE_MAP = [
  { agent: 'opencode', patterns: ['audit', 'review', 'regression', 'recovery', 'inspect', 'vet'] },
  { agent: 'codex', patterns: ['implement', 'fix', 'test', 'create', 'refactor', 'build', 'add', 'write'] },
  { agent: 'hermes', patterns: ['roadmap', 'plan', 'process', 'strategy', 'improve flow', 'workflow'] },
  { agent: 'security', patterns: ['secret', 'approval', 'safety', 'token', 'credential', 'permission', 'auth'] },
  { agent: 'ops', patterns: ['deploy', 'render', 'github action', 'ci', 'cd', 'infra', 'docker', 'host'] },
  { agent: 'cost', patterns: ['token', 'budget', 'cost', 'usage', 'spend', 'pricing', 'bill'] }
];

function normalizeRiskLevel(val) {
  if (RISK_LEVELS.includes(val)) return val;
  return 'medium';
}

function normalizeStatus(val) {
  if (VALID_STATUSES.includes(val)) return val;
  return 'draft';
}

function createImprovementPlan(input, services = {}) {
  const id = generateId();
  const timestamp = now();

  const plan = {
    id,
    workspaceId: input.workspaceId || 'default',
    title: truncate(sanitizeImprovementText(input.title || 'Improvement plan'), 200),
    summary: truncate(sanitizeImprovementText(input.summary || input.description || ''), 1000),
    sourceWeaknessIds: Array.isArray(input.sourceWeaknessIds) ? input.sourceWeaknessIds : [],
    sourceLessonIds: Array.isArray(input.sourceLessonIds) ? input.sourceLessonIds : [],
    targetModules: Array.isArray(input.targetModules) ? input.targetModules : [],
    proposedSteps: Array.isArray(input.proposedSteps) ? input.proposedSteps.map(step => sanitizeImprovementText(step)) : [],
    riskLevel: normalizeRiskLevel(input.riskLevel),
    requiresEvaluation: input.requiresEvaluation !== false,
    requiresExecutorApproval: input.requiresExecutorApproval !== false,
    recommendedAgent: AGENTS.includes(input.recommendedAgent) ? input.recommendedAgent : recommendImprovementAgent(input, services),
    status: normalizeStatus(input.status),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return plan;
}

function createImprovementPlanFromWeakness(weaknessId, services = {}) {
  const store = services.store;
  if (!store) throw new Error('services.store is required');

  const weakness = store.getById('weaknesses', weaknessId);
  if (!weakness) throw new Error(`Weakness not found: ${weaknessId}`);

  const plan = createImprovementPlan({
    workspaceId: weakness.workspaceId || 'default',
    title: `Improve: ${truncate(weakness.title, 160)}`,
    summary: truncate(weakness.description || weakness.title, 1000),
    sourceWeaknessIds: [weaknessId],
    targetModules: [weakness.targetModule || weakness.affectedModule || 'unknown'].filter(Boolean),
    proposedSteps: [
      `Analyze root cause of: ${weakness.title}`,
      `Implement fix for ${weakness.targetModule || weakness.affectedModule || 'affected module'}`,
      `Add regression test to prevent recurrence`,
      `Verify fix in staging environment`
    ],
    riskLevel: weakness.severity === 'critical' ? 'high' : weakness.severity === 'major' ? 'medium' : 'low',
    recommendedAgent: weakness.recommendedAgent || undefined
  }, services);

  return plan;
}

function createImprovementPlanFromPattern(pattern, services = {}) {
  if (!pattern || !pattern.title) throw new Error('Pattern must have a title');

  const plan = createImprovementPlan({
    workspaceId: pattern.workspaceId || 'default',
    title: `Pattern improvement: ${truncate(pattern.title, 160)}`,
    summary: truncate(pattern.description || pattern.summary || pattern.title, 1000),
    sourceWeaknessIds: Array.isArray(pattern.sourceWeaknessIds) ? pattern.sourceWeaknessIds : [],
    sourceLessonIds: Array.isArray(pattern.sourceLessonIds) ? pattern.sourceLessonIds : [],
    targetModules: Array.isArray(pattern.targetModules) ? pattern.targetModules : [],
    proposedSteps: Array.isArray(pattern.suggestedSteps) ? pattern.suggestedSteps : [
      `Review pattern: ${pattern.title}`,
      `Assess applicability to current codebase`,
      `Implement pattern changes`,
      `Update related tests`
    ],
    riskLevel: normalizeRiskLevel(pattern.riskLevel),
    recommendedAgent: pattern.recommendedAgent || undefined
  }, services);

  return plan;
}

function recommendImprovementAgent(plan, services = {}) {
  const targetText = (Array.isArray(plan.targetModules) ? plan.targetModules : [])
    .concat(Array.isArray(plan.proposedSteps) ? plan.proposedSteps : [])
    .concat(plan.title || '')
    .concat(plan.summary || '')
    .join(' ')
    .toLowerCase();

  for (const mapping of AGENT_MODULE_MAP) {
    if (mapping.patterns.some(p => targetText.includes(p))) {
      return mapping.agent;
    }
  }

  if (plan.riskLevel === 'high' || plan.requiresEvaluation) {
    return 'opencode';
  }

  if (plan.targetModules.length > 2 || plan.proposedSteps.length > 5) {
    return 'hermes';
  }

  return 'codex';
}

function validateImprovementPlan(plan, services = {}) {
  const errors = [];

  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Plan must be a non-null object'] };
  }

  if (!plan.title || typeof plan.title !== 'string' || plan.title.trim().length === 0) {
    errors.push('Plan title is required and must be a non-empty string');
  }

  if (!Array.isArray(plan.proposedSteps) || plan.proposedSteps.length === 0) {
    errors.push('Plan must have at least one proposedStep');
  }

  if (!AGENTS.includes(plan.recommendedAgent)) {
    errors.push(`recommendedAgent must be one of: ${AGENTS.join(', ')}`);
  }

  if (!RISK_LEVELS.includes(plan.riskLevel)) {
    errors.push(`riskLevel must be one of: ${RISK_LEVELS.join(', ')}`);
  }

  if (!VALID_STATUSES.includes(plan.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (plan.requiresEvaluation && plan.riskLevel === 'high' && !plan.requiresExecutorApproval) {
    errors.push('High risk plans requiring evaluation must also require executor approval');
  }

  if (!Array.isArray(plan.targetModules) || plan.targetModules.length === 0) {
    errors.push('Plan should specify at least one targetModule');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  createImprovementPlan,
  createImprovementPlanFromWeakness,
  createImprovementPlanFromPattern,
  recommendImprovementAgent,
  validateImprovementPlan
};
