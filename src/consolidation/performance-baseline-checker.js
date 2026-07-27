'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./consolidation-utils');

const BASE = path.join(process.cwd());

async function checkDashboardBundleSizeApprox(services = {}) {
  const dashDir = path.join(BASE, 'public', 'dashboard');
  let files = [];
  try {
    files = fs.readdirSync(dashDir).filter(f => f.endsWith('.js'));
  } catch (_) {
    return { totalSize: 0, fileCount: 0, files: [] };
  }

  let totalSize = 0;
  const details = [];
  for (const file of files) {
    try {
      const stat = fs.statSync(path.join(dashDir, file));
      totalSize += stat.size;
      details.push({ file, size: stat.size });
    } catch (_) {}
  }

  return { totalSize, fileCount: details.length, files: details };
}

async function checkStartupImportCostApprox(services = {}) {
  const coreFiles = ['telebot.js', 'start-local.js', 'src/bot/index.js', 'src/bot/webhook.js'];
  let totalRequires = 0;
  const details = [];

  for (const file of coreFiles) {
    const fullPath = path.join(BASE, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const reqCount = (content.match(/\brequire\s*\(/g) || []).length;
      totalRequires += reqCount;
      details.push({ file, requireCount: reqCount });
    } catch (_) {
      details.push({ file, requireCount: 0, error: 'File not found' });
    }
  }

  return { totalRequires, fileCount: details.length, details };
}

async function checkRouteCount(services = {}) {
  const dashDir = path.join(BASE, 'src', 'dashboard');
  let files = [];
  try {
    files = fs.readdirSync(dashDir).filter(f => f.endsWith('.js'));
  } catch (_) {
    return { totalRoutes: 0, routeFiles: 0 };
  }

  let totalRoutes = 0;
  const details = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dashDir, file), 'utf8');
      const routeCount = (content.match(/(?:router|app)\.(?:get|post|put|delete|patch)\(/g) || []).length;
      totalRoutes += routeCount;
      details.push({ file, routeCount });
    } catch (_) {}
  }

  return { totalRoutes, routeFiles: details.length, details };
}

async function checkLargeFileWarnings(services = {}) {
  const srcDir = path.join(BASE, 'src');
  const warnings = [];
  const THRESHOLD = 2000;

  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          walk(fullPath);
        } else if (entry.endsWith('.js') || entry.endsWith('.html')) {
          const lines = utils.countLines(fullPath);
          if (lines > THRESHOLD) {
            warnings.push({ file: path.relative(BASE, fullPath), lines });
          }
        }
      } catch (_) {}
    }
  }

  walk(srcDir);
  walk(path.join(BASE, 'public', 'dashboard'));

  return warnings;
}

function buildPerformanceBaselineReport(services = {}) {
  return {
    timestamp: new Date().toISOString(),
    description: 'Performance baseline report',
    rules: [
      'Approximate static analysis only',
      'No heavy benchmark',
      'No external service call'
    ]
  };
}

module.exports = {
  checkDashboardBundleSizeApprox,
  checkStartupImportCostApprox,
  checkRouteCount,
  checkLargeFileWarnings,
  buildPerformanceBaselineReport
};
