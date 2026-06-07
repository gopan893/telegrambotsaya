'use strict';

const { maskSecrets, truncate } = require('./improvement-utils');

const SAFETY_RULES = [
  'No secrets, tokens, or credentials in prompts, output, or code',
  'No auto-run of write, external, or danger actions',
  'No direct repo mutation from runtime',
  'No auto-approve of proposals',
  'No shell executor invocation',
  'No direct GitHub push, workflow dispatch, or Render deploy from runtime',
  'All write/external/danger actions must follow: dry-run -> Evaluation v2 -> executor proposal -> approval -> run'
];

const COMMON_CONSTRAINTS = [
  'Node.js 20, CommonJS only, no TypeScript',
  'Express webhook, vanilla HTML/CSS/JS dashboard',
  'PostgreSQL primary, Redis optional/fallback',
  'No React/Next/Vue',
  'No large refactor',
  'Redact secrets as [REDACTED_SECRET]',
  'Do not log/print TELEGRAM_TOKEN, DATABASE_URL, REDIS_URL, API keys, GITHUB_TOKEN, GOOGLE_CLIENT_SECRET, CLOUDFLARE_API_TOKEN',
  'Reuse existing modules; do not duplicate systems'
];

function resolvePlan(planId, services) {
  if (services.store && typeof services.store.getById === 'function') {
    return services.store.getById('plans', planId);
  }
  if (services.plans && Array.isArray(services.plans)) {
    return services.plans.find(p => p.id === planId);
  }
  return null;
}

function buildBasePromptContext(planId, services) {
  const plan = resolvePlan(planId, services);
  if (!plan) throw new Error(`Improvement plan not found: ${planId}`);

  const context = {
    planId: plan.id,
    title: plan.title,
    summary: plan.summary || '',
    targetModules: Array.isArray(plan.targetModules) ? plan.targetModules : [],
    proposedSteps: Array.isArray(plan.proposedSteps) ? plan.proposedSteps : [],
    riskLevel: plan.riskLevel || 'medium',
    sourceWeaknessIds: Array.isArray(plan.sourceWeaknessIds) ? plan.sourceWeaknessIds : [],
    sourceLessonIds: Array.isArray(plan.sourceLessonIds) ? plan.sourceLessonIds : []
  };

  if (services.store) {
    context.weaknesses = context.sourceWeaknessIds
      .map(id => services.store.getById('weaknesses', id))
      .filter(Boolean)
      .slice(0, 5);
    context.lessons = context.sourceLessonIds
      .map(id => services.store.getById('lessons', id))
      .filter(Boolean)
      .slice(0, 5);
  }

  return context;
}

function generateCodexImprovementPrompt(planId, services = {}) {
  const ctx = buildBasePromptContext(planId, services);
  const affectedFiles = ctx.targetModules.length > 0 ? ctx.targetModules : ['src/'];

  const rootCauseLines = ctx.weaknesses && ctx.weaknesses.length > 0
    ? ctx.weaknesses.map(w => `- ${w.title}: ${truncate(w.description || '', 200)}`).join('\n')
    : 'No specific root cause recorded.';

  const prompt = {
    agent: 'codex',
    role: 'implementation',
    planId: planId,
    goal: `Implement improvement plan: ${ctx.title}`,
    rootCauseSummary: ctx.summary
      ? `Root cause: ${ctx.summary}`
      : `Improvement needed based on ${ctx.weaknesses ? ctx.weaknesses.length : 0} weakness(es) and ${ctx.lessons ? ctx.lessons.length : 0} lesson(s).\n${rootCauseLines}`,
    affectedFiles,
    proposedSteps: ctx.proposedSteps,
    constraints: [
      ...COMMON_CONSTRAINTS,
      'Do NOT write test files directly from agent runtime; generate if instructed',
      'Run node --check on all modified files before finishing',
      'Update AGENT_HANDOFF.md with completed and unfinished items'
    ],
    safetyRules: SAFETY_RULES,
    testsToRun: [
      'node --check telebot.js',
      ...ctx.targetModules.map(m => m.endsWith('.js') ? `node --check ${m}` : `node --check src/${m}/`).filter(Boolean),
      ...(ctx.weaknesses && ctx.weaknesses.length > 0 ? ['Run related scratch regression tests if available'] : [])
    ],
    expectedOutput: [
      'Implementation files modified/created',
      'All node --check passes',
      'Update AGENT_HANDOFF.md'
    ],
    commitMessageSuggestion: `improvement: ${ctx.title.slice(0, 72)}`
  };

  return maskSecrets(prompt);
}

function generateOpenCodeImprovementPrompt(planId, services = {}) {
  const ctx = buildBasePromptContext(planId, services);
  const affectedFiles = ctx.targetModules.length > 0 ? ctx.targetModules : ['src/'];

  const weaknessDetails = ctx.weaknesses && ctx.weaknesses.length > 0
    ? ctx.weaknesses.map(w => `- [${w.severity || 'unknown'}] ${w.title}`).join('\n')
    : 'No specific weaknesses linked.';

  const prompt = {
    agent: 'opencode',
    role: 'audit/review',
    planId: planId,
    goal: `Audit and review improvement plan: ${ctx.title}`,
    rootCauseSummary: ctx.summary
      ? `Summary: ${ctx.summary}`
      : `Linked weaknesses:\n${weaknessDetails}`,
    affectedFiles,
    proposedSteps: ctx.proposedSteps,
    constraints: [
      ...COMMON_CONSTRAINTS,
      'Audit only — do not implement changes',
      'Verify plan is consistent with project rules and architecture',
      'Check for security, secret exposure, and unsafe patterns',
      'No direct write to filesystem from audit'
    ],
    safetyRules: SAFETY_RULES,
    testsToRun: [
      'Review existing test coverage for affected modules',
      'Check node --check on target modules'
    ],
    expectedOutput: [
      'Audit report with findings',
      'Risk assessment',
      'Recommendation: approve, revise, or reject plan'
    ],
    commitMessageSuggestion: `review: audit for "${ctx.title.slice(0, 60)}"`
  };

  return maskSecrets(prompt);
}

