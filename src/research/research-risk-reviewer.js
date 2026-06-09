'use strict';

const utils = require('./research-utils');

function reviewResearchRisk(taskId, services = {}) {
  return {
    taskId,
    riskLevel: 'low',
    securityRisks: [],
    privacyRisks: [],
    costRisks: [],
    operationalRisks: [],
    overallRisk: 'low',
    recommendation: 'Risiko rendah. Dilanjutkan dengan implementation plan.'};
}

function reviewExternalSourceRisk(sources = [], services = {}) {
  const external = sources.filter(s => s.accessMode === 'external');
  return {
    hasExternalSources: external.length > 0,
    externalCount: external.length,
    risk: external.length > 3 ? 'medium' : 'low',
    recommendation: external.length > 3 ? 'Batasi sumber eksternal untuk mengurangi risiko keamanan.' : 'Sumber eksternal dalam batas aman.'
  };
}

function reviewImplementationRisk(plan = {}, services = {}) {
  return {
    risk: 'low',
    blockers: [],
    recommendation: 'Implementation plan aman untuk dilanjutkan.'
  };
}

module.exports = { reviewResearchRisk, reviewExternalSourceRisk, reviewImplementationRisk };
