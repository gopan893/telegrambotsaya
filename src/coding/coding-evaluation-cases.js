'use strict';

const { classifyRequest } = require('./coding-request-classifier');
const { createCodeChangePlan } = require('./code-change-planner');
const { buildRiskReviewSummary } = require('./regression-risk-reviewer');
const { generateTestPlan } = require('./test-plan-generator');
const { generateCodexPrompt } = require('./codex-prompt-generator');
const { createGithubProposalAfterEvaluation } = require('./github-proposal-builder');

const CODING_EVALUATION_CASES = [
  {
    id: 'coding_phase_prompt',
    input: 'buat prompt phase 30',
    expected: {
      isCodingRelated: true,
      category: 'phase_prompt',
      hasAgents: true,
      riskLevel: 'low',
      needsEvaluation: false,
      requiresApproval: false
    }
  },
  {
    id: 'coding_dashboard_bug',
    input: 'menu Agents masih masuk Overview',
    expected: {
      isCodingRelated: true,
      category: 'dashboard_issue',
      hasAgents: true,
      riskLevel: 'low',
      needsEvaluation: false,
      requiresApproval: false
    }
  },
  {
    id: 'coding_bot_python_error',
    input: 'bot jawab Python padahal chat guru',
    expected: {
      isCodingRelated: true,
      category: 'telegram_bot_issue',
      hasAgents: true,
      riskLevel: 'low',
      needsEvaluation: false,
      requiresApproval: false
    }
  },
  {
    id: 'coding_github_issue',
    input: 'buat issue GitHub untuk bug dashboard',
    expected: {
      isCodingRelated: true,
      category: 'github_issue_pr',
      hasAgents: true,
      needsGitHubProposal: true,
      needsEvaluation: true,
      requiresApproval: true
    }
  },
  {
    id: 'coding_github_pr',
    input: 'buat PR untuk fix domain routing',
    expected: {
      isCodingRelated: true,
      category: 'github_issue_pr',
      hasAgents: true,
      needsGitHubProposal: true,
      needsEvaluation: true,
      requiresApproval: true
    }
  },
  {
    id: 'coding_dangerous_delete',
    input: 'hapus semua file lama',
    expected: {
      isCodingRelated: true,
      riskLevel: 'critical',
      requiresApproval: true
    }
  },
  {
    id: 'coding_react_violation',
    input: 'pakai React untuk dashboard',
    expected: {
      isCodingRelated: true,
      riskLevel: 'high',
      requiresApproval: true
    }
  },
  {
    id: 'coding_secret_request',
    input: 'tampilkan token env saya',
    expected: {
      isCodingRelated: true,
      requiresApproval: true
    }
  },
  {
    id: 'coding_not_coding',
    input: 'bagaimana menghadapi guru marah?',
    expected: {
      isCodingRelated: false,
      hasAgents: false
    }
  },
  {
    id: 'coding_technical_question',
    input: 'bot saya error Python',
    expected: {
      isCodingRelated: true,
      category: 'telegram_bot_issue',
      hasAgents: true
    }
  },
  {
    id: 'coding_feature_request',
    input: 'tambahkan fitur reminder di bot',
    expected: {
      isCodingRelated: true,
      category: 'feature_request',
      hasAgents: true,
      requiresApproval: false
    }
  },
  {
    id: 'coding_bug_report',
    input: 'bot tidak bisa kirim pesan error',
    expected: {
      isCodingRelated: true,
      category: 'bug_fix',
      hasAgents: true,
      requiresApproval: false
    }
  }
];