function generateHermesImprovementPrompt(planId, services = {}) {
  const ctx = buildBasePromptContext(planId, services);
  const affectedFiles = ctx.targetModules.length > 0 ? ctx.targetModules : ['src/'];

  const prompt = {
    agent: 'hermes',
    role: 'planning/roadmap',
    planId: planId,
    goal: `Develop roadmap and planning strategy for: ${ctx.title}`,
    rootCauseSummary: ctx.summary
      ? `Context: ${ctx.summary}`
      : `Planning required for improvement linked to ${ctx.sourceWeaknessIds.length} weakness(es) and ${ctx.sourceLessonIds.length} lesson(s).`,
    affectedFiles,
    proposedSteps: ctx.proposedSteps,
    constraints: [
      ...COMMON_CONSTRAINTS,
      'Planning only — no implementation',
      'Separate facts, assumptions, unknowns/gaps, and recommendations',
      'Prefer local project docs and Knowledge Graph before external search',
      'Do not store raw secrets in plans or reports'
    ],
    safetyRules: SAFETY_RULES,
    testsToRun: [
      'Review current project architecture',
      'Check AGENTS.md and existing improvement docs'
    ],
    expectedOutput: [
      'Structured plan with phases/milestones',
      'Dependency analysis',
      'Resource recommendation (agent assignment)',
      'Timeline estimate'
    ],
    commitMessageSuggestion: `plan: roadmap for "${ctx.title.slice(0, 60)}"`
  };

  return maskSecrets(prompt);
}

function generateSecurityReviewPrompt(planId, services = {}) {
  const ctx = buildBasePromptContext(planId, services);
  const affectedFiles = ctx.targetModules.length > 0 ? ctx.targetModules : ['src/'];

  const prompt = {
    agent: 'security',
    role: 'security review',
    planId: planId,
    goal: `Security review for improvement plan: ${ctx.title}`,
    rootCauseSummary: ctx.summary
      ? `Context: ${ctx.summary}`
      : 'Security review required.',
    affectedFiles,
    proposedSteps: ctx.proposedSteps,
    constraints: [
      ...COMMON_CONSTRAINTS,
      'Review only — no implementation',
      'Check for secret/credential exposure in proposed changes',
      'Verify approval gate compliance',
      'Check for unsafe execution patterns',
      'Do not log or expose any tokens, secrets, or credentials',
      'Verify no direct write/external/danger actions bypass proposal flow'
    ],
    safetyRules: [
      ...SAFETY_RULES,
      'If secrets found, redact immediately',
      'Any unsafe action must be flagged as blocker'
    ],
    testsToRun: [
      'Review proposed steps for secret patterns',
      'Check target modules for existing security practices',
      'Verify incident response plans if applicable'
    ],
    expectedOutput: [
      'Security review report',
      'List of findings (blockers, warnings, info)',
      'Recommendation: safe / requires changes / blocked'
    ],
    commitMessageSuggestion: `security: review for "${ctx.title.slice(0, 60)}"`
  };

  return maskSecrets(prompt);
}

function generateRegressionTestPrompt(planId, services = {}) {
  const ctx = buildBasePromptContext(planId, services);
  const affectedFiles = ctx.targetModules.length > 0 ? ctx.targetModules : ['src/'];

  const regressionReason = ctx.weaknesses && ctx.weaknesses.length > 0
    ? ctx.weaknesses.map(w => `- ${w.title}: ${truncate(w.description || '', 150)}`).join('\n')
    : 'Regression testing based on improvement plan.';

  const prompt = {
    agent: 'codex',
    role: 'regression test generation',
    planId: planId,
    goal: `Generate regression tests for: ${ctx.title}`,
    rootCauseSummary: `Regression test targets:\n${regressionReason}`,
    affectedFiles,
    proposedSteps: ctx.proposedSteps,
    constraints: [
      ...COMMON_CONSTRAINTS,
      'Generate test suggestion/spec only — do not write test files from runtime',
      'Regression cases must include: title, targetModule, scenario, expectedBehavior, failureToPrevent, riskLevel, manualTestSteps',
      'Place test suggestions in scratch/ directory',
      'Do NOT directly mutate source test files',
      'Run node --check on generated test stubs'
    ],
    safetyRules: SAFETY_RULES,
    testsToRun: [
      'node --check scratch/*.js (if stubs written)',
      'Verify tests cover the weakness scenarios',
      'Run existing related tests to confirm no regression'
    ],
    expectedOutput: [
      'Regression case spec (not written test file)',
      'For each weakness: test scenario, expected behavior, manual steps',
      'Risk level assigned per case'
    ],
    commitMessageSuggestion: `test: regression cases for "${ctx.title.slice(0, 60)}"`
  };

  return maskSecrets(prompt);
}

module.exports = {
  generateCodexImprovementPrompt,
  generateOpenCodeImprovementPrompt,
  generateHermesImprovementPrompt,
  generateSecurityReviewPrompt,
  generateRegressionTestPrompt
};
