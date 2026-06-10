'use strict';

const store = require('./v2-planning-store');
const gate = require('./v2-planning-gate');
const scopeManager = require('./v2-scope-manager');
const principles = require('./v2-architecture-principles');
const migrationPlanner = require('./v2-migration-planner');
const riskRegister = require('./v2-risk-register');
const decisionLog = require('./v2-decision-log');
const acceptanceCriteria = require('./v2-acceptance-criteria');
const roadmapBuilder = require('./v2-roadmap-builder');
const utils = require('./v2-planning-utils');

async function generateV2PlanningReport(services) {
  const gateResult = await gate.runV2PlanningGate(services);
  const scope = await scopeManager.defineV2Scope(services);
  const scopeReport = await scopeManager.buildV2ScopeReport(scope.data, services);
  const principlesReport = await principles.buildPrinciplesReport(services);
  const migrationPlan = await migrationPlanner.createV2MigrationPlan(services);
  const riskReport = await riskRegister.buildV2RiskReport(services);
  const decisions = await decisionLog.summarizeV2Decisions(services);
  const criteria = await acceptanceCriteria.defineV2AcceptanceCriteria(services);
  const roadmap = await roadmapBuilder.buildRoadmapReport(services);

  const scores = [gateResult.score, scopeReport.score, principlesReport.score, migrationPlan.score, riskReport.score, roadmap.score, criteria.score];
  const overallScore = scores.length ? Math.round(scores.reduce((a, c) => a + c, 0) / scores.length) : 0;

  return {
    summary: {
      status: gateResult.passed ? 'planning_ready' : 'blocked',
      overallScore,
      gateStatus: gateResult.status,
      totalScopeItems: scope.count,
      totalPhases: roadmap.data.totalPhases,
      totalEstimatedWeeks: roadmap.data.totalEstimatedWeeks,
      totalRisks: riskReport.data.total,
      totalAcceptanceCriteria: criteria.count,
      totalDecisions: decisions.data.total
    },
    gate: gateResult,
    scope: scopeReport.data,
    principles: principlesReport.data,
    migrationPlan: migrationPlan.data,
    risks: riskReport.data,
    decisions: decisions.data,
    acceptanceCriteria: criteria.data,
    roadmap: roadmap.data,
    timestamp: new Date().toISOString()
  };
}

module.exports = { generateV2PlanningReport };
