'use strict';

const collDetector = require('./collision-detector');
const archMap = require('./architecture-map-generator');
const contractMgr = require('./agent-contract-manager');

function getWorkflowPolicy(intent, services) {
  const repoRoot = services?.repoRoot || process.cwd();

  const policies = {
    codex_to_opencode_recovery: {
      mustRead: ['AGENTS.md', 'AGENT_HANDOFF.md'],
      allowedActions: ['git diff inspect', 'create recovery handoff', 'patch P0 only', 'run tests'],
      blockedActions: ['feature work', 'new modules', 'refactor', 'delete files', 'git push', 'external write'],
      testsToRun: ['node --check telebot.js', 'scratch/test-dashboard-router-registry.js', 'scratch/test-integration-gate-stable-release.js'],
      requiresAudit: true,
      requiresEvalGate: false,
      canEdit: false,
      riskLevel: 'high'
    },
    opencode_to_codex_continue: {
      mustRead: ['AGENT_HANDOFF.md', 'docs/ARCHITECTURE_MAP.md'],
      allowedActions: ['read handoff', 'generate codex prompt', 'run integration checks', 'update handoff'],
      blockedActions: ['direct edit', 'new feature', 'delete files', 'git push', 'external write'],
      testsToRun: ['node --check telebot.js', 'scratch/test-executor-boundary-stable-release.js'],
      requiresAudit: true,
      requiresEvalGate: false,
      canEdit: false,
      riskLevel: 'medium'
    },
    post_codex_review: {
      mustRead: ['AGENT_HANDOFF.md'],
      allowedActions: ['audit diff', 'detect duplicates', 'validate routes', 'validate executor', 'validate integration'],
      blockedActions: ['edit code', 'new modules', 'feature work', 'git push', 'external write'],
      testsToRun: ['node --check telebot.js', 'scratch/test-dashboard-router-registry.js', 'scratch/test-executor-boundary-stable-release.js', 'scratch/test-integration-gate-stable-release.js'],
      requiresAudit: true,
      requiresEvalGate: false,
      canEdit: false,
      riskLevel: 'low'
    },
    post_opencode_review: {
      mustRead: ['AGENT_HANDOFF.md'],
      allowedActions: ['audit diff', 'generate codex continuation prompt'],
      blockedActions: ['edit code', 'new modules', 'feature work', 'git push', 'external write'],
      testsToRun: ['node --check telebot.js', 'scratch/test-dashboard-router-registry.js'],
      requiresAudit: true,
      requiresEvalGate: false,
      canEdit: false,
      riskLevel: 'low'
    },
    p0_recovery: {
      mustRead: ['AGENTS.md', 'public/dashboard/state.js', 'public/dashboard/ui.js', 'src/dashboard/dashboard-routes.js'],
      allowedActions: ['run dashboard route audit', 'fix syntax errors', 'fix router fallback', 'fix service worker cache', 'run tests'],
      blockedActions: ['feature work', 'new tabs', 'refactor', 'new modules', 'delete files', 'git push', 'external write'],
      testsToRun: ['node --check telebot.js', 'scratch/test-dashboard-router-registry.js', 'scratch/test-dashboard-all-menu-routes.js', 'scratch/test-dashboard-dark-form-ui.js'],
      requiresAudit: true,
      requiresEvalGate: false,
      canEdit: true,
      riskLevel: 'critical'
    },
    phase_planning: {
      mustRead: ['AGENTS.md', 'docs/INTEGRATION_CONTRACT.md', 'docs/ARCHITECTURE_MAP.md'],
      allowedActions: ['generate phase prompt', 'read architecture map', 'read contract'],
      blockedActions: ['edit code', 'new modules', 'feature work', 'git push', 'external write'],
      testsToRun: ['node --check telebot.js'],
      requiresAudit: false,
      requiresEvalGate: false,
      canEdit: false,
      riskLevel: 'low'
    },
    implementation_patch: {
      mustRead: ['AGENTS.md', 'docs/ARCHITECTURE_MAP.md'],
      allowedActions: ['create patch plan', 'edit files', 'run tests', 'update handoff'],
      blockedActions: ['delete critical files', 'git push without approval', 'external write without eval'],
      testsToRun: ['node --check telebot.js', 'scratch/test-dashboard-router-registry.js'],
      requiresAudit: true,
      requiresEvalGate: false,
      canEdit: true,
      riskLevel: 'medium'
    },
    audit_only: {
      mustRead: [],
      allowedActions: ['read files', 'run checks', 'generate report'],
      blockedActions: ['edit code', 'new modules', 'feature work', 'git push', 'external write', 'create files'],
      testsToRun: [],
      requiresAudit: false,
      requiresEvalGate: false,
      canEdit: false,
      riskLevel: 'low'
    }
  };

  return policies[intent] || policies.audit_only;
}

function buildPolicyReport(intent, services) {
  const policy = getWorkflowPolicy(intent, services);
  return {
    intent,
    policy,
    collissionWarnings: collDetector.detectCollisions(services),
    contractValid: contractMgr.validateAgentContract(services),
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  getWorkflowPolicy,
  buildPolicyReport
};
