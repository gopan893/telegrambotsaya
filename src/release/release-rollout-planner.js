'use strict';

const utils = require('./release-utils');

const ReleaseRolloutPlanner = {
  createReleaseRolloutPlan(releaseId, services = {}) {
    return {
      releaseId,
      stages: [
        { stage: 'pre_release_check', status: 'pending', description: 'Run pre-release verification checks' },
        { stage: 'release_proposal', status: 'pending', description: 'Create and approve GitHub release/tag proposal' },
        { stage: 'deploy_proposal', status: 'pending', description: 'Create and approve production deploy proposal' },
        { stage: 'approved_deploy', status: 'pending', description: 'Execute approved production deploy' },
        { stage: 'smoke_test', status: 'pending', description: 'Run smoke tests after deploy' },
        { stage: 'health_window', status: 'pending', description: 'Monitor post-release health window' },
        { stage: 'post_release_report', status: 'pending', description: 'Generate post-release report' },
        { stage: 'complete_or_rollback', status: 'pending', description: 'Complete release or initiate rollback' }
      ],
      createdAt: utils.formatTimestamp()
    };
  },

  createPreDeployChecklist(releaseId, services = {}) {
    return {
      releaseId,
      items: [
        { check: 'RC stabilization audit passed', done: false },
        { check: 'Rollout readiness gate passed', done: false },
        { check: 'GitHub release proposal created', done: false },
        { check: 'GitHub release proposal approved', done: false },
        { check: 'Deploy proposal created', done: false },
        { check: 'Deploy proposal approved', done: false },
        { check: 'Environment checklist verified', done: false },
        { check: 'Security/privacy checks passed', done: false },
        { check: 'Monitoring/SLO tools ready', done: false },
        { check: 'Rollback plan documented', done: false }
      ],
      createdAt: utils.formatTimestamp()
    };
  },

  createDeployVerificationChecklist(releaseId, services = {}) {
    return {
      releaseId,
      items: [
        { check: 'App boots successfully', done: false },
        { check: 'Dashboard loads', done: false },
        { check: 'All known tabs render', done: false },
        { check: 'Telegram bot responds', done: false },
        { check: 'Webhook health OK', done: false },
        { check: 'Postgres/Redis connected', done: false },
        { check: 'No secret leakage in outputs', done: false },
        { check: 'No critical errors in logs', done: false }
      ],
      createdAt: utils.formatTimestamp()
    };
  },

  createRollbackRehearsalPlan(releaseId, services = {}) {
    return {
      releaseId,
      steps: [
        { step: 1, action: 'Identify rollback trigger (SLO violation, critical incident, user-reported regression)' },
        { step: 2, action: 'Create rollback proposal (proposal-only, no direct rollback)' },
        { step: 3, action: 'Submit to Evaluation v2 for assessment' },
        { step: 4, action: 'Executor approves rollback proposal' },
        { step: 5, action: 'Execute approved rollback (RESTORE previous stable version)' },
        { step: 6, action: 'Verify app boots after rollback' },
        { step: 7, action: 'Verify dashboard/Telegram functional after rollback' },
        { step: 8, action: 'Generate post-rollback incident report' }
      ],
      note: 'All rollback actions require proposal + approval. No direct rollback from runtime.',
      createdAt: utils.formatTimestamp()
    };
  },

  createPostReleaseMonitoringPlan(releaseId, services = {}) {
    return {
      releaseId,
      windows: [
        { window: 'quick', duration: '30 minutes', checks: ['app uptime', 'dashboard availability', 'Telegram response', 'webhook health'] },
        { window: 'standard', duration: '2 hours', checks: ['SLO evaluation', 'error rate', 'latency', 'DB/Redis health', 'no regressions'] },
        { window: 'observation', duration: '24 hours', checks: ['reliability scorecard', 'SLO burn rate', 'incident count', 'user-reported issues'] }
      ],
      createdAt: utils.formatTimestamp()
    };
  }
};

module.exports = ReleaseRolloutPlanner;
