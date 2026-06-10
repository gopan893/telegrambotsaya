'use strict';

const store = require('./v2-planning-store');
const utils = require('./v2-planning-utils');

async function requireV1FinalLockPassed(services) {
  const v1Store = utils.safeCall(() => require('../stabilization/stabilization-store'), null);
  if (!v1Store) return { passed: false, result: null, reason: 'V1 stabilization store not available.' };
  const lock = v1Store.getV1FinalLock(services?.workspaceId);
  if (!lock) return { passed: false, result: null, reason: 'V1 final lock not started. Complete v1 stabilization first.' };
  if (lock.status !== 'locked') return { passed: false, result: lock, reason: `V1 final lock status is "${lock.status}". Must be "locked" before v2 planning.` };
  return { passed: true, result: lock, score: 100 };
}

async function collectV1PainPoints(services) {
  const items = [
    { id: 'pp-1', area: 'registry', description: 'Registry v2 normalization incomplete across modules', severity: 'medium' },
    { id: 'pp-2', area: 'dashboard', description: 'Dashboard architecture overly complex with tab fallback chains', severity: 'high' },
    { id: 'pp-3', area: 'commands', description: 'Command router needs cleanup after Telegram Control layer', severity: 'medium' },
    { id: 'pp-4', area: 'governance', description: 'Capability governance needs hardening and consolidation', severity: 'high' },
    { id: 'pp-5', area: 'api', description: 'API contracts lack standardization across modules', severity: 'medium' },
    { id: 'pp-6', area: 'storage', description: 'Storage and module boundary cleanup needed', severity: 'medium' },
    { id: 'pp-7', area: 'tests', description: 'Test harness needs consolidation across test files', severity: 'low' },
    { id: 'pp-8', area: 'performance', description: 'Performance optimization opportunities identified', severity: 'medium' },
    { id: 'pp-9', area: 'plugins', description: 'Plugin ecosystem needs maturity improvements', severity: 'low' },
    { id: 'pp-10', area: 'rag', description: 'RAG quality improvements needed for production readiness', severity: 'medium' },
    { id: 'pp-11', area: 'mobile', description: 'Mobile UX maturity improvements needed', severity: 'low' },
    { id: 'pp-12', area: 'dr', description: 'Disaster recovery maturity lacking', severity: 'high' },
    { id: 'pp-13', area: 'reliability', description: 'Reliability and SLO maturity improvements needed', severity: 'high' }
  ];
  return { passed: true, data: items, count: items.length, score: 100 };
}

async function collectConsolidationFindings(services) {
  const items = [
    { id: 'cf-1', module: 'registries', finding: 'Registry modules spread across src/registry-v2 and src/plugins', impact: 'medium' },
    { id: 'cf-2', module: 'dashboard', finding: 'Dashboard tab registration scattered across multiple files', impact: 'high' },
    { id: 'cf-3', module: 'commands', finding: 'Command definitions duplicated in Telegram Control and legacy routers', impact: 'medium' },
    { id: 'cf-4', module: 'storage', finding: 'Storage module boundaries poorly defined between stores', impact: 'medium' },
    { id: 'cf-5', module: 'tests', finding: 'Test files use inconsistent patterns and setups', impact: 'low' },
    { id: 'cf-6', module: 'api', finding: 'API route patterns not standardized across modules', impact: 'high' }
  ];
  return { passed: true, data: items, count: items.length, score: 100 };
}

async function collectHotfixFindings(services) {
  const items = [
    { id: 'hf-1', area: 'dashboard', finding: 'Hotfix A/D dashboard menu gaps identified', severity: 'medium' },
    { id: 'hf-2', area: 'api', finding: 'API hotfix routes lack consistency checks', severity: 'low' },
    { id: 'hf-3', area: 'pwa', finding: 'PWA cache exceptions need audit after stabilization', severity: 'medium' },
    { id: 'hf-4', area: 'security', finding: 'Security hotfix surface expanded during v1 stabilization', severity: 'high' }
  ];
  return { passed: true, data: items, count: items.length, score: 100 };
}

async function buildV2PlanningGateReport(services) {
  const v1Check = await requireV1FinalLockPassed(services);
  if (!v1Check.passed) {
    const gate = { status: 'blocked', reason: v1Check.reason, v1LockResult: v1Check.result, timestamp: new Date().toISOString() };
    store.setV2PlanningGate(gate, services?.workspaceId);
    return { passed: false, status: 'blocked', gate, score: 0 };
  }
  const painPoints = await collectV1PainPoints(services);
  const consolidation = await collectConsolidationFindings(services);
  const hotfix = await collectHotfixFindings(services);
  const scores = [v1Check.score, painPoints.score, consolidation.score, hotfix.score];
  const overallScore = scores.length ? Math.round(scores.reduce((a, c) => a + c, 0) / scores.length) : 0;
  const gate = {
    status: 'passed',
    v1LockPassed: true,
    painPointCount: painPoints.count,
    consolidationFindingCount: consolidation.count,
    hotfixFindingCount: hotfix.count,
    overallScore,
    v1LockResult: v1Check.result,
    painPoints: painPoints.data,
    consolidationFindings: consolidation.data,
    hotfixFindings: hotfix.data,
    timestamp: new Date().toISOString()
  };
  store.setV2PlanningGate(gate, services?.workspaceId);
  return { passed: true, status: 'passed', gate, score: overallScore };
}

async function runV2PlanningGate(services) {
  return buildV2PlanningGateReport(services);
}

module.exports = { runV2PlanningGate, requireV1FinalLockPassed, collectV1PainPoints, collectConsolidationFindings, collectHotfixFindings, buildV2PlanningGateReport };
