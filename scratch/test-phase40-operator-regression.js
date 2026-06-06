'use strict';

let passed = 0, failed = 0, skipped = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
function skip(n) { skipped++; console.log('  SKIPPED:', n); }
console.log('test-phase40-operator-regression');

function runSuite() {
  let store;
  try {
    store = require('../src/operator/project-operator-store');
    assert(typeof store.createGoal === 'function', 'store.createGoal');
    assert(typeof store.getGoal === 'function', 'store.getGoal');
    assert(typeof store.listGoals === 'function', 'store.listGoals');
    assert(typeof store.createPlan === 'function', 'store.createPlan');
    assert(typeof store.createTask === 'function', 'store.createTask');
  } catch (e) { failed++; console.log('  FAIL: store require:', e.message); return; }

  try {
    store.deleteAll();
    const g = store.createGoal({ title: 'Regression' });
    assert(g.id !== undefined, 'goal created');
    assert(g.status === 'idea', 'default status idea');
    const p = store.createPlan({ goalId: g.id, title: 'Plan' });
    assert(p.id !== undefined, 'plan created');
    const t = store.createTask({ goalId: g.id, planId: p.id, title: 'Task' });
    assert(t.id !== undefined, 'task created');
    const listed = store.listGoals({});
    assert(listed.length > 0, 'listGoals non-empty');
    const updated = store.updateGoal(g.id, { status: 'in_progress' });
    assert(updated.status === 'in_progress', 'updateGoal');
    const got = store.getGoal(g.id);
    assert(got.status === 'in_progress', 'getGoal after update');
  } catch (e) { failed++; console.log('  FAIL: store ops:', e.message); }

  try {
    const analyzer = require('../src/operator/project-goal-analyzer');
    store.deleteAll();
    const r = analyzer.analyzeProjectGoal({ title: 'Test goal for regression' });
    assert(r.goal !== null, 'analyzer creates goal');
    const classified = analyzer.classifyProjectGoal('coding feature api');
    assert(classified === 'coding', 'classify coding');
    const risk = analyzer.detectGoalRisk({ title: 'push and deploy' });
    assert(risk.level === 'high', 'high risk detection');
  } catch (e) { failed++; console.log('  FAIL: analyzer:', e.message); }

  try {
    const planner = require('../src/operator/operator-planner');
    store.deleteAll();
    const goal = store.createGoal({ title: 'Plan test' });
    const r = planner.createOperatorPlan(goal.id);
    assert(r.ok === true, 'planner creates plan');
    assert(r.plan.phases.length > 0, 'plan has phases');
    const sprint = planner.createSprintPlan(goal, {});
    assert(sprint.ok === true, 'sprint created');
  } catch (e) { failed++; console.log('  FAIL: planner:', e.message); }

  try {
    const breakdown = require('../src/operator/operator-task-breakdown');
    store.deleteAll();
    const goal = store.createGoal({ title: 'Task test' });
    const planR = require('../src/operator/operator-planner').createOperatorPlan(goal.id);
    const r = breakdown.breakPlanIntoTasks(planR.plan.id);
    assert(r.ok === true, 'breakdown tasks');
    assert(r.tasks.length > 0, 'tasks created');
    const blocked = breakdown.detectBlockedTasks({});
    assert(Array.isArray(blocked), 'blocked tasks');
  } catch (e) { failed++; console.log('  FAIL: breakdown:', e.message); }

  try {
    const coord = require('../src/operator/operator-agent-coordinator');
    const r = coord.selectAgentsForOperatorTask({ id: 't', title: 'Test', type: 'coding', riskLevel: 'medium', requiresApproval: true });
    assert(r.length > 0, 'agents selected');
    assert(r.some(a => a.role === 'coder'), 'coder agent included');
    const syn = coord.synthesizeAgentResult({ id: 't', title: 'Test', type: 'coding', riskLevel: 'medium' });
    assert(syn.synthesizedBy === 'orchestrator', 'synthesized');
  } catch (e) { failed++; console.log('  FAIL: coordinator:', e.message); }

  try {
    const tracker = require('../src/operator/operator-progress-tracker');
    store.deleteAll();
    const goal = store.createGoal({ title: 'Progress' });
    const r = tracker.calculateProgress(goal.id);
    assert(r.percent === 0, 'initial progress 0');
    assert(r.status === 'idea', 'status idea');
  } catch (e) { failed++; console.log('  FAIL: tracker:', e.message); }

  try {
    const engine = require('../src/operator/operator-decision-engine');
    store.deleteAll();
    const r = engine.recommendNextOperatorAction('nonexistent');
    assert(r.ok === false, 'no goal recommendation');
    const goal = store.createGoal({ title: 'Decision' });
    store.updateGoal(goal.id, { status: 'idea' });
    const r2 = engine.recommendNextOperatorAction(goal.id);
    assert(r2.topRecommendation.action === 'analyze_goal', 'recommends analyze');
  } catch (e) { failed++; console.log('  FAIL: decision engine:', e.message); }

  try {
    const risk = require('../src/operator/operator-risk-review');
    const r = risk.reviewOperatorPlanRisk(null);
    assert(r.ok === false, 'safe low risk');
    // Don't test more here - needs plan in store
  } catch (e) { failed++; console.log('  FAIL: risk review:', e.message); }

  try {
    const guard = require('../src/operator/operator-cost-guard');
    const r = guard.runOperatorBudgetGuard({ phases: [{ name: 'A' }], milestones: [{ name: 'M' }] });
    assert(r.allowed === true, 'cost guard allows');
  } catch (e) { failed++; console.log('  FAIL: cost guard:', e.message); }

  try {
    const gate = require('../src/operator/operator-evaluation-gate');
    const safe = gate.runOperatorEvaluationGate({ id: 't', title: 'Safe', type: 'planning', riskLevel: 'low', requiresApproval: true });
    assert(safe.ok === true, 'safe eval passes');
    const danger = gate.runOperatorEvaluationGate({ id: 't', title: 'Git push', type: 'deployment', riskLevel: 'high', requiresApproval: false });
    assert(danger.ok === false, 'danger eval fails');
  } catch (e) { failed++; console.log('  FAIL: eval gate:', e.message); }

  try {
    const bridge = require('../src/operator/operator-proposal-bridge');
    const r = bridge.createOperatorActionPlan({ id: 't', title: 'Test', type: 'coding' });
    assert(r.ok === true, 'action plan');
    const p = bridge.createOperatorExecutorProposal(r.actionPlan);
    assert(p.ok === true, 'proposal');
    bridge.clearProposals();
  } catch (e) { failed++; console.log('  FAIL: proposal bridge:', e.message); }

  try {
    const report = require('../src/operator/operator-report-generator');
    store.deleteAll();
    const goal = store.createGoal({ title: 'Report test' });
    const r = report.generateProjectStatusReport(goal.id);
    assert(r.goal !== undefined, 'project report');
    const d = report.generateDailyOperatorReport('default');
    assert(d.report.length > 0, 'daily report');
  } catch (e) { failed++; console.log('  FAIL: report:', e.message); }

  try {
    const utils = require('../src/operator/operator-utils');
    assert(utils.formatGoalStatus('shipped') === '🚀 Shipped', 'formatGoalStatus');
    assert(utils.formatPriority('high') === '🔴 High', 'formatPriority');
    assert(utils.formatRiskLevel('medium') === '🟡 Medium', 'formatRiskLevel');
    const sanitized = utils.sanitizeForReport({ token: 'sk-test123', data: 'hello' });
    assert(sanitized.token === '[REDACTED]', 'sanitize token');
  } catch (e) { failed++; console.log('  FAIL: utils:', e.message); }

  try {
    const index = require('../src/operator/index');
    assert(index.projectOperatorStore !== undefined, 'index store');
    assert(index.projectGoalAnalyzer !== undefined, 'index analyzer');
    assert(index.operatorPlanner !== undefined, 'index planner');
    assert(index.operatorTaskBreakdown !== undefined, 'index breakdown');
    assert(index.operatorAgentCoordinator !== undefined, 'index coordinator');
    assert(index.operatorProgressTracker !== undefined, 'index tracker');
    assert(index.operatorDecisionEngine !== undefined, 'index decision');
    assert(index.operatorRiskReview !== undefined, 'index risk');
    assert(index.operatorCostGuard !== undefined, 'index cost');
    assert(index.operatorEvaluationGate !== undefined, 'index eval');
    assert(index.operatorProposalBridge !== undefined, 'index bridge');
    assert(index.operatorReportGenerator !== undefined, 'index report');
    assert(index.operatorUtils !== undefined, 'index utils');
  } catch (e) { failed++; console.log('  FAIL: index:', e.message); }

  try {
    const routes = require('../src/dashboard/operator-routes');
    assert(typeof routes.registerOperatorRoutes === 'function', 'operator routes');
  } catch (e) { failed++; console.log('  FAIL: routes:', e.message); }

  if (store) store.deleteAll();
  bridge = require('../src/operator/operator-proposal-bridge');
  bridge.clearProposals();
}

let bridge;
runSuite();
console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed > 0 ? 1 : 0);
