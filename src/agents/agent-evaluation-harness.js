'use strict';

const cases = require('./agent-evaluation-cases');
const scorer = require('./agent-evaluation-scorer');
const actionDetector = require('./agent-action-detector');
const bridge = require('./agent-executor-bridge');
const decisionDetector = require('./decision-detector');
const delegationEngine = require('./delegation-engine');
const dryRunner = require('./eval/evaluation-dry-runner');
const utils = require('./delegation-utils');

const AGENT_EVALUATION_CASES_KEY = 'agent_evaluation_cases';
const AGENT_EVALUATION_RUNS_KEY = 'agent_evaluation_runs';

async function listEvaluationCases(filters = {}, services = {}) {
  const custom = await utils.safeRead(AGENT_EVALUATION_CASES_KEY, [], services);
  return cases.listDefaultEvaluationCases(filters).concat(Array.isArray(custom) ? custom : [])
    .filter(item => !filters.category || item.category === filters.category)
    .filter(item => !filters.id || item.id === item.id);
}

async function getEvaluationCase(caseId, services = {}) {
  const all = await listEvaluationCases({}, services);
  return all.find(item => item.id === caseId) || null;
}

async function runEvaluationCase(caseIdOrCase, services = {}) {
  const testCase = typeof caseIdOrCase === 'string' ? await getEvaluationCase(caseIdOrCase, services) : caseIdOrCase;
  if (!testCase) return { ok: false, reason: 'EVALUATION_CASE_NOT_FOUND' };
  if (testCase.knowledgeCategory) {
    const dry = await dryRunner.runDryEvaluation(testCase, services);
    const result = {
      ok: true,
      id: utils.createId('eval_result'),
      case: testCase,
      input: dry.input || utils.sanitizeDelegationText(testCase.input || '', { max: 900 }),
      route: dry.route,
      selectedAgents: dry.selectedAgents || [],
      riskLevel: dry.riskLevel || 'low',
      approvalRequired: Boolean(dry.approvalRequired),
      actionType: dry.actionType || '',
      decisionTriggered: Boolean(dry.decisionTriggered),
      delegationTriggered: Boolean(dry.delegationTriggered),
      outputText: dry.outputText || '',
      knowledgeSafety: { memoryBlocked: dry.outputText ? !/postgresql|pass@host|sk-|ghp_/i.test(dry.outputText) : true },
      createdAt: utils.nowIso()
    };
    result.score = scorer.scoreEvaluationResult(result, testCase.scoringRubric || {});
    return result;
  }
  const input = utils.sanitizeDelegationText(testCase.input || '', { max: 900 });
  const route = require('./agent-router').routeMessage(input, {
    forceMode: 'natural_smart',
    groupSettings: { mode: 'natural_smart', maxAutoAgents: 5 }
  }, services);
  const action = actionDetector.detectActionIntent(input, { source: 'evaluation', workspaceId: 'default', userId: 'eval-user' }, services);
  const decision = decisionDetector.shouldTriggerDecisionSystem(input, route, {}, {}, services);
  const delegation = delegationEngine.shouldTriggerDelegation(input, { workspaceId: 'default', userId: 'eval-user' }, route, {}, {}, services);
  let proposalDryRun = null;
  if (action.hasActionIntent && testCase.dryRun !== false) {
    proposalDryRun = await bridge.createActionPlanFromText(input, {
      workspaceId: 'default',
      userId: 'eval-user',
      source: 'dashboard',
      createdByAgentId: 'executor'
    }, services);
  }
  const outputText = [
    route.finalAnswer || '',
    action.actionType,
    proposalDryRun?.plan?.title || ''
  ].join('\n');
  const result = {
    ok: true,
    id: utils.createId('eval_result'),
    case: testCase,
    input,
    selectedAgents: route.selectedAgents || [],
    riskLevel: action.hasActionIntent ? action.riskLevel : (route.risk?.level || 'low'),
    approvalRequired: Boolean(action.requiresApproval || proposalDryRun?.plan?.approvalRequired),
    actionType: action.actionType || '',
    decisionTriggered: Boolean(decision.needed),
    delegationTriggered: Boolean(delegation.needed),
    outputText: utils.sanitizeDelegationText(outputText, { max: 1200 }),
    proposalDryRun: proposalDryRun?.ok ? {
      planId: proposalDryRun.plan.id,
      actionCount: proposalDryRun.plan.actions.length,
      status: proposalDryRun.plan.status
    } : null,
    createdAt: utils.nowIso()
  };
  result.score = scorer.scoreEvaluationResult(result, testCase.scoringRubric || {});
  return result;
}

async function runEvaluationSuite(filters = {}, services = {}) {
  const selected = await listEvaluationCases(filters, services);
  const results = [];
  for (const testCase of selected.slice(0, filters.limit || 30)) {
    results.push(await runEvaluationCase(testCase, services));
  }
  const summary = scorer.summarizeEvaluationSuite(results);
  const run = await saveEvaluationRun({ filters, results, summary }, services);
  return { ok: true, run, results, summary };
}

async function saveEvaluationRun(payload = {}, services = {}) {
  const runs = await utils.safeRead(AGENT_EVALUATION_RUNS_KEY, [], services);
  const run = utils.sanitizeDelegationPayload({
    id: payload.id || utils.createId('eval_run'),
    filters: payload.filters || {},
    results: payload.results || [],
    summary: payload.summary || scorer.summarizeEvaluationSuite(payload.results || []),
    createdAt: utils.nowIso()
  });
  const next = Array.isArray(runs) ? runs.concat(run).slice(-200) : [run];
  await utils.safeWrite(AGENT_EVALUATION_RUNS_KEY, next, services);
  await utils.auditDelegation('agent_evaluation/run', {
    targetType: 'agent_evaluation_run',
    id: run.id,
    workspaceId: services.workspaceId || 'default',
    userId: services.userId || '',
    summary: run.summary
  }, services);
  return run;
}

async function listEvaluationRuns(filters = {}, services = {}) {
  const runs = await utils.safeRead(AGENT_EVALUATION_RUNS_KEY, [], services);
  const limit = Math.min(Number(filters.limit || 20), 100);
  return (Array.isArray(runs) ? runs : [])
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

async function getLatestEvaluationRun(services = {}) {
  const runs = await listEvaluationRuns({ limit: 1 }, services);
  return runs[0] || null;
}

module.exports = {
  AGENT_EVALUATION_CASES_KEY,
  AGENT_EVALUATION_RUNS_KEY,
  getEvaluationCase,
  getLatestEvaluationRun,
  listEvaluationCases,
  listEvaluationRuns,
  runEvaluationCase,
  runEvaluationSuite,
  saveEvaluationRun,
  scoreEvaluationResult: scorer.scoreEvaluationResult,
  summarizeEvaluationSuite: scorer.summarizeEvaluationSuite
};
