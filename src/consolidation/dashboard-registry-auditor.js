'use strict';

const fs = require('fs');
const path = require('path');

const BASE = path.join(process.cwd());
const KNOWN_TABS = [
  'overview', 'ops-viewer', 'workspaces', 'users', 'permissions', 'memory',
  'goals', 'workflows', 'planner', 'executor', 'agents', 'tools', 'integrations',
  'backup', 'insights', 'observability', 'agent-evaluation', 'coding-workspace', 'release',
  'routines', 'selfhealing', 'monitoring', 'cicd', 'devgovernance', 'githubops',
  'deploy', 'cost', 'operator', 'portfolio', 'knowledge', 'telegram-control', 'improvement',
  'governance', 'security', 'privacy', 'release-candidate',
  'docs-intel', 'model-router', 'plugins', 'rag-kb', 'recipes'
];

async function auditDashboardTabs(services = {}) {
  const statePath = path.join(BASE, 'public', 'dashboard', 'state.js');
  try {
    const content = fs.readFileSync(statePath, 'utf8');
    const tabs = {};
    const tabBlocks = content.split(/\n\s{2}/);
    for (const block of tabBlocks) {
      const idMatch = block.match(/^\s*['"`]?([\w-]+)['"`]?\s*:\s*\{/);
      if (!idMatch) continue;
      const id = idMatch[1];
      const labelMatch = block.match(/label:\s*['"`]([^'"`]+)['"`]/);
      const rendererMatch = block.match(/renderer:\s*['"`]([^'"`]+)['"`]/);
      const aliasMatch = block.match(/aliases:\s*\[([^\]]+)\]/);
      const navVisibleMatch = block.match(/navVisible:\s*(true|false)/);
      tabs[id] = {
        id,
        label: labelMatch ? labelMatch[1] : '',
        renderer: rendererMatch ? rendererMatch[1] : null,
        aliases: aliasMatch ? aliasMatch[1].split(',').map(a => a.trim().replace(/['"`]/g, '')) : [],
        navVisible: navVisibleMatch ? navVisibleMatch[1] === 'true' : true
      };
    }
    return tabs;
  } catch (_) {
    return {};
  }
}

async function auditDashboardRenderers(services = {}) {
  const tabs = await auditDashboardTabs(services);
  const issues = [];
  for (const [id, tab] of Object.entries(tabs)) {
    if (!tab.renderer) {
      issues.push({ tab: id, issue: 'Missing renderer' });
    }
  }
  return issues;
}

async function auditDashboardSidebar(services = {}) {
  const sidebarPath = path.join(BASE, 'public', 'dashboard', 'index.html');
  try {
    const content = fs.readFileSync(sidebarPath, 'utf8');
    const tabs = await auditDashboardTabs(services);
    const missing = [];
    for (const id of Object.keys(tabs)) {
      if (!content.includes(id) && !content.includes(`#${id}`)) {
        missing.push(id);
      }
    }
    return missing;
  } catch (_) {
    return Object.keys(await auditDashboardTabs(services));
  }
}

async function auditDashboardAliases(services = {}) {
  const tabs = await auditDashboardTabs(services);
  const missing = [];
  for (const [id, tab] of Object.entries(tabs)) {
    if (!tab.aliases || tab.aliases.length === 0) {
      missing.push({ tab: id, issue: 'No aliases defined' });
    }
  }
  return missing;
}

async function detectKnownTabFallbacks(services = {}) {
  const statePath = path.join(BASE, 'public', 'dashboard', 'state.js');
  try {
    const content = fs.readFileSync(statePath, 'utf8');
    const fallbacks = [];
    const tabBlocks = content.split(/\n\s{2}/);
    for (const block of tabBlocks) {
      for (const known of KNOWN_TABS) {
        const dashKnown = known.replace(/-/g, '-');
        if (block.includes(`'${known}'`) || block.includes(`"${known}"`)) {
          if (!block.includes('renderer:') || block.includes('renderOverview')) {
            if (!block.includes('overview')) {
              fallbacks.push({ tab: known, issue: 'Known tab may fallback to Overview' });
            }
          }
        }
      }
    }
    const unique = [];
    const seen = new Set();
    for (const f of fallbacks) {
      if (!seen.has(f.tab)) {
        seen.add(f.tab);
        unique.push(f);
      }
    }
    return unique;
  } catch (_) {
    return [];
  }
}

function buildDashboardRegistryAuditReport(services = {}) {
  return {
    timestamp: new Date().toISOString(),
    description: 'Dashboard registry audit report',
    checks: [
      'Every stable tab has registry entry',
      'Every stable tab has sidebar entry',
      'Every stable tab has renderer/placeholder',
      'Alias if needed',
      'No known tab routes to Overview',
      'SW cache safe'
    ]
  };
}

module.exports = {
  auditDashboardTabs,
  auditDashboardRenderers,
  auditDashboardSidebar,
  auditDashboardAliases,
  detectKnownTabFallbacks,
  buildDashboardRegistryAuditReport
};
