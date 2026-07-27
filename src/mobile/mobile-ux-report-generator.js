'use strict';

const { getMobileNavigationState } = require('./mobile-navigation-manager');
const { listMobileQuickActions } = require('./mobile-quick-actions');
const { getPwaOfflineStatus, validateOfflineCachePolicy } = require('./pwa-offline-controller');
const { getPwaCachePolicy, detectStaleDashboardCacheVersion, detectUnsafeApiCaching } = require('./pwa-cache-policy');
const { buildNotificationDigest } = require('./notification-center');
const { sanitizeMobileData } = require('./mobile-utils');

function generateMobileUxReport(services) {
  const navigation = getMobileNavigationState(services);
  const quickActions = listMobileQuickActions(null, services);
  const offlineStatus = getPwaOfflineStatus(services);
  const cachePolicy = getPwaCachePolicy(services);
  const cacheStale = detectStaleDashboardCacheVersion(services);
  const unsafeCaching = detectUnsafeApiCaching(services);
  const notificationDigest = buildNotificationDigest(services);

  const report = {
    generatedAt: new Date().toISOString(),
    navigationTabCount: navigation.bottomNav.length,
    tabGroupCount: navigation.groups.length,
    quickActionCount: quickActions.length,
    offlineStatus,
    cachePolicy: {
      version: cachePolicy.version,
      cacheName: cachePolicy.cacheName,
      strategy: cachePolicy.strategy,
      excludedPatterns: cachePolicy.excludedPatterns
    },
    cacheStale: cacheStale.stale,
    unsafeApiCaching: unsafeCaching.unsafeCount,
    notificationCount: notificationDigest.total,
    unreadNotificationCount: notificationDigest.unread
  };

  return sanitizeMobileData(report);
}

module.exports = {
  generateMobileUxReport
};
