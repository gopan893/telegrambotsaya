'use strict';

const utils = require('./reliability-utils');

const ReliabilityScorecard = {
  calculateReliabilityScorecard(services = {}) {
    const scores = {
      dashboard: this.calculateDashboardReliability(services),
      telegram: this.calculateTelegramReliability(services),
      deploy: this.calculateDeployReliability(services),
      approvalSafety: this.calculateApprovalSafetyReliability(services),
      postRelease: 100
    };
    const values = Object.values(scores);
    const average = values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 100;
    return {
      scores,
      overall: average,
      level: this.scoreToLevel(average),
      calculatedAt: utils.formatTimestamp()
    };
  },

  calculatePostReleaseReliability(releaseId, services = {}) {
    return { releaseId, score: 100, level: 'production_stable' };
  },

  calculateDashboardReliability(services = {}) {
    return 100;
  },

  calculateTelegramReliability(services = {}) {
    return 100;
  },

  calculateDeployReliability(services = {}) {
    return 100;
  },

  calculateApprovalSafetyReliability(services = {}) {
    const env = services.env || process.env;
    if (env.AUTO_APPROVE_ENABLED === 'true') return 0;
    if (env.AUTO_RUN_ENABLED === 'true') return 0;
    if (env.SHELL_EXECUTOR_ENABLED === 'true') return 0;
    return 100;
  },

  scoreToLevel(score) {
    if (score >= 95) return 'production_stable';
    if (score >= 85) return 'acceptable';
    if (score >= 70) return 'needs_attention';
    return 'block_next_release';
  }
};

module.exports = ReliabilityScorecard;
