'use strict';

const consolidationStore = require('./consolidation-store');
const architectureAuditor = require('./architecture-auditor');
const moduleDuplicationDetector = require('./module-duplication-detector');
const routeRegistryConsolidator = require('./route-registry-consolidator');
const commandRegistryConsolidator = require('./command-registry-consolidator');
const capabilityRegistryConsolidator = require('./capability-registry-consolidator');
const dashboardRegistryAuditor = require('./dashboard-registry-auditor');
const docsConsistencyAuditor = require('./docs-consistency-auditor');
const testCoverageMapper = require('./test-coverage-mapper');
const performanceBaselineChecker = require('./performance-baseline-checker');
const v2RoadmapGenerator = require('./v2-roadmap-generator');
const consolidationReportGenerator = require('./consolidation-report-generator');
const consolidationUtils = require('./consolidation-utils');

module.exports = {
  consolidationStore,
  architectureAuditor,
  moduleDuplicationDetector,
  routeRegistryConsolidator,
  commandRegistryConsolidator,
  capabilityRegistryConsolidator,
  dashboardRegistryAuditor,
  docsConsistencyAuditor,
  testCoverageMapper,
  performanceBaselineChecker,
  v2RoadmapGenerator,
  consolidationReportGenerator,
  consolidationUtils
};
