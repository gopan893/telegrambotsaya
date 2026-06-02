'use strict';

const utils = require('../delegation-utils');

const AGENT_EVALUATION_V2_CASES_KEY = 'agent_evaluation_v2_cases';
const AGENT_EVALUATION_V2_RUNS_KEY = 'agent_evaluation_v2_runs';

async function listCustomCases(filters = {}, services = {}) {
  const items = await utils.safeRead(AGENT_EVALUATION_V2_CASES_KEY, [], services);
  return (Array.isArray(items) ? items : [])
    .filter(item => item.enabled !== false)
    .filter(item => !filters.category || item.category === filters.category)
    .filter(item => !filters.id || item.id === filters.id);
}

async function saveCustomCase(testCase = {}, services = {}) {
  const items = await utils.safeRead(AGENT_EVALUATION_V2_CASES_KEY, [], services);
  const safe = utils.sanitizeDelegationPayload({
    ...testCase,
    id: testCase.id || utils.createId('eval_case'),
    enabled: testCase.enabled !== false,
    createdAt: testCase.createdAt || utils.nowIso(),
    updatedAt: utils.nowIso()
  });
  const next = (Array.isArray(items) ? items : []).filter(item => item.id !== safe.id).concat(safe);
  await utils.safeWrite(AGENT_EVALUATION_V2_CASES_KEY, next.slice(-500), services);
  return safe;
}

async function saveEvaluationRun(run = {}, services = {}) {
  const items = await utils.safeRead(AGENT_EVALUATION_V2_RUNS_KEY, [], services);
  const safe = utils.sanitizeDelegationPayload({
    ...run,
    id: run.id || utils.createId('eval_v2_run'),
    createdAt: run.createdAt || utils.nowIso()
  });
  await utils.safeWrite(AGENT_EVALUATION_V2_RUNS_KEY, (Array.isArray(items) ? items : []).concat(safe).slice(-200), services);
  try {
    await utils.auditDelegation('agent_evaluation_v2/run', {
      targetType: 'agent_evaluation_run',
      id: safe.id,
      workspaceId: services.workspaceId || 'default',
      userId: services.userId || '',
      summary: {
        status: safe.status,
        averageScore: safe.averageScore,
        qualityGateStatus: safe.qualityGateStatus
      }
    }, services);
  } catch (_) {}
  return safe;
}

async function listEvaluationRuns(filters = {}, services = {}) {
  const items = await utils.safeRead(AGENT_EVALUATION_V2_RUNS_KEY, [], services);
  const limit = Math.min(Math.max(Number(filters.limit || 20), 1), 100);
  return (Array.isArray(items) ? items : [])
    .filter(item => !filters.status || item.status === filters.status)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, limit);
}

async function getEvaluationRun(runId, services = {}) {
  const items = await utils.safeRead(AGENT_EVALUATION_V2_RUNS_KEY, [], services);
  return (Array.isArray(items) ? items : []).find(item => String(item.id) === String(runId)) || null;
}

async function getLatestEvaluationRun(services = {}) {
  const items = await listEvaluationRuns({ limit: 1 }, services);
  return items[0] || null;
}

module.exports = {
  AGENT_EVALUATION_V2_CASES_KEY,
  AGENT_EVALUATION_V2_RUNS_KEY,
  getEvaluationRun,
  getLatestEvaluationRun,
  listCustomCases,
  listEvaluationRuns,
  saveCustomCase,
  saveEvaluationRun
};
