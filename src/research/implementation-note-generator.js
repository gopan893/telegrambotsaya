'use strict';

const utils = require('./research-utils');

function generateImplementationNote(taskId, services = {}) {
  return {
    taskId,
    title: 'Implementation Note',
    architectureImpact: generateArchitectureImpact(taskId, services),
    riskAndMitigation: generateRiskAndMitigation(taskId, services),
    testPlan: generateTestPlanFromResearch(taskId, services),
    rolloutPlan: generateRolloutPlanFromResearch(taskId, services),
    createdAt: new Date().toISOString()
  };
}

function generateArchitectureImpact(taskId, services = {}) {
  return {
    summary: 'Dampak arsitektur perlu dievaluasi setelah riset selesai.',
    modules: [],
    recommendations: ['Review module yang terpengaruh sebelum implementasi.']
  };
}

function generateRiskAndMitigation(taskId, services = {}) {
  return {
    risks: [
      { risk: 'Perubahan tidak terduga pada dependensi', severity: 'medium', mitigation: 'Gunakan integration gate dan evaluasi' }
    ],
    overallRisk: 'medium'
  };
}

function generateTestPlanFromResearch(taskId, services = {}) {
  return {
    tests: [
      { type: 'unit', description: 'Unit test untuk module baru', priority: 'high' },
      { type: 'integration', description: 'Integration test dengan existing system', priority: 'high' },
      { type: 'regression', description: 'Regression test untuk area terdampak', priority: 'medium' }
    ],
    recommendation: 'Unit + integration test wajib. Regression test jika mengubah module existing.'
  };
}

function generateRolloutPlanFromResearch(taskId, services = {}) {
  return {
    stages: [
      { stage: 1, action: 'Implementation dan unit test', duration: 'TBD' },
      { stage: 2, action: 'Integration test di staging', duration: 'TBD' },
      { stage: 3, action: 'Production deploy dengan rollback plan', duration: 'TBD' }
    ],
    recommendation: 'Gunakan rollout planner untuk production deploy.'
  };
}

module.exports = { generateImplementationNote, generateArchitectureImpact, generateRiskAndMitigation, generateTestPlanFromResearch, generateRolloutPlanFromResearch };
