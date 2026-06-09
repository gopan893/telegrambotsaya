'use strict';

module.exports = {
  docsInventoryScanner: require('./docs-inventory-scanner'),
  docsGapDetector: require('./docs-gap-detector'),
  docsFreshnessReviewer: require('./docs-freshness-reviewer'),
  commandDocsChecker: require('./command-docs-checker'),
  architectureDocsChecker: require('./architecture-docs-checker'),
  docsUpdatePlanGenerator: require('./docs-update-plan-generator'),
  docsReportGenerator: require('./docs-report-generator'),
  docsIntelUtils: require('./docs-intel-utils')
};
