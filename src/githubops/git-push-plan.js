'use strict';

const utils = require('./githubops-utils');
const store = require('./githubops-store');

function createPushPlan(commitPlan) {
  if (!commitPlan || !commitPlan.ok) return { ok: false, error: 'Valid commit plan required' };

  const plan = commitPlan.plan;
  const targetBranch = determineTargetBranch(plan, {});
  const pushPlan = {
    id: utils.shortId(),
    commitPlanId: plan.id,
    fileCount: plan.fileCount,
    areas: plan.areas || [],
    targetBranch,
    requiresMainWarning: targetBranch === 'main' || targetBranch === 'master',
    warnings: [...(plan.warnings || [])],
    pushReady: false,
    secretScanPassed: null,
    evaluationPassed: null,
    testsPassed: null,
    gitCommands: buildPushInstructions({ targetBranch }),
    status: 'draft',
    timestamp: utils.now()
  };

  if (pushPlan.requiresMainWarning) {
    pushPlan.warnings.push('Pushing to main/master requires extra caution');
  }
  if (plan.fileCount > 20) {
    pushPlan.warnings.push('Large push — consider splitting into multiple commits');
  }

  store.addPushPlan(pushPlan);
  return { ok: true, plan: pushPlan };
}

function determineTargetBranch(input) {
  if (input && input.branch) return input.branch;
  try {
    const { execSync } = require('child_process');
    const repoRoot = process.cwd();
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf8' }).toString().trim();
  } catch (_) {}
  return 'main';
}

function validateBranchPolicy(pushPlan) {
  const issues = [];
  if (!pushPlan) return { ok: false, issues: ['No plan'] };
  if (pushPlan.requiresMainWarning) {
    issues.push('Pushing to main/master — ensure feature complete and reviewed');
  }
  return { ok: issues.length === 0, issues };
}

function validatePushReadiness(pushPlan) {
  const checks = [];
  if (pushPlan.secretScanPassed === null) checks.push('Secret scan not run');
  else if (!pushPlan.secretScanPassed) checks.push('Secret scan failed');
  if (pushPlan.evaluationPassed === null) checks.push('Evaluation v2 not run');
  else if (!pushPlan.evaluationPassed) checks.push('Evaluation v2 failed');
  if (pushPlan.testsPassed === null) checks.push('Tests not run');
  else if (!pushPlan.testsPassed) checks.push('Tests failed');
  return {
    ok: checks.length === 0,
    ready: checks.length === 0,
    checks
  };
}

function buildPushInstructions(pushPlan) {
  const branch = pushPlan.targetBranch || 'main';
  const lines = [
    '# Manual Git Push Instructions',
    '',
    'git add .',
    `git commit -m "<message>"`,
    `git push origin ${branch}`,
    '',
    '# Or if rebase needed:',
    `git pull --rebase origin ${branch}`,
    `git push origin ${branch}`
  ];
  return lines.join('\n');
}

module.exports = {
  createPushPlan,
  determineTargetBranch,
  validateBranchPolicy,
  validatePushReadiness,
  buildPushInstructions
};
