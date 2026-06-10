'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./performance-utils');

const BASE = path.join(process.cwd());
const LARGE_FILE_THRESHOLD = 2000;
const HIGH_REQUIRE_THRESHOLD = 50;

function profileStartupStaticCost(services = {}) {
  const coreFiles = ['telebot.js', 'start-local.js', 'src/bot/index.js', 'src/bot/webhook.js'];
  let totalRequires = 0;
  const details = [];

  for (const file of coreFiles) {
    const fullPath = path.join(BASE, file);
    const content = utils.readFileSafe(fullPath);
    if (content === null) {
      details.push({ file, requireCount: 0, error: 'File not found' });
      continue;
    }
    const requireCount = (content.match(/\brequire\s*\(/g) || []).length;
    const lines = content.split('\n').length;
    totalRequires += requireCount;
    details.push({ file, requireCount, lines, size: utils.getFileSize(fullPath) });
  }

  const summary = {
    totalRequires,
    fileCount: details.length,
    details,
    estimatedLoadOrder: details.map(d => d.file)
  };
  return summary;
}

function detectLargeTopLevelImports(services = {}) {
  const srcDir = path.join(BASE, 'src');
  const largeFiles = [];

  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch (_) { return; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          walk(fullPath);
        } else if (entry.endsWith('.js') || entry.endsWith('.html') || entry.endsWith('.css')) {
          const lines = utils.readFileSafe(fullPath);
          if (lines !== null) {
            const lineCount = lines.split('\n').length;
            if (lineCount > LARGE_FILE_THRESHOLD) {
              largeFiles.push({
                file: path.relative(BASE, fullPath),
                lines: lineCount,
                size: stat.size
              });
            }
          }
        }
      } catch (_) {}
    }
  }

  walk(srcDir);
  walk(path.join(BASE, 'public', 'dashboard'));

  return largeFiles.sort((a, b) => b.lines - a.lines);
}

function detectSlowStartupRisk(services = {}) {
  const cost = profileStartupStaticCost(services);
  const largeFiles = detectLargeTopLevelImports(services);
  const risks = [];

  if (cost.totalRequires > HIGH_REQUIRE_THRESHOLD) {
    risks.push({
      type: 'high_require_count',
      severity: cost.totalRequires > 100 ? 'high' : 'medium',
      message: `Startup requires ${cost.totalRequires} modules across core files`,
      detail: cost.details.filter(d => d.requireCount > 10).map(d => `${d.file}: ${d.requireCount} requires`)
    });
  }

  if (largeFiles.length > 0) {
    risks.push({
      type: 'large_file_imports',
      severity: largeFiles.length > 5 ? 'high' : 'medium',
      message: `${largeFiles.length} large source files detected (> ${LARGE_FILE_THRESHOLD} lines)`,
      detail: largeFiles.slice(0, 10).map(f => `${f.file}: ${f.lines} lines`)
    });
  }

  return { risks, totalRisks: risks.length };
}

function buildStartupPerformanceReport(services = {}) {
  const staticCost = profileStartupStaticCost(services);
  const largeFiles = detectLargeTopLevelImports(services);
  const startupRisk = detectSlowStartupRisk(services);

  return {
    timestamp: new Date().toISOString(),
    description: 'Startup performance profile (static analysis)',
    staticCost: {
      totalRequires: staticCost.totalRequires,
      coreFiles: staticCost.details
    },
    largeFiles: largeFiles.slice(0, 20),
    startupRisks: startupRisk,
    recommendations: []
  };
}

module.exports = {
  profileStartupStaticCost,
  detectLargeTopLevelImports,
  detectSlowStartupRisk,
  buildStartupPerformanceReport
};
