'use strict';

const store = require('../src/operator/project-operator-store');
const analyzer = require('../src/operator/project-goal-analyzer');
const planner = require('../src/operator/operator-planner');
const breakdown = require('../src/operator/operator-task-breakdown');
const guard = require('../src/operator/operator-cost-guard');
const gate = require('../src/operator/operator-evaluation-gate');
const bridge = require('../src/operator/operator-proposal-bridge');
const tracker = require('../src/operator/operator-progress-tracker');
const engine = require('../src/operator/operator-decision-engine');
const report = require('../src/operator/operator-report-generator');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }

console.log('test-operator-dashboard-api');

store.deleteAll();

const goalR = analyzer.analyzeProjectGoal({ title: 'Dashboard API test project', description: 'Full flow test' });
assert(goalR.goal !== null, 'goal created');
const goalId = goalR.goal.id;

const planR = planner.createOperatorPlan(goalId);
assert(planR.ok === true, 'plan created');

const tasksR = breakdown.breakPlanIntoTasks(planR.plan.id);
assert(tasksR.ok === true, 'tasks created');
assert(tasksR.tasks.length > 0, 'tasks non-empty');

const firstTask = tasksR.tasks[0];
store.updateTask(firstTask.id, { status: 'done' });
const progress = tracker.calculateProgress(goalId);
assert(progress.percent > 0, 'progress > 0');

const decision = engine.recommendNextOperatorAction(goalId);
assert(decision.recommendations.length > 0, 'has recommendations');

const costEst = guard.estimateOperatorPlanCost(planR.plan);
assert(costEst.known === true, 'cost estimated');

const evalR = gate.runOperatorEvaluationGate(firstTask);
assert(evalR.ok === true, 'evaluation passes');

const actionPlan = bridge.createOperatorActionPlan(firstTask);
assert(actionPlan.ok === true, 'action plan created');

const proposal = bridge.createOperatorExecutorProposal(actionPlan.actionPlan);
assert(proposal.ok === true, 'executor proposal created');

const projectReport = report.generateProjectStatusReport(goalId);
assert(projectReport.goal.id === goalId, 'report generated');

const daily = report.generateDailyOperatorReport('default');
assert(daily.report.length > 0, 'daily report');

const release = report.generateReleaseReadinessReport(goalId);
assert(release.ready !== undefined, 'release readiness');

const next = report.generateNextAgentReport(goalId);
assert(next.agent !== undefined, 'next agent');

const exec = report.generateExecutiveSummary(goalId);
assert(exec.includes(goalR.goal.title), 'executive summary');

const goals = store.listGoals({ workspaceId: 'default' });
assert(goals.length > 0, 'goals listed');

store.deleteAll();
bridge.clearProposals();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
