'use strict';

const registry = require('./regression-guard-registry');
const utils = require('./selfhealing-utils');
const dashboardGuard = require('./dashboard-route-guard');
const naturalChatGuard = require('./natural-chat-guard');
const executorGuard = require('./executor-safety-guard');
const integrationGuard = require('./integration-gate-guard');
const codingGuard = require('./coding-workspace-guard');

function createHealthCheckSuite(store, services) {
  async function runGuard(guard, ctx) {
    const start = Date.now();
    try {
      let result;
      switch (guard.checkType) {
        case 'boot':
          result = await runBootGuard(ctx);
          break;
        case 'dashboard':
          result = await dashboardGuard.runDashboardGuardCheck(guard, ctx, services);
          break;
        case 'natural_chat':
          result = await naturalChatGuard.runNaturalChatGuardCheck(guard, ctx, services);
          break;
        case 'executor':
          result = await executorGuard.runExecutorGuardCheck(guard, ctx, services);
          break;
        case 'integration':
          result = await integrationGuard.runIntegrationGuardCheck(guard, ctx, services);
          break;
        case 'coding_workspace':
          result = await codingGuard.runCodingGuardCheck(guard, ctx, services);
          break;
        case 'storage':
          result = await runStorageGuard(ctx);
          break;
        case 'evaluation':
          result = await runEvaluationGuard(ctx);
          break;
        default:
          result = { status: 'skipped', summary: 'No check handler for type: ' + guard.checkType };
      }
      const run = {
        id: utils.generateId('run'),
        guardId: guard.id,
        workspaceId: ctx.workspaceId || '',
        status: result.status || 'warning',
        severity: guard.severity,
        summary: result.summary || guard.failureMessage,
        details: result.details || '',
        repairPlanId: result.repairPlanId || '',
        duration: Date.now() - start,
        createdAt: utils.nowISO()
      };
      if (store) await store.saveRun(run);
      return run;
    } catch (err) {
      const run = {
        id: utils.generateId('run'),
        guardId: guard.id,
        workspaceId: ctx.workspaceId || '',
        status: 'failed',
        severity: guard.severity,
        summary: 'Guard check threw: ' + err.message,
        details: err.stack || '',
        repairPlanId: '',
        duration: Date.now() - start,
        createdAt: utils.nowISO()
      };
      if (store) await store.saveRun(run);
      return run;
    }
  }

  async function runBootGuard(ctx) {
    const details = [];
    let allOk = true;
    try {
      require('../dashboard/index');
      details.push('dashboard/index.js loaded');
    } catch (e) {
      allOk = false;
      details.push('dashboard/index.js FAILED: ' + e.message);
    }
    try {
      require('../agents/index');
      details.push('agents/index.js loaded');
    } catch (e) {
      allOk = false;
      details.push('agents/index.js FAILED: ' + e.message);
    }
    if (services.evaluationSystem) {
      try {
        services.evaluationSystem.getCases();
        details.push('Evaluation v2 available');
      } catch (e) {
        details.push('Evaluation v2 error: ' + e.message);
      }
    } else {
      details.push('Evaluation v2 not loaded (warning)');
    }
    return {
      status: allOk ? 'passed' : 'failed',
      summary: allOk ? 'All boot modules loaded' : 'Some modules failed to load',
      details: details.join('\n')
    };
  }

  async function runStorageGuard(ctx) {
    if (!services.storageManager) {
      return { status: 'warning', summary: 'Storage manager not available', details: '' };
    }
    try {
      const health = await services.storageManager.getStorageHealth();
      const redisOk = health?.redis?.available;
      return {
        status: redisOk ? 'passed' : 'failed',
        summary: redisOk ? 'Redis connected' : 'Redis disconnected',
        details: JSON.stringify(utils.sanitizeOutput(health || {}))
      };
    } catch (e) {
      return { status: 'failed', summary: 'Storage health check error: ' + e.message, details: '' };
    }
  }

  async function runEvaluationGuard(ctx) {
    if (!services.evaluationSystem) {
      return { status: 'warning', summary: 'Evaluation Harness v2 not loaded', details: '' };
    }
    try {
      const cases = services.evaluationSystem.getCases();
      return {
        status: 'passed',
        summary: 'Evaluation Harness v2 loaded with ' + (cases?.length || 0) + ' cases',
        details: ''
      };
    } catch (e) {
      return { status: 'failed', summary: 'Evaluation Harness error: ' + e.message, details: '' };
    }
  }

  async function runHealthCheckSuite(filters, ctx) {
    ctx = ctx || { workspaceId: '' };
    const guards = await store.getGuards();
    let filtered = guards;
    if (filters) {
      if (filters.category) filtered = filtered.filter(g => g.category === filters.category);
      if (filters.severity) filtered = filtered.filter(g => g.severity === filters.severity);
      if (filters.enabled !== undefined) filtered = filtered.filter(g => g.enabled === filters.enabled);
      if (filters.ids) filtered = filtered.filter(g => filters.ids.includes(g.id));
    }
    if (filtered.length === 0) {
      return { summary: 'No guards matched filters', results: [] };
    }
    const results = [];
    for (const guard of filtered) {
      if (!guard.enabled) {
        results.push({
          id: utils.generateId('run'),
          guardId: guard.id,
          workspaceId: ctx.workspaceId || '',
          status: 'skipped',
          severity: guard.severity,
          summary: 'Guard disabled',
          details: '',
          repairPlanId: '',
          createdAt: utils.nowISO()
        });
        continue;
      }
      const result = await runGuard(guard, ctx);
      results.push(result);
    }
    return { summary: summarizeHealthSuite(results), results };
  }

  function summarizeHealthSuite(results) {
    if (!results || results.length === 0) return 'No results';
    const total = results.length;
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const warning = results.filter(r => r.status === 'warning').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    return total + ' guards: ' + passed + ' passed, ' + failed + ' failed, ' + warning + ' warning, ' + skipped + ' skipped';
  }

  return {
    runGuard,
    runBootGuard,
    runStorageGuard,
    runEvaluationGuard,
    runHealthCheckSuite,
    summarizeHealthSuite
  };
}

module.exports = { createHealthCheckSuite };
