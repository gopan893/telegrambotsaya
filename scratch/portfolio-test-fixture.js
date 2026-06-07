'use strict';

function daysAgo(days) {
  return new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
}

function createMemoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async safeRead(key, fallback) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback;
    },
    async safeWrite(key, value) {
      data[key] = value;
      return value;
    },
    getStorageStatus() {
      return { configuredDriver: 'json', activeDriver: 'json', fallbackActive: true };
    },
    getRepositories() {
      return {
        goals: {
          listGoals: async () => data.__goals || []
        }
      };
    }
  };
}

function patchRuntime(fixtures = {}) {
  const planner = require('../src/planner');
  const executor = require('../src/executor');
  const observability = require('../src/observability');

  planner.plannerEngine.listPlans = async () => fixtures.plans || [];
  planner.taskOrchestrator.listTasks = async () => fixtures.tasks || [];
  executor.executionQueue.listPendingApprovals = async () => fixtures.proposals || [];
  observability.incidentStore.listIncidents = async () => fixtures.incidents || [];
}

function makePortfolioServices(overrides = {}) {
  const workspaceId = overrides.workspaceId || 'ws_portfolio_test';
  const userId = overrides.userId || '12345';
  const goals = overrides.goals || [
    {
      id: 'goal_deploy',
      workspaceId,
      userId,
      title: 'Stabilkan deploy Render dashboard',
      description: 'Perbaiki dashboard deploy dan release gate sebelum push.',
      status: 'active',
      priority: 'high',
      progress: 40,
      updatedAt: daysAgo(1),
      createdAt: daysAgo(8)
    },
    {
      id: 'goal_feature',
      workspaceId,
      userId,
      title: 'Bangun fitur portfolio manager',
      description: 'Multi-project priority intelligence untuk Codex/OpenCode.',
      status: 'active',
      priority: 'medium',
      progress: 20,
      updatedAt: daysAgo(10),
      createdAt: daysAgo(20)
    }
  ];
  const tasks = overrides.tasks || [
    {
      id: 'task_deploy_gate',
      workspaceId,
      userId,
      linkedGoalId: 'goal_deploy',
      title: 'Jalankan test deploy gate sebelum release',
      status: 'blocked',
      priority: 'high',
      priorityScore: 80,
      dependencies: ['tests_pass'],
      blockedReason: 'Menunggu regression test',
      updatedAt: daysAgo(2)
    },
    {
      id: 'task_portfolio_docs',
      workspaceId,
      userId,
      linkedGoalId: 'goal_feature',
      title: 'Update docs Portfolio',
      status: 'todo',
      priority: 'medium',
      priorityScore: 50,
      updatedAt: daysAgo(12)
    }
  ];
  const proposals = overrides.proposals || [
    {
      id: 'exec_pending',
      workspaceId,
      userId,
      title: 'Deploy proposal pending',
      status: 'pending_approval',
      riskLevel: 'high',
      sourceType: 'deploy',
      createdAt: daysAgo(1)
    }
  ];
  const incidents = overrides.incidents || [
    {
      id: 'inc_dashboard',
      workspaceId,
      title: 'Dashboard regression',
      severity: 'high',
      status: 'open',
      affectedSystems: ['dashboard'],
      createdAt: daysAgo(1)
    }
  ];
  const storageManager = createMemoryStorage({ __goals: goals });
  const services = {
    workspaceId,
    userId,
    actorId: userId,
    actorType: 'test',
    env: { OWNER_CHAT_ID: userId },
    storageManager,
    aiOS: { goalManager: { listGoals: async () => goals } },
    operatorSystem: { listPlans: async () => overrides.plans || [] },
    costSystem: {
      analyzeCost: async () => ({
        estimatedTokenUsage: { averageTokens: overrides.averageTokens || 900 },
        aiPerRequest: 1.4,
        recommendations: [{ action: 'Use summaries for lightweight portfolio scan.' }]
      })
    },
    evaluationSystem: overrides.evaluationSystem || {
      runEvaluationCase: async () => ({ score: { approvalSafetyScore: 100, portfolioSafetyScore: 100 } })
    },
    logger: { warn() {}, info() {}, error() {} }
  };
  patchRuntime({ goals, tasks, proposals, incidents, plans: overrides.plans || [] });
  return { services, workspaceId, userId, goals, tasks, proposals, incidents, storageManager };
}

module.exports = {
  daysAgo,
  makePortfolioServices
};
