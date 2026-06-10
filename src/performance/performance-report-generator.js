'use strict';

const startupProfiler = require('./startup-profiler');
const importCostAnalyzer = require('./import-cost-analyzer');
const dashboardBundleAuditor = require('./dashboard-bundle-auditor');
const dashboardLazyLoaderPlanner = require('./dashboard-lazy-loader-planner');
const apiResponseProfiler = require('./api-response-profiler');
const payloadSizeAuditor = require('./payload-size-auditor');
const cacheEfficiencyAuditor = require('./cache-efficiency-auditor');
const performanceBudgetManager = require('./performance-budget-manager');
const performanceRegressionDetector = require('./performance-regression-detector');
const performanceScorecard = require('./performance-scorecard');

function generatePerformanceReport(services = {}) {
  const startupReport = startupProfiler.buildStartupPerformanceReport(services);
  const importCostReport = importCostAnalyzer.buildImportCostReport(services);
  const bundleReport = dashboardBundleAuditor.buildDashboardBundleReport(services);
  const lazyLoadPlan = dashboardLazyLoaderPlanner.buildLazyLoadCompatibilityPlan(services);
  const apiReport = apiResponseProfiler.buildApiResponsePerformanceReport(services);
  const payloadReport = payloadSizeAuditor.buildPayloadSizeReport(services);
  const cacheReport = cacheEfficiencyAuditor.buildCacheEfficiencyReport(services);
  const budgetReport = performanceBudgetManager.buildPerformanceBudgetReport(services);
  const regressionReport = performanceRegressionDetector.buildPerformanceRegressionReport(services);
  const scorecard = performanceScorecard.calculatePerformanceScorecard(services);
  const scoreExplanation = performanceScorecard.buildPerformanceScoreExplanation(scorecard, services);

  return {
    timestamp: new Date().toISOString(),
    description: 'Complete performance report',
    scorecard,
    scoreExplanation,
    sections: {
      startup: startupReport,
      importCost: importCostReport,
      dashboardBundle: bundleReport,
      lazyLoad: lazyLoadPlan,
      apiResponse: apiReport,
      payloadSize: payloadReport,
      cacheEfficiency: cacheReport,
      performanceBudgets: budgetReport,
      regressionDetections: regressionReport
    },
    summary: {
      overallScore: scorecard.overall,
      rating: scorecard.rating,
      totalRegressions: regressionReport.summary.totalRegressions,
      budgetWarnings: budgetReport.summary.warnings,
      budgetBlockers: budgetReport.summary.blocked,
      recommendations: [
        ...startupReport.recommendations,
        ...importCostReport.recommendations,
        ...bundleReport.recommendations,
        ...apiReport.recommendations,
        ...payloadReport.recommendations,
        ...cacheReport.recommendations,
        ...budgetReport.recommendations,
        ...regressionReport.recommendations
      ]
    }
  };
}

module.exports = {
  generatePerformanceReport
};
