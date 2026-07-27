'use strict';

const utils = require('./release-utils');

const ProductionDeployProposalBuilder = {
  buildProductionDeployProposal(releaseId, services = {}) {
    return {
      proposalType: 'production_deploy',
      releaseId,
      version: 'v1.0.0',
      action: 'Deploy v1.0.0 to production environment',
      directAction: false,
      requiresEvaluation: true,
      requiresApproval: true,
      details: {
        target: 'production',
        deployMethod: 'Render (via proposal + approval)',
        preDeployChecks: ['RC audit passed', 'Rollout readiness passed', 'Secret scan passed', 'Env checklist verified'],
        postDeployChecks: ['Smoke test', 'Health window', 'SLO monitoring']
      },
      createdAt: utils.formatTimestamp()
    };
  },

  buildRenderDeployProposal(releaseId, services = {}) {
    const env = services.env || process.env;
    const hasHook = !!env.RENDER_DEPLOY_HOOK_URL;
    return {
      proposalType: 'render_deploy',
      releaseId,
      version: 'v1.0.0',
      action: 'Trigger Render deploy via deploy hook URL',
      directAction: false,
      requiresEvaluation: true,
      requiresApproval: true,
      credentialsConfigured: hasHook,
      manualInstructions: hasHook ? null : 'Set RENDER_DEPLOY_HOOK_URL env var, then trigger deploy via POST to the hook URL.',
      details: {
        service: 'telegram-ai-level-tertinggi',
        method: hasHook ? 'POST to deploy hook' : 'Manual deploy via Render dashboard',
        postDeploy: ['Verify /health endpoint', 'Run smoke tests', 'Open health window']
      },
      createdAt: utils.formatTimestamp()
    };
  },

  buildDeploySmokeTestPlan(releaseId, services = {}) {
    return {
      releaseId,
      version: 'v1.0.0',
      tests: [
        { test: 'node --check telebot.js', expected: 'PASS' },
        { test: 'GET /health', expected: '200 OK' },
        { test: 'GET /dashboard', expected: '200 OK' },
        { test: 'Dashboard tabs render', expected: 'No fallback to Overview' },
        { test: 'Telegram bot responds to /start', expected: '200 OK' },
        { test: 'Webhook processes messages', expected: 'No errors' },
        { test: 'Postgres/Redis connected', expected: 'Connected' },
        { test: 'No critical startup errors', expected: 'No errors' }
      ],
      createdAt: utils.formatTimestamp()
    };
  },

  buildRollbackProposalIfNeeded(releaseId, reason = '', services = {}) {
    return {
      proposalType: 'rollback',
      releaseId,
      version: 'v1.0.0',
      action: 'Rollback v1.0.0 to previous stable version',
      reason: reason || 'Health check failure or critical regression detected',
      directAction: false,
      requiresEvaluation: true,
      requiresApproval: true,
      details: {
        method: 'RESTORE previous stable deployment on Render',
        postRollback: ['Verify app boots', 'Verify dashboard functional', 'Verify Telegram functional', 'Generate post-rollback incident report']
      },
      createdAt: utils.formatTimestamp()
    };
  }
};

module.exports = ProductionDeployProposalBuilder;
