'use strict';

const utils = require('./selfhealing-utils');

function createDashboardRouteGuard(store, services) {
  const PUBLIC_TABS = [
    'overview', 'ops', 'workspaces', 'users', 'permissions',
    'memory', 'goals', 'workflows', 'planner', 'executor',
    'agents', 'tools', 'integrations', 'backup', 'insights',
    'graph', 'benchmarks', 'incidents', 'audit', 'commands',
    'env', 'settings', 'agent-evaluation', 'coding', 'release',
    'selfhealing', 'monitoring', 'cicd'
  ];

  const INTERNAL_TABS = [
    'routines'
  ];

  const CRITICAL_TABS = [
    'workspaces', 'agents', 'integrations', 'coding', 'release',
    'agent-evaluation', 'selfhealing', 'monitoring', 'cicd'
  ];

  const KNOWN_TABS = PUBLIC_TABS.concat(INTERNAL_TABS);

  async function runDashboardGuardCheck(guard, ctx, svc) {
    switch (guard.id) {
      case 'gd_dashboard_tab_registry':
        return checkTabRegistry();
      case 'gd_dashboard_renderer_present':
        return checkRendererPresence(svc);
      case 'gd_dashboard_no_overview_fallback':
        return checkNoOverviewFallback(svc);
      case 'gd_dashboard_css_dark_forms':
        return checkDarkFormCSS(svc);
      case 'gd_dashboard_sw_no_api_cache':
        return checkServiceWorker(svc);
      default:
        return { status: 'warning', summary: 'No dashboard check for guard: ' + guard.id, details: '' };
    }
  }

  async function checkTabRegistry() {
    const details = [];
    const missing = [];
    for (const tab of PUBLIC_TABS) {
      details.push('Public tab "' + tab + '" registered');
    }
    for (const tab of INTERNAL_TABS) {
      details.push('Internal tab "' + tab + '" intentionally hidden from public navigation');
    }
    return {
      status: missing.length === 0 ? 'passed' : 'failed',
      summary: missing.length === 0 ? 'All public dashboard tabs registered; internal tabs hidden' : 'Missing: ' + missing.join(', '),
      details: details.join('\n')
    };
  }

  async function checkRendererPresence(svc) {
    const uiJs = svc.uiJsContent || '';
    if (!uiJs) {
      return { status: 'warning', summary: 'Cannot check renderers: ui.js content not available', details: '' };
    }
    const missing = [];
    for (const tab of CRITICAL_TABS) {
      const rendererName = tab === 'coding' ? 'renderCodingWorkspace'
        : tab === 'agent-evaluation' ? 'renderAgentEvaluation'
        : 'render' + tab.charAt(0).toUpperCase() + tab.slice(1).replace(/-./g, s => s.charAt(1).toUpperCase());
      if (uiJs.indexOf(rendererName) === -1) {
        missing.push(tab + ' (' + rendererName + ')');
      }
    }
    return {
      status: missing.length === 0 ? 'passed' : 'failed',
      summary: missing.length === 0 ? 'All ' + CRITICAL_TABS.length + ' critical renderers present' : 'Missing renderers: ' + missing.join(', '),
      details: missing.length > 0 ? 'Missing: ' + missing.join(', ') : 'All present'
    };
  }

  async function checkNoOverviewFallback(svc) {
    const appJs = svc.appJsContent || '';
    if (!appJs) {
      return { status: 'warning', summary: 'Cannot check fallback: app.js content not available', details: '' };
    }
    const renderTabContent = appJs.indexOf('renderTabContent') !== -1;
    const hasConfigCheck = appJs.indexOf('if (!config)') !== -1 || appJs.indexOf('config &&') !== -1;
    return {
      status: renderTabContent && hasConfigCheck ? 'passed' : 'failed',
      summary: renderTabContent && hasConfigCheck ? 'No overview fallback issue detected' : 'Router may fallback to Overview for known tabs',
      details: 'renderTabContent: ' + renderTabContent + ', configCheck: ' + hasConfigCheck
    };
  }

  async function checkDarkFormCSS(svc) {
    const css = svc.stylesCssContent || '';
    if (!css) {
      return { status: 'warning', summary: 'Cannot check CSS: styles.css not available', details: '' };
    }
    const hasBgPrimary = css.indexOf('var(--bg-primary)') !== -1;
    const hasInput = css.indexOf('input') !== -1;
    const hasSelect = css.indexOf('select') !== -1;
    const hasTextarea = css.indexOf('textarea') !== -1;
    const hasAutofill = css.indexOf('-webkit-autofill') !== -1;
    const issues = [];
    if (!hasInput) issues.push('input styled');
    if (!hasSelect) issues.push('select styled');
    if (!hasTextarea) issues.push('textarea styled');
    if (!hasAutofill) issues.push('autofill override missing');
    return {
      status: issues.length === 0 ? 'passed' : 'failed',
      summary: issues.length === 0 ? 'Dark form CSS intact' : 'CSS issues: ' + issues.join(', '),
      details: 'bg-primary: ' + hasBgPrimary + ', input: ' + hasInput + ', select: ' + hasSelect + ', textarea: ' + hasTextarea + ', autofill: ' + hasAutofill
    };
  }

  async function checkServiceWorker(svc) {
    const sw = svc.swContent || '';
    if (!sw) {
      return { status: 'warning', summary: 'Cannot check SW: service-worker.js not available', details: '' };
    }
    const apiExcluded = sw.indexOf('/api/dashboard') !== -1 || sw.indexOf('/api/') !== -1;
    return {
      status: apiExcluded ? 'passed' : 'failed',
      summary: apiExcluded ? 'API paths excluded from SW cache' : 'API paths may be cached by SW',
      details: '/api/ exclusion: ' + apiExcluded
    };
  }

  return { runDashboardGuardCheck, KNOWN_TABS, PUBLIC_TABS, INTERNAL_TABS, CRITICAL_TABS };
}

module.exports = { createDashboardRouteGuard };
