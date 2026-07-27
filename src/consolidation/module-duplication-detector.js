'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./consolidation-utils');

const BASE = path.join(process.cwd());

async function detectDuplicateModules(services = {}) {
  const dirs = utils.getSrcDirectories(BASE);
  const nameMap = {};

  for (const dir of dirs) {
    const dirPath = path.join(BASE, 'src', dir);
    const files = utils.getFilesInDirectory(dirPath);
    for (const file of files) {
      if (!file.endsWith('.js')) continue;
      if (!nameMap[file]) nameMap[file] = [];
      nameMap[file].push(path.join('src', dir, file));
    }
  }

  const duplicates = [];
  for (const [name, paths] of Object.entries(nameMap)) {
    if (paths.length > 1) {
      duplicates.push({ fileName: name, count: paths.length, paths });
    }
  }

  return duplicates;
}

async function detectDuplicateFunctionNames(services = {}) {
  const dirs = utils.getSrcDirectories(BASE);
  const funcMap = {};

  for (const dir of dirs) {
    const dirPath = path.join(BASE, 'src', dir);
    const files = utils.getFilesInDirectory(dirPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
      const funcMatches = content.matchAll(/(?:async\s+)?function\s+(\w+)/g);
      for (const m of funcMatches) {
        const funcName = m[1];
        if (!funcMap[funcName]) funcMap[funcName] = [];
        funcMap[funcName].push(path.join('src', dir, file));
      }
      const exportMatches = content.matchAll(/module\.exports\s*=\s*\{([^}]+)\}/gs);
      for (const m of exportMatches) {
        const exports = m[1].split(',').map(e => e.trim().split(':')[0].trim()).filter(Boolean);
        for (const ex of exports) {
          if (!funcMap[ex]) funcMap[ex] = [];
          funcMap[ex].push(path.join('src', dir, file));
        }
      }
    }
  }

  const duplicates = [];
  for (const [name, paths] of Object.entries(funcMap)) {
    const uniquePaths = [...new Set(paths)];
    if (uniquePaths.length > 1) {
      duplicates.push({ functionName: name, count: uniquePaths.length, paths: uniquePaths });
    }
  }

  return duplicates;
}

async function detectOverlappingRouteModules(services = {}) {
  const dashDir = path.join(BASE, 'src', 'dashboard');
  let files = [];
  try {
    files = utils.getFilesInDirectory(dashDir).filter(f => f.endsWith('.js'));
  } catch (_) {
    return [];
  }

  const routeMap = {};
  for (const file of files) {
    const content = fs.readFileSync(path.join(dashDir, file), 'utf8');
    const routeMatches = content.matchAll(/(?:router|app)\.(?:get|post|put|delete|patch)\(['"`](\/[^'"`)]+)/g);
    for (const m of routeMatches) {
      const routePath = m[1];
      if (!routeMap[routePath]) routeMap[routePath] = [];
      routeMap[routePath].push(file);
    }
  }

  const overlaps = [];
  for (const [routePath, files] of Object.entries(routeMap)) {
    if (files.length > 1) {
      overlaps.push({ routePath, count: files.length, files });
    }
  }

  return overlaps;
}

async function detectOverlappingDashboardTabs(services = {}) {
  const statePath = path.join(BASE, 'public', 'dashboard', 'state.js');
  try {
    const content = fs.readFileSync(statePath, 'utf8');
    const aliasMatches = content.matchAll(/aliases:\s*\[([^\]]+)\]/g);
    const aliasMap = {};

    let idx = 0;
    for (const m of aliasMatches) {
      const aliases = m[1].split(',').map(a => a.trim().replace(/['"`]/g, ''));
      for (const alias of aliases) {
        if (!aliasMap[alias]) aliasMap[alias] = [];
        aliasMap[alias].push(`tab_${idx}`);
      }
      idx++;
    }

    const overlaps = [];
    for (const [alias, tabs] of Object.entries(aliasMap)) {
      if (tabs.length > 1) {
        overlaps.push({ alias, count: tabs.length });
      }
    }
    return overlaps;
  } catch (_) {
    return [];
  }
}

async function detectOverlappingTelegramCommands(services = {}) {
  const cmdPath = path.join(BASE, 'src', 'telegram-control', 'telegram-command-registry.js');
  try {
    const content = fs.readFileSync(cmdPath, 'utf8');
    const nameMatches = content.matchAll(/name:\s*['"`]([^'"`]+)['"`]/g);
    const aliasMatches = content.matchAll(/aliases:\s*\[([^\]]+)\]/g);
    const nameCount = {};
    const aliasCount = {};

    for (const m of nameMatches) {
      nameCount[m[1]] = (nameCount[m[1]] || 0) + 1;
    }
    for (const m of aliasMatches) {
      const aliases = m[1].split(',').map(a => a.trim().replace(/['"`]/g, ''));
      for (const alias of aliases) {
        aliasCount[alias] = (aliasCount[alias] || 0) + 1;
      }
    }

    const conflicts = [];
    for (const [name, count] of Object.entries(nameCount)) {
      if (count > 1) conflicts.push({ name, type: 'command_name', count });
    }
    for (const [alias, count] of Object.entries(aliasCount)) {
      if (count > 1) conflicts.push({ name: alias, type: 'alias', count });
    }
    return conflicts;
  } catch (_) {
    return [];
  }
}

function buildDuplicationReport(results, services = {}) {
  const findings = [];

  for (const dup of (results.duplicateModules || [])) {
    findings.push({
      type: 'duplicate_module',
      detail: `${dup.fileName} found in ${dup.count} locations`,
      paths: dup.paths,
      risk: dup.count >= 3 ? 'high' : 'medium',
      recommendation: `Consolidate ${dup.fileName} into a single shared module`
    });
  }

  for (const dup of (results.duplicateFunctions || [])) {
    findings.push({
      type: 'duplicate_function',
      detail: `Function "${dup.functionName}" found in ${dup.count} modules`,
      paths: dup.paths,
      risk: dup.count >= 3 ? 'medium' : 'low',
      recommendation: `Consider extracting ${dup.functionName} into a shared utility`
    });
  }

  for (const overlap of (results.overlappingRoutes || [])) {
    findings.push({
      type: 'overlapping_route',
      detail: `Route ${overlap.routePath} handled by ${overlap.count} files`,
      paths: overlap.files,
      risk: 'high',
      recommendation: `Deduplicate route handler for ${overlap.routePath}`
    });
  }

  for (const overlap of (results.overlappingTabs || [])) {
    findings.push({
      type: 'overlapping_tab_alias',
      detail: `Alias "${overlap.alias}" used by ${overlap.count} tabs`,
      risk: 'low',
      recommendation: `Remove duplicate alias ${overlap.alias}`
    });
  }

  for (const conflict of (results.commandConflicts || [])) {
    findings.push({
      type: 'command_conflict',
      detail: `Command/alias "${conflict.name}" has ${conflict.count} registrations`,
      risk: 'high',
      recommendation: `Resolve duplicate command registration for ${conflict.name}`
    });
  }

  return {
    timestamp: new Date().toISOString(),
    totalFindings: findings.length,
    findings,
    summary: `Found ${findings.length} duplication issues (${findings.filter(f => f.risk === 'high').length} high, ${findings.filter(f => f.risk === 'medium').length} medium, ${findings.filter(f => f.risk === 'low').length} low)`
  };
}

module.exports = {
  detectDuplicateModules,
  detectDuplicateFunctionNames,
  detectOverlappingRouteModules,
  detectOverlappingDashboardTabs,
  detectOverlappingTelegramCommands,
  buildDuplicationReport
};
