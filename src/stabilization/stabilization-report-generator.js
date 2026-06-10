'use strict';

const store = require('./stabilization-store');
const lockManager = require('./v1-final-lock-manager');
const readinessGate = require('./v1-final-readiness-gate');
const utils = require('./stabilization-utils');

async function generateStabilizationReport(services) {
  const lockReport = await lockManager.buildV1FinalLockReport(services);
  const readinessResult = await readinessGate.runV1FinalReadinessGate(services);
  return {
    summary: {
      status: lockReport.status,
      overallScore: readinessResult.overallScore,
      lockedCount: lockReport.lockedCount,
      totalChecks: lockReport.totalChecks,
      blockerCount: lockReport.blockerCount,
      warningCount: lockReport.warningCount
    },
    lockReport,
    readinessResult,
    timestamp: new Date().toISOString()
  };
}

module.exports = { generateStabilizationReport };
