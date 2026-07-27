'use strict';

const { sanitizeMobileData } = require('./mobile-utils');

function getPwaOfflineStatus(services) {
  return {
    online: true,
    cacheReady: true,
    offlineMode: false,
    lastSync: new Date().toISOString()
  };
}

function buildOfflineShellManifest(services) {
  return [
    '/dashboard/',
    '/dashboard/index.html',
    '/dashboard/styles.css',
    '/dashboard/mobile.css',
    '/dashboard/api.js',
    '/dashboard/pwa.js',
    '/dashboard/dashboard.js',
    '/dashboard/dashboard-core.js',
    '/dashboard/chart.js',
    '/dashboard/manifest.webmanifest'
  ];
}

function validateOfflineCachePolicy(services) {
  const excludedPatterns = ['/api/dashboard', '/api/auth', '/api/security', '/api/privacy'];
  const safe = [];
  const issues = [];
  const shell = buildOfflineShellManifest(services);
  for (const asset of shell) {
    if (excludedPatterns.some(p => asset.startsWith(p) || asset.includes(p))) {
      issues.push(`Asset may be unsafe: ${asset}`);
    } else {
      safe.push(asset);
    }
  }
  return { valid: issues.length === 0, safe, issues };
}

function explainOfflineLimitations(services) {
  return {
    worksOffline: [
      'View cached dashboard shell',
      'Navigate to previously visited tabs',
      'View cached notifications',
      'Read cached recipe list',
      'Access static assets'
    ],
    doesNotWorkOffline: [
      'Live dashboard data (blocked: /api/dashboard/*)',
      'Authentication and login',
      'Security reports and privacy data',
      'Export and download operations',
      'Write/execute/deploy actions',
      'Real-time monitoring updates'
    ],
    warning: 'You are offline. Some features are unavailable. Dangerous actions are disabled.'
  };
}

module.exports = {
  getPwaOfflineStatus,
  buildOfflineShellManifest,
  validateOfflineCachePolicy,
  explainOfflineLimitations
};
