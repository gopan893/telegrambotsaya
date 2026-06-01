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
  toolRoutes,
  workspaceRoutes,
  utils,
  actions: require('./dashboard-actions')
};