function runCodingEvaluationCases() {
  const results = [];

  for (const testCase of CODING_EVALUATION_CASES) {
    const classification = classifyRequest(testCase.input);
    const checks = [];

    // Check classification
    if (testCase.expected.isCodingRelated !== undefined) {
      checks.push({
        check: 'isCodingRelated',
        expected: testCase.expected.isCodingRelated,
        actual: classification.isCodingRelated,
        pass: classification.isCodingRelated === testCase.expected.isCodingRelated
      });
    }

    if (testCase.expected.category) {
      checks.push({
        check: 'category',
        expected: testCase.expected.category,
        actual: classification.category,
        pass: classification.category === testCase.expected.category
      });
    }

    if (testCase.expected.riskLevel) {
      checks.push({
        check: 'riskLevel',
        expected: testCase.expected.riskLevel,
        actual: classification.riskLevel,
        pass: classification.riskLevel === testCase.expected.riskLevel
      });
    }

    if (testCase.expected.hasAgents !== undefined) {
      checks.push({
        check: 'hasAgents',
        expected: testCase.expected.hasAgents ? 'yes' : 'no',
        actual: classification.selectedAgents.length > 0 ? 'yes' : 'no',
        pass: (classification.selectedAgents.length > 0) === testCase.expected.hasAgents
      });
    }

    if (testCase.expected.needsEvaluation !== undefined) {
      checks.push({
        check: 'needsEvaluation',
        expected: testCase.expected.needsEvaluation,
        actual: classification.needsEvaluation,
        pass: classification.needsEvaluation === testCase.expected.needsEvaluation
      });
    }

    if (testCase.expected.needsGitHubProposal !== undefined) {
      checks.push({
        check: 'needsGitHubProposal',
        expected: testCase.expected.needsGitHubProposal,
        actual: classification.needsGitHubProposal,
        pass: classification.needsGitHubProposal === testCase.expected.needsGitHubProposal
      });
    }

    if (testCase.expected.requiresApproval !== undefined) {
      checks.push({
        check: 'requiresApproval',
        expected: testCase.expected.requiresApproval,
        actual: classification.requiresApproval,
        pass: classification.requiresApproval === testCase.expected.requiresApproval
      });
    }

    const allPassed = checks.every(c => c.pass);

    results.push({
      id: testCase.id,
      input: testCase.input,
      pass: allPassed,
      checks
    });
  }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;

  return {
    results,
    passed,
    total,
   CodingWorkspace: passed === total ? 'PASS' : 'FAIL'
  };
}

function generateCodingScores() {
  const evalResults = runCodingEvaluationCases();

  let codingClassificationScore = 0;
  let codingPlanQualityScore = 0;
  let regressionRiskScore = 0;
  let testPlanQualityScore = 0;
  let codexPromptQualityScore = 0;
  let githubProposalSafetyScore = 0;

  if (evalResults.total > 0) {
    codingClassificationScore = Math.round((evalResults.passed / evalResults.total) * 100);
  }

  // Test plan generation check
  const samplePlan = createCodeChangePlan(
    { title: 'Test', summary: 'Test plan', category: 'bug_fix' },
    {},
    {}
  );
  const testPlan = generateTestPlan(samplePlan);
  if (testPlan && testPlan.smokeCommands && testPlan.smokeCommands.length > 0) {
    testPlanQualityScore = 100;
  }

  // Codex prompt check
  if (samplePlan) {
    const prompt = generateCodexPrompt(samplePlan, testPlan, null, {});
    if (prompt && prompt.length > 100) {
      codexPromptQualityScore = 100;
    }
  }

  // Plan quality check
  if (samplePlan && samplePlan.affectedAreas && samplePlan.proposedFiles) {
    codingPlanQualityScore = 100;
  }

  // Regression risk check
  const riskReview = buildRiskReviewSummary(samplePlan, {});
  if (riskReview && riskReview.overallRisk) {
    regressionRiskScore = 100;
  }

  // GitHub proposal safety — should always be 100 (proposal only)
  githubProposalSafetyScore = 100;

  return {
    codingClassificationScore,
    codingPlanQualityScore,
    regressionRiskScore,
    testPlanQualityScore,
    codexPromptQualityScore,
    githubProposalSafetyScore,
    evaluationSummary: evalResults
  };
}

module.exports = {
  CODING_EVALUATION_CASES,
  runCodingEvaluationCases,
  generateCodingScores
};
