'use strict';

module.exports = {
  portfolioStore: require('./portfolio-store'),
  portfolioScanner: require('./portfolio-scanner'),
  projectHealthScorer: require('./project-health-scorer'),
  projectPriorityEngine: require('./project-priority-engine'),
  projectDependencyDetector: require('./project-dependency-detector'),
  projectStalenessDetector: require('./project-staleness-detector'),
  portfolioRiskReview: require('./portfolio-risk-review'),
  portfolioCostReview: require('./portfolio-cost-review'),
  portfolioStrategyPlanner: require('./portfolio-strategy-planner'),
  portfolioNextActionEngine: require('./portfolio-next-action-engine'),
  portfolioReportGenerator: require('./portfolio-report-generator'),
  portfolioProposalBridge: require('./portfolio-proposal-bridge'),
  portfolioUtils: require('./portfolio-utils')
};
