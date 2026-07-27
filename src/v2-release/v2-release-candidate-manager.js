'use strict';

const { createReleaseCandidate, getReleaseCandidate, updateReleaseCandidate } = require('./v2-release-store');

function createV2ReleaseCandidate(input, services) {
  const candidate = createReleaseCandidate({
    workspaceId: input.workspaceId,
    version: input.version || 'v2.0.0-rc.1',
    sourceVersion: input.sourceVersion,
    status: 'draft',
  });
  return candidate;
}

function getV2ReleaseCandidateStatus(id, services) {
  const candidate = getReleaseCandidate(id);
  if (!candidate) return null;
  return {
    id: candidate.id,
    version: candidate.version,
    status: candidate.status,
    registryV2Status: candidate.registryV2Status,
    boundaryStatus: candidate.boundaryStatus,
    performanceStatus: candidate.performanceStatus,
    controlPanelStatus: candidate.controlPanelStatus,
    safetyStatus: candidate.safetyStatus,
    compatibilityStatus: candidate.compatibilityStatus,
    blockers: candidate.blockers,
    warnings: candidate.warnings,
  };
}

function blockV2ReleaseIfReadinessFails(id, services) {
  const candidate = getReleaseCandidate(id);
  if (!candidate) return null;

  const blockers = [];
  const warnings = [];

  if (candidate.registryV2Status === 'fail') {
    blockers.push({ severity: 'P0', message: 'Registry v2 validation failed' });
  }
  if (candidate.boundaryStatus === 'fail') {
    blockers.push({ severity: 'P0', message: 'Boundary certification failed' });
  }
  if (candidate.performanceStatus === 'fail') {
    blockers.push({ severity: 'P0', message: 'Performance budget not met' });
  }
  if (candidate.controlPanelStatus === 'fail') {
    blockers.push({ severity: 'P0', message: 'Control panel certification failed' });
  }
  if (candidate.safetyStatus === 'fail') {
    blockers.push({ severity: 'P0', message: 'Safety boundary certification failed' });
  }
  if (candidate.compatibilityStatus === 'fail') {
    warnings.push({ severity: 'P1', message: 'Compatibility checks have failures' });
  }

  const updated = updateReleaseCandidate(id, {
    blockers,
    warnings,
    status: blockers.length > 0 ? 'blocked' : candidate.status,
  });

  return updated;
}

function buildV2ReleaseCandidateSummary(id, services) {
  const candidate = getReleaseCandidate(id);
  if (!candidate) return null;

  return {
    id: candidate.id,
    version: candidate.version,
    status: candidate.status,
    workspaceId: candidate.workspaceId,
    blockerCount: candidate.blockers.length,
    warningCount: candidate.warnings.length,
    readinessPassed: candidate.blockers.length === 0,
    proposalIds: candidate.proposalIds,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

module.exports = {
  createV2ReleaseCandidate,
  getV2ReleaseCandidateStatus,
  blockV2ReleaseIfReadinessFails,
  buildV2ReleaseCandidateSummary,
};
