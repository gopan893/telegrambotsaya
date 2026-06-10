'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./performance-utils');

const BASE = path.join(process.cwd());
const DASHBOARD_DIR = path.join(BASE, 'public', 'dashboard');
const LARGE_FILE_WARN_KB = 100;
const INDEX_HTML_PATH = path.join(DASHBOARD_DIR, 'index.html');

function auditDashboardAssetSizes(services = {}) {
  let files = [];
  try {
    files = fs.readdirSync(DASHBOARD_DIR).filter(f => f.endsWith('.js'));
  } catch (_) {
    return { totalSize: 0, fileCount: 0, files: [] };
  }

  let totalSize = 0;
  const details = [];
  for (const file of files) {
    const filePath = path.join(DASHBOARD_DIR, file);
    const size = utils.getFileSize(filePath);
    totalSize += size;
    details.push({ file, size, sizeFormatted: utils.formatBytes(size) });
  }

  return {
    totalSize,
    totalSizeFormatted: utils.formatBytes(totalSize),
    fileCount: details.length,
    files: details.sort((a, b) => b.size - a.size)
  };
}

function detectLargeDashboardFiles(services = {}) {
  const audit = auditDashboardAssetSizes(services);
  const largeFiles = audit.files.filter(f => f.size > LARGE_FILE_WARN_KB * 1024);

  return largeFiles.map(f => ({
    file: f.file,
    size: f.size,
    sizeFormatted: f.sizeFormatted,
    warning: `File exceeds ${LARGE_FILE_WARN_KB}KB`
  }));
}

function detectDuplicateDashboardScripts(services = {}) {
  const content = utils.readFileSafe(INDEX_HTML_PATH);
  if (!content) return [];

  const scriptTags = [];
  const regex = /<script\s[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const src = match[1].split('?')[0].replace('/dashboard/', '');
    scriptTags.push(src);
  }

  const seen = {};
  const duplicates = [];
  for (const src of scriptTags) {
    if (seen[src]) {
      duplicates.push({ script: src, occurrences: (seen[src] += 1) });
    } else {
      seen[src] = 1;
    }
  }

  return duplicates;
}

function detectUnusedDashboardScriptReferences(services = {}) {
  const content = utils.readFileSafe(INDEX_HTML_PATH);
  if (!content) return [];

  const scriptTags = [];
  const regex = /<script\s[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const src = match[1].split('?')[0].replace('/dashboard/', '');
    scriptTags.push(src);
  }

  let dashboardFiles = [];
  try {
    dashboardFiles = fs.readdirSync(DASHBOARD_DIR).filter(f => f.endsWith('.js'));
  } catch (_) {
    return [];
  }

  const unused = [];
  for (const file of dashboardFiles) {
    if (!scriptTags.includes(file) && file !== 'service-worker.js') {
      unused.push({ file, reason: 'Not referenced in index.html script tags' });
    }
  }

  return unused;
}

function buildDashboardBundleReport(services = {}) {
  const assetSizes = auditDashboardAssetSizes(services);
  const largeFiles = detectLargeDashboardFiles(services);
  const duplicates = detectDuplicateDashboardScripts(services);
  const unused = detectUnusedDashboardScriptReferences(services);

  return {
    timestamp: new Date().toISOString(),
    description: 'Dashboard bundle audit report',
    totalSize: assetSizes.totalSizeFormatted,
    totalFiles: assetSizes.fileCount,
    largeFiles,
    duplicateScripts: duplicates,
    unusedScriptReferences: unused,
    recommendations: []
  };
}

module.exports = {
  auditDashboardAssetSizes,
  detectLargeDashboardFiles,
  detectDuplicateDashboardScripts,
  detectUnusedDashboardScriptReferences,
  buildDashboardBundleReport
};
