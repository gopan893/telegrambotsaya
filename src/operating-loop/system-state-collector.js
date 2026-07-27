'use strict';

const { nowIso } = require('./operating-loop-utils');

function moduleUnavailable(reason) {
  return { ok: true, data: { status: 'unavailable', reason: reason || 'module not found' }, degraded: true };
}

async function collectAppHealth(services) {
  try {
    const mem = process.memoryUsage();
    return {
      ok: true,
      data: {
        uptime: process.uptime(),
        memory: {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
          external: mem.external
        },
        nodeVersion: process.version,
        pid: process.pid,
        platform: process.platform
      }
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectDashboardState(services) {
  try {
    const dashboard = services.dashboard;
    if (!dashboard || !dashboard.healthCheck) {
      return moduleUnavailable('module not found');
    }
    const health = await dashboard.healthCheck(services);
    return { ok: true, data: health };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectTelegramControlState(services) {
  try {
    let registry;
    try {
      registry = require('../telegram-control/telegram-command-registry');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const commands = typeof registry.listCommands === 'function' ? registry.listCommands() : [];
    let auditWarnings = [];
    try {
      const audit = require('../telegram-control/telegram-command-audit');
      if (typeof audit.getRecentWarnings === 'function') {
        auditWarnings = await audit.getRecentWarnings(services);
      }
    } catch (_) {}
    return {
      ok: true,
      data: {
        registeredCommands: commands.length,
        commands: commands.slice(0, 50),
        recentAuditWarnings: Array.isArray(auditWarnings) ? auditWarnings.slice(0, 20) : []
      }
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectExecutorState(services) {
  try {
    let executorStore;
    try {
      executorStore = require('../executor/execution-store');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const [pending, recentExecutions] = await Promise.allSettled([
      typeof executorStore.listProposals === 'function'
        ? executorStore.listProposals({ status: 'pending_approval' }, services)
        : Promise.resolve({ data: [] }),
      typeof executorStore.listExecutions === 'function'
        ? executorStore.listExecutions({}, services)
        : Promise.resolve({ data: [] })
    ]);
    return {
      ok: true,
      data: {
        pendingProposals: pending.status === 'fulfilled' ? (pending.value.data || []).length : 0,
        recentExecutions: recentExecutions.status === 'fulfilled' ? (recentExecutions.value.data || []).slice(0, 10) : []
      }
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectIntegrationState(services) {
  try {
    let integrations;
    try {
      integrations = require('../integrations');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const health = typeof integrations.healthCheck === 'function'
      ? await integrations.healthCheck(services)
      : { status: 'unknown' };
    return { ok: true, data: health };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectGitHubOpsState(services) {
  try {
    let githubOps;
    try {
      githubOps = require('../githubops');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const status = typeof githubOps.getStatus === 'function'
      ? await githubOps.getStatus(services)
      : { status: 'unknown' };
    return { ok: true, data: status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectDeployState(services) {
  try {
    let deploy;
    try {
      deploy = require('../deploy');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const readiness = typeof deploy.checkReadiness === 'function'
      ? await deploy.checkReadiness(services)
      : { status: 'unknown' };
    return { ok: true, data: readiness };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectObservabilityState(services) {
  try {
    let observability;
    try {
      observability = require('../observability');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const [incidents, alerts] = await Promise.allSettled([
      typeof observability.listOpenIncidents === 'function'
        ? observability.listOpenIncidents(services)
        : Promise.resolve({ data: [] }),
      typeof observability.listRecentAlerts === 'function'
        ? observability.listRecentAlerts(services)
        : Promise.resolve({ data: [] })
    ]);
    return {
      ok: true,
      data: {
        openIncidents: incidents.status === 'fulfilled' ? (incidents.value.data || []).length : 0,
        recentAlerts: alerts.status === 'fulfilled' ? (alerts.value.data || []).slice(0, 20) : []
      }
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectCostState(services) {
  try {
    let cost;
    try {
      cost = require('../cost');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const summary = typeof cost.getBudgetSummary === 'function'
      ? await cost.getBudgetSummary(services)
      : { status: 'unknown' };
    return { ok: true, data: summary };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectOperatorState(services) {
  try {
    let operator;
    try {
      operator = require('../operator');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const status = typeof operator.getOperatorStatus === 'function'
      ? await operator.getOperatorStatus(services)
      : { status: 'unknown' };
    return { ok: true, data: status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectPortfolioState(services) {
  try {
    let portfolio;
    try {
      portfolio = require('../portfolio');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const health = typeof portfolio.getProjectHealth === 'function'
      ? await portfolio.getProjectHealth(services)
      : { status: 'unknown' };
    return { ok: true, data: health };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectKnowledgeState(services) {
  try {
    let knowledge;
    try {
      knowledge = require('../knowledge');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const health = typeof knowledge.healthCheck === 'function'
      ? await knowledge.healthCheck(services)
      : { status: 'unknown' };
    return { ok: true, data: health };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectLifeOSState(services) {
  try {
    let lifeos;
    try {
      lifeos = require('../lifeos');
    } catch (_) {
      return moduleUnavailable('module not found');
    }
    const plan = typeof lifeos.getDailyPlan === 'function'
      ? await lifeos.getDailyPlan(services)
      : { status: 'unknown' };
    return { ok: true, data: plan };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectModuleState(moduleName, workspaceId, services) {
  if (services === undefined) services = {};
  const collectorMap = {
    app: collectAppHealth,
    dashboard: collectDashboardState,
    telegramControl: collectTelegramControlState,
    executor: collectExecutorState,
    integrations: collectIntegrationState,
    githubOps: collectGitHubOpsState,
    deploy: collectDeployState,
    observability: collectObservabilityState,
    cost: collectCostState,
    operator: collectOperatorState,
    portfolio: collectPortfolioState,
    knowledge: collectKnowledgeState,
    lifeos: collectLifeOSState
  };
  const collector = collectorMap[moduleName];
  if (!collector) {
    return { ok: false, error: `Unknown module: ${moduleName}` };
  }
  try {
    const result = await collector(services);
    return result;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function collectSystemState(workspaceId, services) {
  if (services === undefined) services = {};
  const collectors = {
    app: collectAppHealth(services),
    dashboard: collectDashboardState(services),
    telegramControl: collectTelegramControlState(services),
    executor: collectExecutorState(services),
    integrations: collectIntegrationState(services),
    githubOps: collectGitHubOpsState(services),
    deploy: collectDeployState(services),
    observability: collectObservabilityState(services),
    cost: collectCostState(services),
    operator: collectOperatorState(services),
    portfolio: collectPortfolioState(services),
    knowledge: collectKnowledgeState(services),
    lifeos: collectLifeOSState(services)
  };

  const settled = await Promise.allSettled(
    Object.entries(collectors).map(async ([key, promise]) => {
      const result = await promise;
      return { key, result };
    })
  );

  const state = {};
  const degraded = [];

  for (const entry of settled) {
    if (entry.status === 'fulfilled') {
      const { key, result } = entry.value;
      state[key] = { ok: result.ok, data: result.data || null };
      if (!result.ok) {
        state[key].error = result.error || 'unknown error';
        degraded.push(key);
      }
      if (result.degraded) {
        degraded.push(key);
      }
    } else {
      state[entry.reason?.key || 'unknown'] = { ok: false, error: 'collector_promise_failed' };
      degraded.push(entry.reason?.key || 'unknown');
    }
  }

  state.collectedAt = nowIso();
  state.degraded = degraded;
  state.healthy = degraded.length === 0;

  return state;
}

module.exports = {
  collectSystemState,
  collectModuleState,
  collectAppHealth,
  collectDashboardState,
  collectTelegramControlState,
  collectExecutorState,
  collectIntegrationState,
  collectGitHubOpsState,
  collectDeployState,
  collectObservabilityState,
  collectCostState,
  collectOperatorState,
  collectPortfolioState,
  collectKnowledgeState,
  collectLifeOSState
};
