'use strict';

const { getReleaseCandidate } = require('./v2-release-store');
const { runV2ReadinessGate } = require('./v2-readiness-gate');
const { runV2RegressionSuite } = require('./v2-regression-suite-runner');
const { buildV2CompatibilityReport } = require('./v2-compatibility-checker');
const { generateV2Changelog } = require('./v2-changelog-generator');
const { generateV2UpgradeGuide } = require('./v2-upgrade-guide-generator');
const { generateV2RollbackPlan } = require('./v2-rollback-plan-generator');
const { generateV2ReleaseNotes } = require('./v2-release-notes-generator');

function generateV2ReleaseReport(candidateId, services) {
  const candidate = getReleaseCandidate(candidateId);
  if (!candidate) return null;

  const readiness = runV2ReadinessGate(candidateId, services);
  const regression = runV2RegressionSuite(services);
  const compatibility = buildV2CompatibilityReport(services);
  const changelog = generateV2Changelog(services);
  const upgradeGuide = generateV2UpgradeGuide(services);
  const rollbackPlan = generateV2RollbackPlan(services);
  const releaseNotes = generateV2ReleaseNotes(candidateId, services);

  return {
    reportId: `v2-report-${candidateId}`,
    candidateId,
    version: candidate.version,
    status: candidate.status,
    sections: {
      readiness,
      regression,
      compatibility,
      changelog,
      upgradeGuide,
      rollbackPlan,
      releaseNotes,
    },
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  generateV2ReleaseReport,
};
