'use strict';

const { registerDashboardRoutes } = require('./dashboard-routes');
const auth = require('./dashboard-auth');
const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const utils = require('./dashboard-utils');
const auditLog = require('./audit-log');
const permissions = require('./dashboard-permissions');
const safeActions = require('./safe-actions');
const softDelete = require('./soft-delete');
const workspaceRoutes = require('./workspace-routes');
const plannerRoutes = require('./planner-routes');
const executorRoutes = require('./executor-routes');
const toolRoutes = require('./tool-routes');
const backupRoutes = require('./backup-routes');
const pwaRoutes = require('./pwa-routes');
const agentMemoryRoutes = require('./agent-memory-routes');
const councilRoutes = require('./council-routes');
const agentRoutes = require('./agent-routes');
const agentTaskRoutes = require('./agent-task-routes');
const decisionRoutes = require('./decision-routes');
const agentExecutorRoutes = require('./agent-executor-routes');
const agentEvaluationRoutes = require('./agent-evaluation-routes');
const evaluationRoutes = require('./evaluation-routes');
const integrationExecutionRoutes = require('./integration-execution-routes');

module.exports = {
  registerDashboardRoutes,
  auth,
  guards,
  auditLog,
  permissions,
  safeActions,
  serializers,
  softDelete,
  plannerRoutes,
  executorRoutes,
  backupRoutes,
  councilRoutes,
  agentMemoryRoutes,
  agentRoutes,
  agentTaskRoutes,
  agentExecutorRoutes,
  agentEvaluationRoutes,
  evaluationRoutes,
  integrationExecutionRoutes,
  decisionRoutes,
  pwaRoutes,
  toolRoutes,
  workspaceRoutes,
  utils,
  actions: require('./dashboard-actions')
};
