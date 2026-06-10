'use strict';

const utils = require('./v2-planning-utils');

const RISK_CATEGORIES = [
  { id: 'dashboard-regression', name: 'Dashboard Regression', description: 'Dashboard tab or sidebar breaks after v2 changes', severity: 'critical', defaultMitigation: 'Run full dashboard regression test suite before deployment' },
  { id: 'api-route-mismatch', name: 'API Route Mismatch', description: 'API route contracts diverge between old and new modules', severity: 'high', defaultMitigation: 'Maintain API compatibility aliases and run contract tests' },
  { id: 'command-alias-breakage', name: 'Command Alias Breakage', description: 'Legacy command aliases stop working after cleanup', severity: 'high', defaultMitigation: 'Verify all command aliases preserved in migration plan' },
  { id: 'approval-bypass', name: 'Approval Bypass', description: 'Governance/approval boundary weakened during refactor', severity: 'critical', defaultMitigation: 'Audit approval paths after each migration phase' },
  { id: 'secret-leak', name: 'Secret Leak', description: 'Secret exposure via incomplete redaction in new modules', severity: 'critical', defaultMitigation: 'Run secret surface scanner after each deployment' },
  { id: 'optional-module-crash', name: 'Optional Module Crash', description: 'Optional module failure crashes core system', severity: 'high', defaultMitigation: 'Wrap optional module calls with try/catch and soft fallbacks' },
  { id: 'pwa-stale-cache', name: 'PWA Stale Cache', description: 'PWA serves stale dashboard API responses after migration', severity: 'medium', defaultMitigation: 'Update cache version and exclude /api/dashboard/* from cache' },
  { id: 'database-inconsistency', name: 'Database/Storage Inconsistency', description: 'Storage boundary refactor causes data inconsistency', severity: 'high', defaultMitigation: 'Run integration tests and data consistency checks' },
  { id: 'performance-regression', name: 'Performance Regression', description: 'v2 changes introduce performance degradation', severity: 'medium', defaultMitigation: 'Run performance baseline tests before and after migration' },
  { id: 'docs-drift', name: 'Docs Drift', description: 'Documentation falls out of sync with v2 changes', severity: 'medium', defaultMitigation: 'Mandate docs update alongside code changes' },
  { id: 'test-false-positive', name: 'Test False Positive', description: 'Tests pass but do not actually validate v2 changes', severity: 'medium', defaultMitigation: 'Review test coverage for each migration phase' }
];

async function createV2RiskRegister(services) {
  return { passed: true, data: RISK_CATEGORIES, count: RISK_CATEGORIES.length, score: 100 };
}

async function classifyV2Risk(risk, services) {
  if (!risk || !risk.id) return { passed: false, classification: 'unknown', score: 0 };
  const category = RISK_CATEGORIES.find(r => r.id === risk.id);
  if (!category) return { passed: false, classification: 'unregistered', score: 0 };
  return { passed: true, classification: category, score: 100 };
}

async function recommendRiskMitigation(risk, services) {
  if (!risk || !risk.id) return { passed: false, mitigation: null, score: 0 };
  const category = RISK_CATEGORIES.find(r => r.id === risk.id);
  if (!category) return { passed: false, mitigation: 'Unknown risk. Manual review required.', score: 0 };
  return { passed: true, mitigation: category.defaultMitigation, score: 100 };
}

async function buildV2RiskReport(services) {
  const register = await createV2RiskRegister(services);
  const bySeverity = { critical: [], high: [], medium: [] };
  for (const risk of register.data) {
    const s = risk.severity || 'medium';
    if (bySeverity[s]) bySeverity[s].push(risk);
  }
  const criticalCount = bySeverity.critical.length;
  const highCount = bySeverity.high.length;
  const mediumCount = bySeverity.medium.length;
  const total = register.count;
  const weightedScore = total ? Math.round(((criticalCount * 100) + (highCount * 80) + (mediumCount * 50)) / (total * 100) * 100) : 0;
  return {
    passed: true,
    data: {
      total,
      bySeverity: {
        critical: { count: criticalCount, risks: bySeverity.critical },
        high: { count: highCount, risks: bySeverity.high },
        medium: { count: mediumCount, risks: bySeverity.medium }
      },
      weightedScore
    },
    score: weightedScore
  };
}

module.exports = { createV2RiskRegister, classifyV2Risk, recommendRiskMitigation, buildV2RiskReport, RISK_CATEGORIES };
