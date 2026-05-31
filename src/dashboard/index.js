'use strict';

const { registerDashboardRoutes } = require('./dashboard-routes');
const auth = require('./dashboard-auth');
const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const utils = require('./dashboard-utils');

module.exports = {
  registerDashboardRoutes,
  auth,
  guards,
  serializers,
  utils,
  actions: require('./dashboard-actions')
};
