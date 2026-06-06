'use strict';

const dashboardRoutes = require('./dashboard-routes');
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
const selfhealingRoutes = require('./selfhealing-routes');
const monitoringRoutes = require('./monitoring-routes');
const cicdRoutes = require('./cicd-routes');
const routineRoutes = require('./routine-routes');
const devGovernanceRoutes = require('./devgovernance-routes');
const observabilityRoutes = require('./observability-routes');
let githubOpsRoutes;
try {
  githubOpsRoutes = require('./githubops-routes');
} catch (e) {
  githubOpsRoutes = { registerGithubOpsRoutes: () => {} };
}

let deployRoutes;
try {
  deployRoutes = require('./deploy-routes');
} catch (e) {
  deployRoutes = { registerDeployRoutes: () => {} };
}

let costRoutes;
try {
  costRoutes = require('./cost-routes');
} catch (e) {
  costRoutes = { registerCostRoutes: () => {} };
}

module.exports = {
  registerDashboardRoutes: (...args) => dashboardRoutes.registerDashboardRoutes(...args),
  registerCodingWorkspaceRoutes: (...args) => dashboardRoutes.registerCodingWorkspaceRoutes(...args),
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
  selfhealingRoutes,
  monitoringRoutes,
  observabilityRoutes,
  cicdRoutes,
  routineRoutes,
  devGovernanceRoutes,
  githubOpsRoutes,
  deployRoutes,
  costRoutes,
  utils,
  actions: require('./dashboard-actions')
};
