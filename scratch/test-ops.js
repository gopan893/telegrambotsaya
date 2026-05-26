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

const regression = opsSystem.regressionDetector.detectRegression(services);
assert(typeof regression.regressionDetected === 'boolean');

const plan = opsSystem.rollbackManager.createRollbackPlan('test rollback plan', services);
assert(plan.checklist.length > 0);

const canary = opsSystem.canaryController.createCanary('test canary', { rolloutPercent: 5 }, services);
assert(canary.status === 'draft');

const lesson = opsSystem.opsKnowledgeBase.addOpsLesson({
  title: 'Test lesson',
  content: 'Ops system menyimpan pelajaran ringkas.',
  tags: ['test']
}, services);
assert(lesson.id);

console.log('Ops system smoke test passed');
