'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./consolidation-utils');

const BASE = path.join(process.cwd());

async function runArchitectureAudit(services = {}) {
  const results = {};
  results.modules = await scanModuleDirectories(services);
  results.routes = await scanRouteDefinitions(services);
  results.dashboardTabs = await scanDashboardRegistry(services);
  results.telegramCommands = await scanTelegramCommandRegistry(services);
  results.capabilities = await scanGovernanceCapabilityRegistry(services);
  results.docs = await scanDocsArchitectureMap(services);
  results.duplicates = [];
  results.orphaned = [];
  results.optional = [];
  results.productionCritical = [];
  return buildArchitectureAuditReport(results, services);
}

async function scanModuleDirectories(services = {}) {
  const dirs = utils.getSrcDirectories(BASE);
  const modules = {};
  for (const dir of dirs) {
    const dirPath = path.join(BASE, 'src', dir);
    const files = utils.getFilesInDirectory(dirPath);
    modules[dir] = { path: dirPath, fileCount: files.length, files };
  }
  return modules;
}

async function scanRouteDefinitions(services = {}) {
  const dashDir = path.join(BASE, 'src', 'dashboard');
  let files = [];
  try {
    files = utils.getFilesInDirectory(dashDir);
  } catch (_) {}
  const routeFiles = files.filter(f => f.endsWith('-routes.js') || f === 'dashboard-routes.js');
  return routeFiles.map(f => {
    const filePath = path.join(dashDir, f);
    const content = fs.readFileSync(filePath, 'utf8');
    const routes = [];
    const routeMatches = content.matchAll(/(?:router|app)\.(get|post|put|delete|patch)\(['"`](\/[^'"`]+)/g);
    for (const m of routeMatches) {
      routes.push({ method: m[1].toUpperCase(), path: m[2] });
    }
    return { file: f, routeCount: routes.length, routes };
  });
}

async function scanDashboardRegistry(services = {}) {
  const statePath = path.join(BASE, 'public', 'dashboard', 'state.js');
  try {
    const content = fs.readFileSync(statePath, 'utf8');
    const tabMatches = content.matchAll(/['"`](\w[\w-]*)['"`]\s*:\s*\{/g);
    const tabs = [];
    for (const m of tabMatches) {
      tabs.push(m[1]);
    }
    return { file: 'public/dashboard/state.js', tabCount: tabs.length, tabs };
  } catch (_) {
    return { file: 'public/dashboard/state.js', tabCount: 0, tabs: [], error: 'File not found' };
  }
}

async function scanTelegramCommandRegistry(services = {}) {
  let registryPath = path.join(BASE, 'src', 'telegram-control', 'telegram-command-registry.js');
  try {
    if (!fs.existsSync(registryPath)) {
      registryPath = path.join(BASE, 'src', 'telegram-control', 'index.js');
    }
    const content = fs.readFileSync(registryPath, 'utf8');
    const cmdMatches = content.matchAll(/name:\s*['"`]([^'"`]+)['"`]/g);
    const commands = [];
    for (const m of cmdMatches) {
      commands.push(m[1]);
    }
    const categoryMatches = content.matchAll(/category:\s*['"`]([^'"`]+)['"`]/g);
    const categories = [];
    for (const m of categoryMatches) {
      if (!categories.includes(m[1])) categories.push(m[1]);
    }
    return { file: path.relative(BASE, registryPath), commandCount: commands.length, commands, categories };
  } catch (_) {
    return { file: 'src/telegram-control/telegram-command-registry.js', commandCount: 0, commands: [], categories: [], error: 'File not found' };
  }
}

async function scanGovernanceCapabilityRegistry(services = {}) {
  const capPath = path.join(BASE, 'src', 'governance', 'capability-registry.js');
  try {
    const content = fs.readFileSync(capPath, 'utf8');
    const capMatches = content.matchAll(/module:\s*['"`]([^'"`]+)['"`],\s*name:\s*['"`]([^'"`]+)['"`]/g);
    const capabilities = [];
    for (const m of capMatches) {
      capabilities.push({ module: m[1], name: m[2] });
    }
    return { file: 'src/governance/capability-registry.js', capabilityCount: capabilities.length, capabilities };
  } catch (_) {
    return { file: 'src/governance/capability-registry.js', capabilityCount: 0, capabilities: [], error: 'File not found' };
  }
}

async function scanDocsArchitectureMap(services = {}) {
  const docPath = path.join(BASE, 'docs', 'ARCHITECTURE_MAP.md');
  try {
    if (fs.existsSync(docPath)) {
      const content = fs.readFileSync(docPath, 'utf8');
      return { exists: true, file: 'docs/ARCHITECTURE_MAP.md', size: content.length };
    }
    return { exists: false, file: 'docs/ARCHITECTURE_MAP.md', error: 'File not found' };
  } catch (_) {
    return { exists: false, file: 'docs/ARCHITECTURE_MAP.md', error: 'File not found' };
  }
}

function buildArchitectureAuditReport(results, services = {}) {
  const report = {
    timestamp: new Date().toISOString(),
    modulesFound: Object.keys(results.modules || {}).length,
    moduleDetails: results.modules || {},
    routeFilesFound: (results.routes || []).length,
    routeDetails: results.routes || [],
    dashboardTabsFound: (results.dashboardTabs || {}).tabCount || 0,
    dashboardTabDetails: (results.dashboardTabs || {}).tabs || [],
    telegramCommandsFound: (results.telegramCommands || {}).commandCount || 0,
    telegramCommandDetails: (results.telegramCommands || {}).commands || [],
    capabilitiesFound: (results.capabilities || {}).capabilityCount || 0,
    capabilityDetails: (results.capabilities || {}).capabilities || [],
    docsArchitectureMapExists: (results.docs || {}).exists || false,
    missingDocs: !(results.docs || {}).exists ? ['docs/ARCHITECTURE_MAP.md'] : [],
    duplicateLookingModules: results.duplicates || [],
    orphanedFiles: results.orphaned || [],
    optionalModules: results.optional || [],
    productionCriticalModules: results.productionCritical || [],
    summary: ''
  };

  const parts = [];
  parts.push(`Modules: ${report.modulesFound}`);
  parts.push(`Route files: ${report.routeFilesFound}`);
  parts.push(`Dashboard tabs: ${report.dashboardTabsFound}`);
  parts.push(`Telegram commands: ${report.telegramCommandsFound}`);
  parts.push(`Capabilities: ${report.capabilitiesFound}`);
  parts.push(`Architecture map: ${report.docsArchitectureMapExists ? 'present' : 'missing'}`);
  report.summary = parts.join(' | ');
  report.raw = results;

  return report;
}

module.exports = {
  runArchitectureAudit,
  scanModuleDirectories,
  scanRouteDefinitions,
  scanDashboardRegistry,
  scanTelegramCommandRegistry,
  scanGovernanceCapabilityRegistry,
  scanDocsArchitectureMap,
  buildArchitectureAuditReport
};
