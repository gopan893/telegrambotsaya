'use strict';

const { createCodingId, redactSecrets } = require('./coding-utils');
const { STORAGE_KEYS } = require('./coding-workspace-store');
const evaluator = require('../agents/evaluator');

const GITHUB_PROPOSAL_TYPES = ['issue', 'pr', 'comment'];
const EVALUATION_PASS = 'pass';
const EVALUATION_FAIL = 'fail';

function buildGithubIssueProposal(changePlan, services = {}) {
  if (!changePlan) return null;

  const now = new Date().toISOString();

  const title = changePlan.title || 'Untitled issue';
  const body = buildIssueBody(changePlan);

  return {
    id: createCodingId('gh_issue'),
    planId: changePlan.id,
    workspaceId: changePlan.workspaceId,
    userId: changePlan.userId,
    type: 'issue',
    provider: 'github',
    title: redactSecrets(title),
    body: redactSecrets(body),
    labels: deriveLabels(changePlan),
    status: 'proposal_only',
    evaluationStatus: 'pending',
    requiresApproval: true,
    createdAt: now,
    updatedAt: now
  };
}

function buildGithubPrProposal(changePlan, services = {}) {
  if (!changePlan) return null;

  const now = new Date().toISOString();

  const title = changePlan.title || 'Untitled PR';
  const body = buildPrBody(changePlan);

  return {
    id: createCodingId('gh_pr'),
    planId: changePlan.id,
    workspaceId: changePlan.workspaceId,
    userId: changePlan.userId,
    type: 'pr',
    provider: 'github',
    title: redactSecrets(title),
    body: redactSecrets(body),
    branch: `fix/${changePlan.category || 'change'}-${Date.now()}`,
    status: 'proposal_only',
    evaluationStatus: 'pending',
    requiresApproval: true,
    createdAt: now,
    updatedAt: now
  };
}

function buildGithubCommentProposal(changePlan, services = {}) {
  if (!changePlan) return null;

  const now = new Date().toISOString();

  return {
    id: createCodingId('gh_comment'),
    planId: changePlan.id,
    workspaceId: changePlan.workspaceId,
    userId: changePlan.userId,
    type: 'comment',
    provider: 'github',
    body: redactSecrets(changePlan.requestSummary || ''),
    status: 'proposal_only',
    evaluationStatus: 'pending',
    requiresApproval: true,
    createdAt: now,
    updatedAt: now
  };
}

async function createGithubProposalAfterEvaluation(changePlan, type = 'issue', services = {}) {
  if (!changePlan) {
    return { success: false, reason: 'No change plan provided' };
  }

  if (!GITHUB_PROPOSAL_TYPES.includes(type)) {
    return { success: false, reason: `Invalid proposal type: ${type}` };
  }

  // Must run Evaluation v2 gate first
  const evaluationResult = await runEvaluationGate(changePlan, type, services);

  if (!evaluationResult.passed) {
    return {
      success: false,
      reason: 'Evaluation v2 gate failed',
      evaluationResult,
      errors: evaluationResult.errors || ['Evaluation failed — proposal blocked']
    };
  }

  // Build the proposal based on type
  let proposal;
  if (type === 'issue') {
    proposal = buildGithubIssueProposal(changePlan, services);
  } else if (type === 'pr') {
    proposal = buildGithubPrProposal(changePlan, services);
  } else if (type === 'comment') {
    proposal = buildGithubCommentProposal(changePlan, services);
  }

  if (!proposal) {
    return { success: false, reason: 'Failed to build proposal' };
  }

  // Mark evaluation as passed
  proposal.evaluationStatus = EVALUATION_PASS;
  proposal.evaluationScore = evaluationResult.score;

  // Persist proposal if storage available
  if (services?.storageManager) {
    try {
      const list = await services.storageManager.loadData(
        STORAGE_KEYS.codingGithubProposals, []
      );
      const arr = Array.isArray(list) ? list : [];
      arr.push(proposal);
      await services.storageManager.saveData(
        STORAGE_KEYS.codingGithubProposals, arr.slice(-100)
      );
    } catch (_) {
      // silent
    }
  }

  return {
    success: true,
    proposal,
    evaluationResult,
    message: 'GitHub proposal created. Executor approval required before any external write. Note: This is a proposal only — no GitHub write has been performed.',
    requiresExecutorApproval: true
  };
}

