'use strict';

const mobileUxStore = require('./mobile-ux-store');
const mobileDashboardProfile = require('./mobile-dashboard-profile');
const mobileNavigationManager = require('./mobile-navigation-manager');
const mobileQuickActions = require('./mobile-quick-actions');
const pwaOfflineController = require('./pwa-offline-controller');
const pwaCachePolicy = require('./pwa-cache-policy');
const notificationCenter = require('./notification-center');
const dashboardErrorStateManager = require('./dashboard-error-state-manager');
const mobileUxReportGenerator = require('./mobile-ux-report-generator');
const mobileUtils = require('./mobile-utils');

module.exports = {
  mobileUxStore,
  mobileDashboardProfile,
  mobileNavigationManager,
  mobileQuickActions,
  pwaOfflineController,
  pwaCachePolicy,
  notificationCenter,
  dashboardErrorStateManager,
  mobileUxReportGenerator,
  mobileUtils
};
