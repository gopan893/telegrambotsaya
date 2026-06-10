'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./performance-utils');

const BASE = path.join(process.cwd());
const UI_JS_PATH = path.join(BASE, 'public', 'dashboard', 'ui.js');
const DASHBOARD_DIR = path.join(BASE, 'public', 'dashboard');

function identifyTabsSafeForLazyLoad(services = {}) {
  const uiContent = utils.readFileSafe(UI_JS_PATH);
  if (!uiContent) return [];

  const renderedTabs = [];
  const rendererRegex = /render(\w+)\s*[=(]/g;
  let match;
  while ((match = rendererRegex.exec(uiContent)) !== null) {
    renderedTabs.push(match[1].toLowerCase());
  }

  const knownTabFiles = [];
  try {
    const files = fs.readdirSync(DASHBOARD_DIR).filter(f => f.endsWith('.js') && f !== 'ui.js' && f !== 'app.js' && f !== 'service-worker.js');
    for (const file of files) {
      knownTabFiles.push(file.replace('.js', ''));
    }
  } catch (_) {}

  const safeTabs = [];
  const inlineTabs = [];

  for (const tab of renderedTabs) {
    if (knownTabFiles.includes(tab)) {
      safeTabs.push({ tab, file: tab + '.js', reason: 'Has dedicated JS file, safe for lazy loading' });
    } else {
      inlineTabs.push({ tab, reason: 'Renderer defined in ui.js, not a separate file' });
    }
  }

  return { safeTabs, inlineTabs };
}

function identifyTabsNotSafeForLazyLoad(services = {}) {
  const { inlineTabs } = identifyTabsSafeForLazyLoad(services);
  const uiContent = utils.readFileSafe(UI_JS_PATH);
  if (!uiContent) return [];

  const notSafe = [];
  const criticalPatterns = ['renderOverview', 'renderSettings', 'renderError'];

  for (const tab of inlineTabs) {
    notSafe.push({
      tab: tab.tab,
      reason: tab.reason,
      critical: criticalPatterns.some(p => tab.tab.toLowerCase() === p.toLowerCase().replace('render', '').toLowerCase())
    });
  }

  return notSafe;
}

function createDashboardLazyLoadPlan(services = {}) {
  const { safeTabs, inlineTabs } = identifyTabsSafeForLazyLoad(services);
  const notSafe = identifyTabsNotSafeForLazyLoad(services);
  const totalTabs = safeTabs.length + inlineTabs.length;

  return {
    timestamp: new Date().toISOString(),
    totalTabs,
    safeForLazyLoad: safeTabs,
    inlineInUiJs: inlineTabs,
    notSafeForLazyLoad: notSafe,
    estimatedSavings: {
      initialLoadReduction: safeTabs.length > 0 ? `${safeTabs.length} files deferred` : 'None',
      note: 'Lazy loading would defer non-critical tab JS until tab is first clicked'
    }
  };
}

function buildLazyLoadCompatibilityPlan(services = {}) {
  const plan = createDashboardLazyLoadPlan(services);

  return {
    timestamp: new Date().toISOString(),
    description: 'Dashboard lazy load compatibility plan',
    summary: {
      totalTabs: plan.totalTabs,
      safeForLazyLoad: plan.safeForLazyLoad.length,
      inlineInUiJs: plan.inlineInUiJs.length,
      notSafe: plan.notSafeForLazyLoad.length
    },
    plan,
    recommendations: [
      ...plan.safeForLazyLoad.map(t => `Lazy load "${t.tab}" - has dedicated file ${t.file}`),
      ...plan.inlineInUiJs.map(t => `Extract "${t.tab}" renderer from ui.js to own file for lazy loading`),
      ...plan.notSafeForLazyLoad.filter(t => t.critical).map(t => `Keep "${t.tab}" as critical path, do not lazy load`)
    ]
  };
}

module.exports = {
  createDashboardLazyLoadPlan,
  identifyTabsSafeForLazyLoad,
  identifyTabsNotSafeForLazyLoad,
  buildLazyLoadCompatibilityPlan
};
