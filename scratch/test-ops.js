'use strict';

const assert = require('assert');
const opsSystem = require('../src/ops');

const memory = {};
const services = {
  ensureUser(userId) {
    const id = String(userId);
    if (!memory[id]) memory[id] = {};
    return memory[id];
  },
  persist() {
    return Promise.resolve();
  },
  env: {
    MISTRAL_API_KEY: 'test',
    GROQ_API_KEY: ''
  },
  aiCircuitBreaker: {
    status() {
      return { open: false, failures: 0 };
    }
  },
  getRuntimeStatus() {
    return {
      queue: {
        activeCount: 0,
        queuedCount: 0,
        maxQueueSize: 30,
        maxConcurrency: 2
      }
    };
  },
  aiOS: {
    getStatus() {
      return {
        totalMemory: 12,
        graphNodes: 4,
        graphEdges: 3,
        staleGoals: 0,
        staleWorkflows: 1,
        activeWorkflows: 2,
        workflowCompletionRatio: 0.5,
        workflowConflicts: 0
      };
    }
  }
};

opsSystem.telemetry.recordRequest({ hasText: true }, services);
opsSystem.telemetry.recordCommand('/ops', '123', services);
opsSystem.telemetry.recordAIUsage({
  provider: 'mistral',
  model: 'mistral',
  promptTokens: 120,
  completionTokens: 80,
  latencyMs: 240,
  success: true
}, services);

const status = opsSystem.getStatus(services);
assert(status.health.status === 'healthy' || status.health.status === 'degraded');
assert(status.telemetry.counters.request >= 1);
assert(status.reliability.score >= 0);

const bench = opsSystem.benchmarkEngine.runBenchmarkSuite(null, services);
assert(bench.caseCount > 0);
assert(bench.score > 0);
assert(bench.results[0].status);
assert(bench.results[0].createdAt);

const fullBench = opsSystem.benchmarkEngine.runBenchmarkSuite(null, services, { full: true });
assert(fullBench.caseCount >= bench.caseCount);

const regression = opsSystem.regressionDetector.detectRegression(services);
assert(typeof regression.regressionDetected === 'boolean');

const diagnosis = opsSystem.diagnosticsEngine.diagnose(services);
assert(diagnosis.category);
assert(diagnosis.safeNextAction);

const recovery = opsSystem.recoveryController.getRecoveryRecommendation(services);
assert(recovery.plan.recommendedAction.action);

const plan = opsSystem.rollbackManager.createRollbackPlan('test rollback plan', services);
assert(plan.checklist.length > 0);

const canary = opsSystem.canaryController.createCanary('test canary', { rolloutPercent: 5 }, services);
assert(canary.status === 'draft');
opsSystem.canaryController.recordCanaryMetric(canary.id, { name: 'quality', value: 0.8 }, services);
opsSystem.canaryController.recordCanaryMetric(canary.id, { name: 'latency', value: 0.76 }, services);
opsSystem.canaryController.recordCanaryMetric(canary.id, { name: 'safety', value: 0.82 }, services);
const canaryComparison = opsSystem.canaryController.compareCanary(canary.id, services);
assert(canaryComparison.metricCount === 3);

const experiment = opsSystem.abTesting.createExperiment('test ab', ['control', 'variant'], services);
const assignment = opsSystem.abTesting.assignSample(experiment.id, '123', services);
assert(assignment.ok);
opsSystem.abTesting.recordMetric(experiment.id, assignment.variant, { name: 'score', value: 0.7 }, services);
const experimentComparison = opsSystem.abTesting.compareExperiment(experiment.id, services);
assert(experimentComparison.ok);

const resources = opsSystem.resourceAnalyzer.analyzeResources(services, '123');
assert(resources.memory.memoryCount === 12);

const adaptive = opsSystem.adaptiveOps.usageAwareOptimization(services);
assert(adaptive.thresholds.maxLatencyP90Ms);

const lesson = opsSystem.opsKnowledgeBase.addOpsLesson({
  title: 'Test lesson',
  content: 'Ops system menyimpan pelajaran ringkas.',
  tags: ['test']
}, services);
assert(lesson.id);

const workflow = opsSystem.opsWorkflow.runOperationalWorkflow(services, {
  trigger: 'test',
  runBenchmark: false,
  checkRegression: true
});
assert(workflow.steps.includes('health_check'));
assert(workflow.prioritizedFixes.length >= 0);

console.log('Ops system smoke test passed');
