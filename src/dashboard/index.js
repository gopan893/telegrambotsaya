'use strict';

const { registerDashboardRoutes, registerCodingWorkspaceRoutes } = require('./dashboard-routes');
const auth = require('./dashboard-auth');
const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const utils = require('./dashboard-utils');

module.exports = {
  registerDashboardRoutes,
  registerCodingWorkspaceRoutes,
  auth,
  guards,
  serializers,
  utils,
  actions: require('./dashboard-actions')
};
