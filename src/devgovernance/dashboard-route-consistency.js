'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./devgovernance-utils');
const store = require('./devgovernance-store');

const KNOWN_TABS = [
  'overview', 'ops', 'workspaces', 'users', 'permissions',
  'memory', 'goals', 'workflows', 'planner', 'executor',
  'agents', 'tools', 'integrations', 'backup', 'insights',
  'graph', 'benchmarks', 'incidents', 'audit', 'commands',
  'env', 'settings', 'agent-evaluation', 'coding', 'release',
  'routines', 'selfhealing', 'monitoring', 'cicd', 'devgovernance'
];

function buildDashboardRouteReport(results) {
  return {
    ok: results.critical.length === 0,
    summary: {
      total: results.total,
      critical: results.critical.length,
      warnings: results.warnings.length,
      tabsChecked: results.tabsChecked || 0
    },
    issues: results.issues
  };
}

function validateDashboardRoutes(services) {
  const issues = [];
  const warnings = [];
  const critical = [];
  const repoRoot = services?.repoRoot || process.cwd();
  const stateJs = path.join(repoRoot, 'public', 'dashboard', 'state.js');
  const uiJs = path.join(repoRoot, 'public', 'dashboard', 'ui.js');
  const indexHtml = path.join(repoRoot, 'public', 'dashboard', 'index.html');
  const swJs = path.join(repoRoot, 'public', 'dashboard', 'service-worker.js');

  if (fs.existsSync(stateJs)) {
    const stateContent = fs.readFileSync(stateJs, 'utf8');

    for (const tab of KNOWN_TABS) {
      const pattern = tab === 'overview'
        ? new RegExp(`'${tab}'\\s*:\\s*\\{`)
        : new RegExp(`'${tab}'\\s*:\\s*\\{|"${tab}"\\s*:\\s*\\{`);
      if (!pattern.test(stateContent)) {
        critical.push({ type: 'missing_tab_registry', tab, message: `Known tab "${tab}" not found in DASHBOARD_TABS registry` });
      }
    }

    if (uiJs && fs.existsSync(uiJs)) {
      const uiContent = fs.readFileSync(uiJs, 'utf8');
      for (const tab of KNOWN_TABS) {
        const rendererName = `render${tab.charAt(0).toUpperCase() + tab.slice(1).replace(/-./g, c => c.toUpperCase())}`;
        const altName = `render${tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`;
        if (!uiContent.includes(`renderOverview`) && tab === 'overview') continue;
        const checkName = tab === 'overview' ? 'renderOverview' : (uiContent.includes(rendererName) ? rendererName : altName);
        if (tab !== 'overview' && !uiContent.includes(`render${tab.charAt(0).toUpperCase() + tab.slice(1)}`) && !uiContent.includes(altName)) {
          warnings.push({ type: 'missing_renderer', tab, message: `Tab "${tab}" may be missing a renderer function` });
        }
      }
    }
  }

  if (fs.existsSync(swJs)) {
    const swContent = fs.readFileSync(swJs, 'utf8');
    if (!swContent.includes('/api/dashboard/')) {
      warnings.push({ type: 'sw_cache_api', message: 'Service worker may cache /api/dashboard/* — check configuration' });
    }
  }

  if (fs.existsSync(indexHtml)) {
    const htmlContent = fs.readFileSync(indexHtml, 'utf8');
    for (const tab of KNOWN_TABS) {
      if (tab === 'overview') continue;
      if (!htmlContent.includes(`data-tab="${tab}"`)) {
        warnings.push({ type: 'missing_menu_item', tab, message: `Tab "${tab}" missing from sidebar menu in index.html` });
      }
    }
  }

  const total = issues.length + warnings.length + critical.length;
  const results = { issues, warnings, critical, total, tabsChecked: KNOWN_TABS.length };
  store.setDashboardRouteReport(buildDashboardRouteReport(results), services);
  return results;
}

function validateDashboardMenuRegistry(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const stateJs = path.join(repoRoot, 'public', 'dashboard', 'state.js');
  const issues = [];
  if (!fs.existsSync(stateJs)) return issues;
  const content = fs.readFileSync(stateJs, 'utf8');
  for (const tab of KNOWN_TABS) {
    const navVisiblePattern = new RegExp(`'${tab}'[^}]*navVisible`);
    if (!navVisiblePattern.test(content)) {
      issues.push({ type: 'no_nav_visibility', tab, message: `Tab "${tab}" has no navVisible property` });
    }
  }
  return issues;
}

function validateDashboardRenderers(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const uiJs = path.join(repoRoot, 'public', 'dashboard', 'ui.js');
  const issues = [];
  if (!fs.existsSync(uiJs)) return issues;
  const content = fs.readFileSync(uiJs, 'utf8');
  for (const tab of KNOWN_TABS) {
    const rendererName = tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    const fnName = `render${rendererName}`;
    if (tab === 'overview') continue;
    if (!content.includes(fnName)) {
      issues.push({ type: 'renderer_not_found', tab, renderer: fnName, message: `Renderer "${fnName}" not found in ui.js` });
    }
  }
  return issues;
}

function validateDashboardPwaCacheRules(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const swJs = path.join(repoRoot, 'public', 'dashboard', 'service-worker.js');
  const issues = [];
  if (!fs.existsSync(swJs)) return issues;
  const content = fs.readFileSync(swJs, 'utf8');
  if (content.includes('/api/dashboard/')) {
    issues.push({ type: 'api_cache', message: 'Service worker caches /api/dashboard/* — may cause stale data' });
  }
  return issues;
}

module.exports = {
  validateDashboardRoutes,
  validateDashboardMenuRegistry,
  validateDashboardRenderers,
  validateDashboardPwaCacheRules,
  buildDashboardRouteReport
};
