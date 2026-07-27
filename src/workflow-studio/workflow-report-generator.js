'use strict';

const store = require('./workflow-store');
const runHistory = require('./workflow-run-history');
const utils = require('./workflow-utils');

function generateReport(workflowId, options) {
  const workflow = store.getWorkflow(workflowId);
  if (!workflow) return { ok: false, error: 'Workflow not found' };

  const format = (options && options.format) || 'summary';
  const stats = runHistory.getRunHistory(workflowId, 100);
  const statsResult = runHistory.getRunStats(workflowId);

  let report;
  switch (format) {
    case 'detailed':
      report = generateDetailedReport(workflow, stats, statsResult, options);
      break;
    case 'scorecard':
      report = generateScorecard(workflow, stats, statsResult);
      break;
    case 'incident_report':
      report = generateIncidentReport(workflow, stats, statsResult, options);
      break;
    case 'regression_checklist':
      report = generateRegressionChecklist(workflow, stats, statsResult);
      break;
    default:
      report = generateSummaryReport(workflow, stats, statsResult);
  }

  return { ok: true, report };
}

function generateSummaryReport(workflow, runs, stats) {
  return {
    type: 'summary',
    workflowId: workflow.id,
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    riskLevel: workflow.riskLevel,
    stepCount: (workflow.steps || []).length,
    stats: {
      totalRuns: stats.totalRuns,
      successRate: stats.successRate,
      avgDuration: stats.avgDuration
    },
    recentRuns: runs.slice(-5).map(r => ({
      status: r.status,
      timestamp: r.timestamp,
      duration: r.duration
    })),
    generatedAt: new Date().toISOString()
  };
}

function generateDetailedReport(workflow, runs, stats, options) {
  return {
    type: 'detailed',
    workflowId: workflow.id,
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    riskLevel: workflow.riskLevel,
    trigger: workflow.trigger,
    steps: (workflow.steps || []).map(s => ({
      id: s.id,
      type: s.type,
      name: s.name,
      source: s.source,
      target: s.target
    })),
    approvalMap: workflow.approvalMap,
    evaluationRequired: workflow.evaluationRequired,
    dryRunRequired: workflow.dryRunRequired,
    ownerOnly: workflow.ownerOnly,
    maxRunsPerDay: workflow.maxRunsPerDay,
    quietHours: workflow.quietHours,
    stats: {
      totalRuns: stats.totalRuns,
      successRate: stats.successRate,
      avgDuration: stats.avgDuration,
      lastRun: stats.lastRun
    },
    allRuns: runs.map(r => ({
      id: r.id,
      status: r.status,
      timestamp: r.timestamp,
      duration: r.duration,
      stepsCompleted: r.stepsCompleted,
      error: r.error
    })),
    generatedAt: new Date().toISOString()
  };
}

function generateScorecard(workflow, runs, stats) {
  const steps = workflow.steps || [];
  const writeSteps = steps.filter(s => ['external_write', 'internal_write', 'device_action'].includes(s.type));
  const riskScore = { low: 1, medium: 2, high: 3, critical: 4 };
  const riskPoints = riskScore[workflow.riskLevel] || 0;

  return {
    type: 'scorecard',
    workflowId: workflow.id,
    name: workflow.name,
    scores: {
      safety: Math.max(0, 100 - (writeSteps.length * 20) - (riskPoints * 15)),
      reliability: stats.successRate || 0,
      governance: workflow.evaluationRequired && workflow.dryRunRequired ? 100 : workflow.evaluationRequired ? 70 : workflow.dryRunRequired ? 70 : 40,
      efficiency: stats.avgDuration > 0 ? Math.max(0, 100 - Math.min(50, stats.avgDuration / 1000)) : 50
    },
    riskLevel: workflow.riskLevel,
    totalRuns: stats.totalRuns,
    generatedAt: new Date().toISOString()
  };
}

function generateIncidentReport(workflow, runs, stats, options) {
  const failedRuns = runs.filter(r => r.status === 'failed');
  return {
    type: 'incident_report',
    workflowId: workflow.id,
    name: workflow.name,
    status: workflow.status,
    incidentTime: (options && options.incidentTime) || new Date().toISOString(),
    failedRuns: failedRuns.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      error: r.error,
      duration: r.duration
    })),
    totalFailures: failedRuns.length,
    recentSuccessRate: stats.successRate,
    generatedAt: new Date().toISOString()
  };
}

function generateRegressionChecklist(workflow, runs, stats) {
  const steps = workflow.steps || [];
  return {
    type: 'regression_checklist',
    workflowId: workflow.id,
    name: workflow.name,
    checks: [
      { id: 'boot', name: 'Boot Sequence', status: 'pending' },
      { id: 'dashboard', name: 'Dashboard Tabs', status: 'pending' },
      { id: 'telegram', name: 'Telegram Commands', status: 'pending' },
      { id: 'security', name: 'Security Boundaries', status: 'pending' },
      { id: 'privacy', name: 'Privacy Controls', status: 'pending' },
      { id: 'approval', name: 'Approval Gates', status: workflow.approvalMap && workflow.approvalMap.gates ? 'checked' : 'pending' }
    ],
    totalChecks: 6,
    pendingChecks: 5,
    generatedAt: new Date().toISOString()
  };
}

function generateHealthReport(workflowId) {
  const workflow = store.getWorkflow(workflowId);
  if (!workflow) return { ok: false, error: 'Workflow not found' };
  const stats = runHistory.getRunStats(workflowId);
  return {
    ok: true,
    health: {
      workflowId,
      name: workflow.name,
      status: workflow.status,
      riskLevel: workflow.riskLevel,
      totalRuns: stats.totalRuns,
      successRate: stats.successRate,
      avgDuration: stats.avgDuration,
      lastRunAt: workflow.lastRunAt,
      healthy: stats.successRate >= 80 && workflow.status !== 'failed'
    }
  };
}

module.exports = { generateReport, generateHealthReport };
