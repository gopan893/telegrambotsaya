'use strict';

const golden = require('./evaluation-golden-cases');
const dryRunner = require('./evaluation-dry-runner');
const scorer = require('./evaluation-scorer-v2');
const gates = require('./evaluation-quality-gates');
const store = require('./evaluation-run-store');
const utils = require('../delegation-utils');

async function listEvaluationCases(filters = {}, services = {}) {
  const custom = await store.listCustomCases(filters, services);
  return golden.listGoldenCases(filters).concat(custom)
    .filter(item => !filters.category || item.category === filters.category)
    .filter(item => !filters.id || item.id === filters.id);
}

async function getEvaluationCase(caseId, services = {}) {
  const all = await listEvaluationCases({}, services);
  return all.find(item => String(item.id) === String(caseId)) || null;
}

async function createEvaluationCase(input = {}, services = {}) {
  if (!input.input) {
    const err = new Error('INPUT_REQUIRED');
    err.code = 'INPUT_REQUIRED';
    throw err;
  }
  return store.saveCustomCase(input, services);
}

async function runEvaluationCase(caseIdOrCase, services = {}) {
  const testCase = typeof caseIdOrCase === 'string'
    ? await getEvaluationCase(caseIdOrCase, services)
    : caseIdOrCase;
  if (!testCase) return { ok: false, reason: 'EVALUATION_CASE_NOT_FOUND' };
  const dry = await dryRunner.runDryEvaluation(testCase, services);
  const score = scorer.scoreEvaluationResult(dry, testCase);
  return {
    ok: true,
    case: utils.sanitizeDelegationPayload(testCase),
    ...utils.sanitizeDelegationPayload(dry),
    score
  };
}

async function runEvaluationSuite(filters = {}, services = {}) {
  const selected = await listEvaluationCases(filters, services);
  const limit = Math.min(Math.max(Number(filters.limit || selected.length || 50), 1), 100);
  const results = [];
  for (const testCase of selected.slice(0, limit)) {
    results.push(await runEvaluationCase(testCase, services));
  }
  const summary = scorer.summarizeEvaluationSuite(results);
  const qualityGateStatus = gates.evaluateQualityGates(summary, filters);
  const run = await store.saveEvaluationRun({
    workspaceId: services.workspaceId || 'default',
    userId: services.userId || '',
    suiteName: filters.suiteName || 'agent-evaluation-v2',
    status: qualityGateStatus.passed && summary.failedCases === 0 ? 'passed' : (summary.totalCases ? 'partial' : 'failed'),
    totalCases: summary.totalCases,
    passedCases: summary.passedCases,
    failedCases: summary.failedCases,
    averageScore: summary.averageScore,
    categoryScores: summary.categoryScores,
    qualityGateStatus: qualityGateStatus.status,
    qualityGates: qualityGateStatus,
    failures: summary.failures,
    regressions: [],
    results,
    createdAt: utils.nowIso(),
    completedAt: utils.nowIso()
  }, services);
  return {
    ok: true,
    run,
    results,
    summary: {
      ...summary,
      qualityGateStatus: qualityGateStatus.status,
      qualityGates: qualityGateStatus
    }
  };
}

async function listEvaluationRuns(filters = {}, services = {}) {
  return store.listEvaluationRuns(filters, services);
}

async function getEvaluationRun(runId, services = {}) {
  return store.getEvaluationRun(runId, services);
}

async function getLatestEvaluationRun(services = {}) {
  return store.getLatestEvaluationRun(services);
}

module.exports = {
  createEvaluationCase,
  getEvaluationCase,
  getEvaluationRun,
  getLatestEvaluationRun,
  listEvaluationCases,
  listEvaluationRuns,
  runEvaluationCase,
  runEvaluationSuite
};
