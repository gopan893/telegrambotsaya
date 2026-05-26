'use strict';

function safeRequire(name) {
  try {
    return require(`./${name}`);
  } catch (err) {
    return {
      unavailable: true,
      error: err.message
    };
  }
}

const opsStore = safeRequire('ops-store');
const opsGuards = safeRequire('ops-guards');
const healthMonitor = safeRequire('health-monitor');
const telemetryCollector = safeRequire('telemetry-collector');
const diagnosticsEngine = safeRequire('diagnostics-engine');
const benchmarkEngine = safeRequire('benchmark-engine');
const benchmarkCases = safeRequire('benchmark-cases');
const incidentHandler = safeRequire('incident-handler');
const recoveryController = safeRequire('recovery-controller');
const performanceProfiler = safeRequire('performance-profiler');
const costOptimizer = safeRequire('cost-optimizer');
const tokenAnalyzer = safeRequire('token-analyzer');
const reliabilityScorer = safeRequire('reliability-scorer');
const regressionDetector = safeRequire('regression-detector');
const rollbackManager = safeRequire('rollback-manager');
const tuningController = safeRequire('tuning-controller');
const canaryController = safeRequire('canary-controller');
const evaluationScheduler = safeRequire('evaluation-scheduler');
const opsKnowledgeBase = safeRequire('ops-knowledge-base');

function createOpsSystem() {
  return {
    opsStore,
    opsGuards,
    healthMonitor,
    telemetry: telemetryCollector,
    telemetryCollector,
    diagnosticsEngine,
    benchmarkEngine,
    benchmarkCases,
    incidentHandler,
    recoveryController,
    performanceProfiler,
    costOptimizer,
    tokenAnalyzer,
    reliabilityScorer,
    regressionDetector,
    rollbackManager,
    tuningController,
    canaryController,
    evaluationScheduler,
    opsKnowledgeBase,
    getStatus(services = {}) {
      const health = healthMonitor.getHealth ? healthMonitor.getHealth(services) : { status: 'unknown', issues: [] };
      const telemetry = telemetryCollector.getTelemetrySummary ? telemetryCollector.getTelemetrySummary(services) : {};
      const reliability = reliabilityScorer.calculateReliabilityScore
        ? reliabilityScorer.calculateReliabilityScore(services, { health, telemetry })
        : { score: 0, status: 'unknown' };
      const diagnosis = diagnosticsEngine.diagnose
        ? diagnosticsEngine.diagnose(services, { health, telemetry })
        : { diagnosis: 'unknown', severity: 'warning' };
      return {
        health,
        telemetry,
        reliability,
        diagnosis,
        modules: [
          'HealthMonitor',
          'TelemetryCollector',
          'DiagnosticsEngine',
          'BenchmarkEngine',
          'IncidentHandler',
          'RecoveryController',
          'PerformanceProfiler',
          'CostOptimizer',
          'ReliabilityScorer',
          'RegressionDetector',
          'RollbackManager',
          'TuningController',
          'CanaryController',
          'EvaluationScheduler',
          'OpsKnowledgeBase'
        ]
      };
    }
  };
}

module.exports = createOpsSystem();
module.exports.createOpsSystem = createOpsSystem;
