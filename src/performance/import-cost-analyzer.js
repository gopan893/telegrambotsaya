'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./performance-utils');

const BASE = path.join(process.cwd());
const HEAVY_IMPORT_THRESHOLD = 500;

function analyzeRequireGraphApprox(services = {}) {
  const srcDir = path.join(BASE, 'src');
  const graph = {};
  const allFiles = [];

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
        } else if (entry.endsWith('.js')) {
          allFiles.push(fullPath);
        }
      } catch (_) {}
    }
  }

  walk(srcDir);

  for (const file of allFiles) {
    const content = utils.readFileSafe(file);
    if (!content) continue;
    const requires = [];
    const regex = /require\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      requires.push(match[2]);
    }
    if (requires.length > 0) {
      const relative = path.relative(BASE, file);
      graph[relative] = { requires, count: requires.length };
    }
  }

  const totalModules = Object.keys(graph).length;
  const totalRequires = Object.values(graph).reduce((sum, entry) => sum + entry.count, 0);

  return { graph, totalModules, totalRequires };
}

function detectDuplicateRequires(services = {}) {
  const { graph } = analyzeRequireGraphApprox(services);
  const importCount = {};
  const duplicates = [];

  for (const [file, info] of Object.entries(graph)) {
    for (const mod of info.requires) {
      if (!importCount[mod]) importCount[mod] = [];
      importCount[mod].push(file);
    }
  }

  for (const [mod, files] of Object.entries(importCount)) {
    if (files.length > 3) {
      duplicates.push({ module: mod, files, count: files.length });
    }
  }

  return duplicates.sort((a, b) => b.count - a.count);
}

function detectHeavyDashboardImports(services = {}) {
  const { graph } = analyzeRequireGraphApprox(services);
  const heavy = [];

  for (const [file, info] of Object.entries(graph)) {
    if (file.startsWith('src/dashboard')) {
      if (info.count > HEAVY_IMPORT_THRESHOLD) {
        heavy.push({ file, requireCount: info.count });
      }
    }
  }

  return heavy.sort((a, b) => b.requireCount - a.requireCount);
}

function detectOptionalModuleImportedEagerly(services = {}) {
  const { graph } = analyzeRequireGraphApprox(services);
  const suspicious = [];

  const optionalPatterns = ['research', 'lifeos', 'cost', 'knowledge', 'portfolio', 'improvement', 'model-router', 'docs-intel', 'operating-loop', 'governance', 'security', 'privacy'];

  for (const [file, info] of Object.entries(graph)) {
    if (file.startsWith('src/dashboard')) {
      for (const mod of info.requires) {
        const modName = mod.split('/').pop().replace('.js', '');
        if (optionalPatterns.some(p => mod.includes(p))) {
          suspicious.push({ file, module: mod, reason: 'Optional module eagerly imported in dashboard routes' });
        }
      }
    }
  }

  return suspicious;
}

function buildImportCostReport(services = {}) {
  const graph = analyzeRequireGraphApprox(services);
  const duplicates = detectDuplicateRequires(services);
  const heavyDash = detectHeavyDashboardImports(services);
  const eagerOptional = detectOptionalModuleImportedEagerly(services);

  return {
    timestamp: new Date().toISOString(),
    description: 'Import cost analysis report',
    summary: {
      totalModules: graph.totalModules,
      totalRequires: graph.totalRequires,
      duplicateCount: duplicates.length,
      heavyDashboardCount: heavyDash.length,
      eagerOptionalCount: eagerOptional.length
    },
    duplicates: duplicates.slice(0, 20),
    heavyDashboardImports: heavyDash,
    eagerOptionalImports: eagerOptional,
    recommendations: []
  };
}

module.exports = {
  analyzeRequireGraphApprox,
  detectDuplicateRequires,
  detectHeavyDashboardImports,
  detectOptionalModuleImportedEagerly,
  buildImportCostReport
};