async function runEvaluationGate(changePlan, type, services = {}) {
  // Run evaluation using existing EvaluatorAgent
  const query = `${changePlan.title} ${changePlan.requestSummary}`;
  const draft = `GitHub ${type} proposal for: ${changePlan.title}\nCategory: ${changePlan.category}\nRisk: ${changePlan.riskLevel}`;

  try {
    const result = evaluator.evaluate('coding_gh_gate', query, draft, null);

    // Additional checks specific to GitHub proposals
    const errors = [];

    // Check for secrets in title/body
    const combined = `${changePlan.title} ${changePlan.requestSummary}`;
    const secretCheck = checkForSecrets(combined);
    if (secretCheck.hasSecrets) {
      errors.push('Proposal contains potential secrets — they will be redacted');
    }

    // Check external write policy
    if (!changePlan.requiresApproval && (changePlan.riskLevel === 'high' || changePlan.riskLevel === 'critical')) {
      errors.push('High-risk changes require explicit approval flag');
    }

    // Check category validity
    if (!changePlan.category) {
      errors.push('Proposal has no category classification');
    }

    // Check proposal safety
    if (changePlan.riskLevel === 'critical') {
      errors.push('Critical risk level — requires manual security review');
    }

    const passed = result.qualityScore >= 0.3 && errors.length < 3;

    return {
      passed,
      score: result.qualityScore,
      metrics: result.metrics,
      errors,
      draftAnswer: result.finalAnswer
    };
  } catch (err) {
    return {
      passed: false,
      score: 0,
      errors: [`Evaluation error: ${err.message}`]
    };
  }
}

function checkForSecrets(text) {
  const secretPatterns = [
    /token/i, /secret/i, /password/i, /api_key/i,
    /DATABASE_URL/i, /REDIS_URL/i, /sk-[a-zA-Z0-9]+/,
    /ghp_[a-zA-Z0-9]+/i, /bearer\s+/i
  ];

  const found = [];
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      found.push(pattern.source);
    }
  }

  return { hasSecrets: found.length > 0, patterns: found };
}

function buildIssueBody(changePlan) {
  let body = `## Description\n${changePlan.requestSummary || 'No description provided.'}\n\n`;
  body += `## Category\n${changePlan.category || 'Uncategorized'}\n\n`;
  body += `## Risk Level\n${changePlan.riskLevel || 'low'}\n\n`;

  if (changePlan.affectedAreas && changePlan.affectedAreas.length > 0) {
    body += `## Affected Areas\n`;
    for (const area of changePlan.affectedAreas) {
      body += `- ${area}\n`;
    }
    body += '\n';
  }

  if (changePlan.proposedFiles && changePlan.proposedFiles.length > 0) {
    body += `## Proposed Files\n`;
    for (const file of changePlan.proposedFiles) {
      body += `- ${file}\n`;
    }
    body += '\n';
  }

  if (changePlan.implementationSteps && changePlan.implementationSteps.length > 0) {
    body += `## Implementation Steps\n`;
    for (let i = 0; i < changePlan.implementationSteps.length; i++) {
      body += `${i + 1}. ${changePlan.implementationSteps[i]}\n`;
    }
    body += '\n';
  }

  if (changePlan.compatibilityChecklist && changePlan.compatibilityChecklist.length > 0) {
    body += `## Compatibility Checklist\n`;
    for (const item of changePlan.compatibilityChecklist) {
      body += `- [ ] ${item}\n`;
    }
    body += '\n';
  }

  body += `\n---\n*Generated by Coding Workspace Phase 29*`;
  return body;
}

function buildPrBody(changePlan) {
  let body = `## Summary\n${changePlan.requestSummary || 'No summary provided.'}\n\n`;
  body += `## Type\n${changePlan.category || 'change'}\n\n`;
  body += `## Risk Level\n${changePlan.riskLevel || 'low'}\n\n`;

  if (changePlan.implementationSteps && changePlan.implementationSteps.length > 0) {
    body += `## Changes\n`;
    for (const step of changePlan.implementationSteps) {
      body += `- ${step}\n`;
    }
    body += '\n';
  }

  body += `## Testing\n- [ ] node --check telebot.js\n- [ ] Smoke tests pass\n- [ ] No regressions\n\n`;
  body += `## Rollback\nRevert this PR if issues arise.\n\n`;
  body += `---\n*Generated by Coding Workspace Phase 29 — proposal only, no direct write*`;

  return body;
}

function deriveLabels(changePlan) {
  const labels = [];
  const cat = changePlan.category || '';

  if (cat.includes('bug')) labels.push('bug');
  if (cat.includes('feature')) labels.push('enhancement');
  if (cat.includes('security')) labels.push('security');
  if (cat.includes('dashboard')) labels.push('dashboard');
  if (cat.includes('test')) labels.push('testing');
  if (cat.includes('deploy')) labels.push('deployment');
  if (cat.includes('refactor')) labels.push('refactor');

  if (changePlan.riskLevel === 'high' || changePlan.riskLevel === 'critical') {
    labels.push('high-priority');
  }

  return [...new Set(labels)];
}

module.exports = {
  buildGithubIssueProposal,
  buildGithubPrProposal,
  buildGithubCommentProposal,
  createGithubProposalAfterEvaluation
};
