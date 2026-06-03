'use strict';

const { redactSecrets } = require('./coding-utils');

function synthesizeCodingReview(classification, changePlan, riskReview, testPlan, codexPrompt, githubProposal) {
  const parts = [];

  parts.push('=======================================');
  parts.push('  CODING WORKSPACE - Review Synthesis');
  parts.push('=======================================');

  if (classification) {
    parts.push('');
    parts.push('Request Classification');
    parts.push('  Category: ' + (classification.category || 'unknown'));
    parts.push('  Risk Level: ' + (classification.riskLevel || 'low'));
    parts.push('  Agents: ' + (classification.selectedAgents ? classification.selectedAgents.join(', ') : 'none'));
    parts.push('  Needs Repo Context: ' + (classification.needsRepoContext ? 'Yes' : 'No'));
    parts.push('  Needs GitHub Proposal: ' + (classification.needsGitHubProposal ? 'Yes' : 'No'));
    parts.push('  Requires Approval: ' + (classification.requiresApproval ? 'Yes' : 'No'));
  }

  if (changePlan) {
    parts.push('');
    parts.push('Change Plan: ' + (changePlan.title || 'Untitled'));
    parts.push('  ID: ' + changePlan.id);
    parts.push('  Status: ' + (changePlan.status || 'unknown'));
    parts.push('  Risk: ' + (changePlan.riskLevel || 'low'));
    if (changePlan.affectedAreas) {
      parts.push('  Affected Areas: ' + changePlan.affectedAreas.join(', '));
    }
    if (changePlan.proposedFiles) {
      parts.push('  Proposed Files:');
      for (const f of changePlan.proposedFiles.slice(0, 5)) {
        parts.push('    - ' + f);
      }
      if (changePlan.proposedFiles.length > 5) {
        parts.push('    ... and ' + (changePlan.proposedFiles.length - 5) + ' more');
      }
    }
  }

  if (riskReview) {
    parts.push('');
    parts.push('Risk Review');
    const overall = riskReview.overallSeverity || riskReview.overallRisk || 'unknown';
    parts.push('  Overall: ' + overall);
    parts.push('  Can Proceed: ' + (riskReview.canProceed ? 'Yes' : 'No'));

    if (riskReview.regression) {
      parts.push('  Regression Risk: ' + (riskReview.regression.regressionRisk || 'unknown'));
    }
    if (riskReview.security) {
      parts.push('  Security Risk: ' + (riskReview.security.securityRisk || 'unknown'));
      if (riskReview.security.issues && riskReview.security.issues.length > 0) {
        for (const issue of riskReview.security.issues) {
          parts.push('    WARN: ' + (issue.desc || issue));
        }
      }
    }
    if (riskReview.compatibility) {
      parts.push('  Compatibility Risk: ' + (riskReview.compatibility.compatibilityRisk || 'unknown'));
    }
    if (riskReview.reviews) {
      for (const review of riskReview.reviews) {
        if (review.severity !== 'ok') {
          parts.push('  ' + review.agent + ': ' + review.severity);
          if (review.issues) {
            for (const issue of review.issues) {
              parts.push('    - ' + issue);
            }
          }
        }
      }
    }
  }

  if (testPlan) {
    parts.push('');
    parts.push('Test Plan');
    parts.push('  ID: ' + testPlan.id);
    if (testPlan.smokeCommands && testPlan.smokeCommands.length > 0) {
      parts.push('  Smoke Commands:');
      for (const cmd of testPlan.smokeCommands.slice(0, 3)) {
        parts.push('    $ ' + cmd);
      }
    }
    if (testPlan.regressionTests && testPlan.regressionTests.length > 0) {
      parts.push('  Regression Tests: ' + testPlan.regressionTests.length + ' tests');
    }
  }

  if (codexPrompt) {
    parts.push('');
    parts.push('Codex Prompt');
    const preview = codexPrompt.slice(199);
    parts.push('  ' + preview);
  }

  if (githubProposal) {
    parts.push('');
    parts.push('GitHub Proposal');
    if (githubProposal.success === false) {
      parts.push('  Status: BLOCKED');
      parts.push('  Reason: ' + (githubProposal.reason || 'Unknown'));
      if (githubProposal.errors) {
        for (const err of githubProposal.errors) {
          parts.push('  WARN: ' + err);
        }
      }
    } else if (githubProposal.proposal) {
      parts.push('  Type: ' + githubProposal.proposal.type);
      parts.push('  Title: ' + githubProposal.proposal.title);
      parts.push('  Status: ' + githubProposal.proposal.status);
      parts.push('  Evaluation: ' + githubProposal.proposal.evaluationStatus);
      parts.push('  Requires Executor Approval: Yes');
    }
    parts.push('  NOTE: Proposal only. No GitHub write performed.');
  }

  parts.push('');
  parts.push('=======================================');

  return redactSecrets(parts.join('\n'));
}

function formatShortSummary(classification, changePlan) {
  if (!classification || !changePlan) return 'No summary available.';

  const lines = [];
  lines.push(classification.category + ' - Risk: ' + classification.riskLevel);
  lines.push(changePlan.title);

  if (classification.requiresApproval) {
    lines.push('Requires approval before proceeding');
  }

  return lines.join('\n');
}

module.exports = {
  synthesizeCodingReview,
  formatShortSummary
};
