'use strict';

const STABLE_TABS = [
  'overview', 'ops', 'workspaces', 'users', 'permissions', 'memory', 'goals',
  'workflows', 'planner', 'executor', 'agents', 'tools', 'integrations',
  'backup', 'insights', 'graph', 'benchmarks', 'incidents', 'observability',
  'portfolio', 'research', 'lifeos', 'audit', 'commands', 'env', 'settings',
  'agent-evaluation', 'coding', 'release', 'routines', 'selfhealing',
  'monitoring', 'cicd', 'devgovernance', 'githubops', 'deploy', 'cost',
  'knowledge', 'telegram-control', 'operating-loop', 'improvement',
  'governance', 'security', 'privacy', 'release-candidate', 'production-release',
  'reliability', 'docs-intel', 'model-router', 'plugins', 'rag-kb', 'recipes'
];

function getMobileNavigationState(services) {
  return {
    tabs: [],
    bottomNav: buildBottomNavigationItems(services),
    groups: buildMobileTabGroups(services)
  };
}

function buildBottomNavigationItems(services) {
  return [
    { id: 'nav-overview', label: 'Overview', icon: 'home', tab: 'overview', href: '/dashboard?tab=overview', dataTab: 'overview' },
    { id: 'nav-agents', label: 'Agents', icon: 'bot', tab: 'agents', href: '/dashboard?tab=agents', dataTab: 'agents' },
    { id: 'nav-executor', label: 'Executor', icon: 'zap', tab: 'executor', href: '/dashboard?tab=executor', dataTab: 'executor' },
    { id: 'nav-integrations', label: 'Integrations', icon: 'grid', tab: 'integrations', href: '/dashboard?tab=integrations', dataTab: 'integrations' },
    { id: 'nav-coding', label: 'Coding', icon: 'code', tab: 'coding', href: '/dashboard?tab=coding', dataTab: 'coding' },
    { id: 'nav-search', label: 'Search', icon: 'search', tab: 'rag-kb', href: '/dashboard?tab=rag-kb', dataTab: 'rag-kb' },
    { id: 'nav-settings', label: 'Settings', icon: 'settings', tab: 'settings', href: '/dashboard?tab=settings', dataTab: 'settings' }
  ];
}

function buildMobileTabGroups(services) {
  return [
    {
      id: 'group-core',
      label: 'Core',
      tabs: ['overview', 'ops', 'workspaces', 'users', 'permissions', 'memory', 'goals', 'workflows']
    },
    {
      id: 'group-automation',
      label: 'Automation',
      tabs: ['planner', 'executor', 'agents', 'tools', 'integrations', 'routines', 'recipes']
    },
    {
      id: 'group-devops',
      label: 'DevOps',
      tabs: ['coding', 'release', 'cicd', 'devgovernance', 'githubops', 'deploy', 'monitoring']
    },
    {
      id: 'group-data',
      label: 'Data & Intelligence',
      tabs: ['insights', 'knowledge', 'rag-kb', 'research', 'docs-intel', 'model-router', 'plugins']
    },
    {
      id: 'group-reliability',
      label: 'Reliability & Security',
      tabs: ['security', 'privacy', 'reliability', 'selfhealing', 'backup', 'incidents', 'observability']
    },
    {
      id: 'group-lifeos',
      label: 'Life OS',
      tabs: ['lifeos', 'portfolio', 'goals', 'health', 'telegram-control']
    },
    {
      id: 'group-governance',
      label: 'Governance',
      tabs: ['governance', 'audit', 'permissions', 'compliance', 'cost']
    },
    {
      id: 'group-advanced',
      label: 'Advanced',
      tabs: ['operating-loop', 'improvement', 'agent-evaluation', 'release-candidate', 'production-release', 'benchmarks', 'graph']
    }
  ];
}

function validateMobileNavigationItems(items, services) {
  const errors = [];
  const seenIds = new Set();
  const seenTabs = new Set();
  for (const item of items) {
    if (!item) continue;
    if (seenIds.has(item.id)) {
      errors.push(`Duplicate navigation id: ${item.id}`);
    }
    seenIds.add(item.id);
    if (item.tab && seenTabs.has(item.tab)) {
      errors.push(`Duplicate tab in navigation: ${item.tab}`);
    }
    seenTabs.add(item.tab);
    if (item.href && !item.href.startsWith('/')) {
      errors.push(`Broken href for ${item.id}: must start with /`);
    }
    if (item.dataTab && item.tab && item.dataTab !== item.tab) {
      errors.push(`data-tab mismatch for ${item.id}: ${item.dataTab} !== ${item.tab}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function ensureKnownTabsHaveMobileRoutes(services) {
  const missing = [];
  for (const tab of STABLE_TABS) {
    const found = buildBottomNavigationItems(services).some(n => n.tab === tab) ||
      buildMobileTabGroups(services).some(g => g.tabs.includes(tab));
    if (!found) {
      missing.push(tab);
    }
  }
  return { allPresent: missing.length === 0, missing };
}

module.exports = {
  getMobileNavigationState,
  buildBottomNavigationItems,
  buildMobileTabGroups,
  validateMobileNavigationItems,
  ensureKnownTabsHaveMobileRoutes,
  STABLE_TABS
};
