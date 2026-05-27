'use strict';

const healthMonitor = require('./health-monitor');
const telemetryCollector = require('./telemetry-collector');
const benchmarkEngine = require('./benchmark-engine');
const diagnosticsEngine = require('./diagnostics-engine');
const incidentHandler = require('./incident-handler');
const recoveryController = require('./recovery-controller');
const tuningController = require('./tuning-controller');
const regressionDetector = require('./regression-detector');
const opsKnowledgeBase = require('./ops-knowledge-base');
const adaptiveOps = require('./adaptive-ops');
const guards = require('./ops-guards');

function runOperationalWorkflow(services = {}, options = {}) {
  const start = Date.now();
  const trigger = options.trigger || 'manual';
  const health = healthMonitor.getHealth(services);
  const telemetry = telemetryCollector.getTelemetrySummary(services);
  const benchmark = options.runBenchmark
    ? benchmarkEngine.runBenchmarkSuite(options.benchmarkType || null, services, { full: Boolean(options.fullBenchmark) })
    : null;
  const diagnosis = diagnosticsEngine.diagnose(services, { health, telemetry });
  const incident = incidentHandler.detectIncident(services, { health, diagnosis });
  const recovery = recoveryController.getRecoveryRecommendation(services);
  const tuning = tuningController.recommendTuning(services);
  const regression = options.checkRegression
    ? regressionDetector.detectRegression(services)
    : { regressionDetected: false, severity: 'none' };
  const adaptive = adaptiveOps.usageAwareOptimization(services);
  const prioritizedFixes = adaptiveOps.prioritizeFixes(diagnosis, regression);

  if (incident.detected && incident.incident?.severity !== 'info') {
    adaptiveOps.learnIncidentPattern(incident.incident, services);
    opsKnowledgeBase.addOpsLesson({
      title: `Incident ${incident.incident.id}`,
      content: `${incident.incident.title}: ${incident.incident.suspectedCause}`,
      tags: ['incident', incident.incident.severity]
    }, services);
  }

  return {
    id: `opsflow_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    trigger,
    adaptive: true,
    steps: [
      'health_check',
      'telemetry_collection',
      benchmark ? 'benchmark_evaluation' : 'benchmark_skipped',
      'diagnostic_analysis',
      'incident_classification',
      'recovery_decision',
      'tuning_recommendation',
      options.confirmedAction ? 'safe_execution' : 'safe_execution_skipped',
      options.checkRegression ? 'regression_check' : 'regression_skipped',
      'persistence_update',
      'operational_learning'
    ],
    health,
    telemetry,
    benchmark,
    diagnosis,
    incident,
    recovery,
    tuning,
    regression,
    adaptive,
    prioritizedFixes,
    latencyMs: Date.now() - start,
    createdAt: guards.nowIso()
  };
}

module.exports = {
  runOperationalWorkflow
};
