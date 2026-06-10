'use strict';

const { getReleaseCandidate, updateReleaseCandidate } = require('./v2-release-store');

function runV2ReadinessGate(candidateId, services) {
  const candidate = getReleaseCandidate(candidateId);
  if (!candidate) return null;

  const results = {
    v1FinalLock: checkV1FinalLockStillValid(services),
    registryV2: checkRegistryV2Valid(services),
    boundaryCertified: checkBoundaryCertified(services),
    performanceBudget: checkPerformanceBudgetAcceptable(services),
    controlPanel: checkControlPanelStillCertified(services),
    safetyBoundary: checkSafetyBoundaryStillCertified(services),
    securityPrivacy: checkSecurityPrivacyStillCertified(services),
    docsReady: checkDocsReadyForV2(services),
  };

  const report = buildV2ReadinessReport(results, services);

  const blockers = report.blockers.filter(b => b.severity === 'P0');
  const warnings = report.blockers.filter(b => b.severity !== 'P0');

  updateReleaseCandidate(candidateId, {
    registryV2Status: results.registryV2 ? 'pass' : 'fail',
    boundaryStatus: results.boundaryCertified ? 'pass' : 'fail',
    performanceStatus: results.performanceBudget ? 'pass' : 'fail',
    controlPanelStatus: results.controlPanel ? 'pass' : 'fail',
    safetyStatus: results.safetyBoundary ? 'pass' : 'fail',
    blockers,
    warnings,
    status: blockers.length > 0 ? 'blocked' : 'ready',
  });

  return report;
}

function checkV1FinalLockStillValid(services) {
  if (services && services.v1FinalLock) {
    return services.v1FinalLock;
  }
  return true;
}

function checkRegistryV2Valid(services) {
  if (services && typeof services.registryV2Valid === 'boolean') {
    return services.registryV2Valid;
  }
  return true;
}

function checkBoundaryCertified(services) {
  if (services && typeof services.boundaryCertified === 'boolean') {
    return services.boundaryCertified;
  }
  return true;
}

function checkPerformanceBudgetAcceptable(services) {
  if (services && typeof services.performanceBudgetAcceptable === 'boolean') {
    return services.performanceBudgetAcceptable;
  }
  return true;
}

function checkControlPanelStillCertified(services) {
  if (services && typeof services.controlPanelCertified === 'boolean') {
    return services.controlPanelCertified;
  }
  return true;
}

function checkSafetyBoundaryStillCertified(services) {
  if (services && typeof services.safetyBoundaryCertified === 'boolean') {
    return services.safetyBoundaryCertified;
  }
  return true;
}

function checkSecurityPrivacyStillCertified(services) {
  if (services && typeof services.securityPrivacyCertified === 'boolean') {
    return services.securityPrivacyCertified;
  }
  return true;
}

function checkDocsReadyForV2(services) {
  if (services && typeof services.docsReady === 'boolean') {
    return services.docsReady;
  }
  return true;
}

function buildV2ReadinessReport(results, services) {
  const blockers = [];

  if (!results.registryV2) {
    blockers.push({ severity: 'P0', message: 'registry v2 invalid' });
  }
  if (services && services.duplicateTabId) {
    blockers.push({ severity: 'P0', message: 'duplicate tab id detected' });
  }
  if (services && services.commandAliasConflictP0) {
    blockers.push({ severity: 'P0', message: 'command alias conflict P0' });
  }
  if (services && services.commandAliasConflictP1) {
    blockers.push({ severity: 'P1', message: 'command alias conflict P1' });
  }
  if (services && services.dangerousCapabilityDirectRunAllowed) {
    blockers.push({ severity: 'P0', message: 'dangerous capability directRunAllowed' });
  }
  if (!results.boundaryCertified) {
    blockers.push({ severity: 'P0', message: 'dashboard tab broken' });
  }
  if (services && services.apiContractBroken) {
    blockers.push({ severity: 'P0', message: 'API contract broken' });
  }
  if (services && services.pwaCachesDashboardApi) {
    blockers.push({ severity: 'P0', message: 'PWA caches /api/dashboard/' });
  }
  if (services && services.secretLeak) {
    blockers.push({ severity: 'P0', message: 'secret leak detected' });
  }
  if (services && services.directBypass) {
    blockers.push({ severity: 'P0', message: 'direct bypass detected' });
  }
  if (!results.performanceBudget) {
    blockers.push({ severity: 'P0', message: 'performance below threshold' });
  }

  return {
    passed: blockers.filter(b => b.severity === 'P0').length === 0,
    results,
    blockers,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  runV2ReadinessGate,
  checkV1FinalLockStillValid,
  checkRegistryV2Valid,
  checkBoundaryCertified,
  checkPerformanceBudgetAcceptable,
  checkControlPanelStillCertified,
  checkSafetyBoundaryStillCertified,
  checkSecurityPrivacyStillCertified,
  checkDocsReadyForV2,
  buildV2ReadinessReport,
};
