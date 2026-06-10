'use strict';

const { createUnifiedItem } = require('./unified-registry-contract');

const STABLE_TABS = [
  { id: 'overview', title: 'Overview', href: '/overview', dataTab: 'overview', rendererName: 'overview', apiEndpoint: '/api/v2/overview', aliases: [], group: 'core', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['overview', 'summary'], fallbackMode: 'static', enabled: true },
  { id: 'agents', title: 'Agents', href: '/agents', dataTab: 'agents', rendererName: 'agents', apiEndpoint: '/api/v2/agents', aliases: ['agent-list'], group: 'core', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['agents', 'bots'], fallbackMode: 'empty', enabled: true },
  { id: 'executor', title: 'Executor', href: '/executor', dataTab: 'executor', rendererName: 'executor', apiEndpoint: '/api/v2/executor', aliases: [], group: 'core', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['executor', 'runtime'], fallbackMode: 'empty', enabled: true },
  { id: 'integrations', title: 'Integrations', href: '/integrations', dataTab: 'integrations', rendererName: 'integrations', apiEndpoint: '/api/v2/integrations', aliases: ['integration-hub'], group: 'core', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['integrations', 'connectors'], fallbackMode: 'empty', enabled: true },
  { id: 'coding', title: 'Coding', href: '/coding', dataTab: 'coding', rendererName: 'coding', apiEndpoint: '/api/v2/coding', aliases: ['code-gen'], group: 'core', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['coding', 'code generation'], fallbackMode: 'empty', enabled: true },
  { id: 'routines', title: 'Routines', href: '/routines', dataTab: 'routines', rendererName: 'routines', apiEndpoint: '/api/v2/routines', aliases: [], group: 'automation', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['routines', 'automation'], fallbackMode: 'empty', enabled: true },
  { id: 'selfhealing', title: 'Self Healing', href: '/selfhealing', dataTab: 'selfhealing', rendererName: 'selfhealing', apiEndpoint: '/api/v2/selfhealing', aliases: ['auto-heal'], group: 'automation', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['self healing', 'recovery'], fallbackMode: 'static', enabled: true },
  { id: 'monitoring', title: 'Monitoring', href: '/monitoring', dataTab: 'monitoring', rendererName: 'monitoring', apiEndpoint: '/api/v2/monitoring', aliases: [], group: 'ops', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['monitoring', 'metrics'], fallbackMode: 'empty', enabled: true },
  { id: 'cicd', title: 'CI/CD', href: '/cicd', dataTab: 'cicd', rendererName: 'cicd', apiEndpoint: '/api/v2/cicd', aliases: ['ci-cd'], group: 'ops', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['ci', 'cd', 'pipeline'], fallbackMode: 'empty', enabled: true },
  { id: 'githubops', title: 'GitHub Ops', href: '/githubops', dataTab: 'githubops', rendererName: 'githubops', apiEndpoint: '/api/v2/githubops', aliases: ['gh-ops'], group: 'ops', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['github', 'pr', 'actions'], fallbackMode: 'empty', enabled: true },
  { id: 'deploy', title: 'Deploy', href: '/deploy', dataTab: 'deploy', rendererName: 'deploy', apiEndpoint: '/api/v2/deploy', aliases: ['deployment'], group: 'ops', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['deploy', 'deployment'], fallbackMode: 'empty', enabled: true },
  { id: 'observability', title: 'Observability', href: '/observability', dataTab: 'observability', rendererName: 'observability', apiEndpoint: '/api/v2/observability', aliases: [], group: 'ops', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['logs', 'traces', 'metrics'], fallbackMode: 'empty', enabled: true },
  { id: 'cost', title: 'Cost', href: '/cost', dataTab: 'cost', rendererName: 'cost', apiEndpoint: '/api/v2/cost', aliases: ['costs', 'billing'], group: 'business', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['cost', 'billing'], fallbackMode: 'static', enabled: true },
  { id: 'operator', title: 'Operator', href: '/operator', dataTab: 'operator', rendererName: 'operator', apiEndpoint: '/api/v2/operator', aliases: ['admin-panel'], group: 'business', stable: true, publicVisible: false, mobileVisible: false, expectedContentKeywords: ['operator', 'admin'], fallbackMode: 'empty', enabled: true },
  { id: 'portfolio', title: 'Portfolio', href: '/portfolio', dataTab: 'portfolio', rendererName: 'portfolio', apiEndpoint: '/api/v2/portfolio', aliases: [], group: 'business', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['portfolio', 'projects'], fallbackMode: 'empty', enabled: true },
  { id: 'knowledge', title: 'Knowledge', href: '/knowledge', dataTab: 'knowledge', rendererName: 'knowledge', apiEndpoint: '/api/v2/knowledge', aliases: ['kb', 'wiki'], group: 'business', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['knowledge', 'docs'], fallbackMode: 'empty', enabled: true },
  { id: 'lifeos', title: 'Life OS', href: '/lifeos', dataTab: 'lifeos', rendererName: 'lifeos', apiEndpoint: '/api/v2/lifeos', aliases: ['life-os'], group: 'business', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['life os', 'personal'], fallbackMode: 'empty', enabled: true },
  { id: 'telegram-control', title: 'Telegram Control', href: '/telegram-control', dataTab: 'telegram-control', rendererName: 'telegram-control', apiEndpoint: '/api/v2/telegram-control', aliases: ['tg-control', 'telegram'], group: 'core', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['telegram', 'bot control'], fallbackMode: 'empty', enabled: true },
  { id: 'operating-loop', title: 'Operating Loop', href: '/operating-loop', dataTab: 'operating-loop', rendererName: 'operating-loop', apiEndpoint: '/api/v2/operating-loop', aliases: ['op-loop'], group: 'core', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['operating loop', 'cycle'], fallbackMode: 'static', enabled: true },
  { id: 'improvement', title: 'Improvement', href: '/improvement', dataTab: 'improvement', rendererName: 'improvement', apiEndpoint: '/api/v2/improvement', aliases: ['improvements'], group: 'automation', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['improvement', 'optimization'], fallbackMode: 'empty', enabled: true },
  { id: 'governance', title: 'Governance', href: '/governance', dataTab: 'governance', rendererName: 'governance', apiEndpoint: '/api/v2/governance', aliases: [], group: 'business', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['governance', 'policies'], fallbackMode: 'empty', enabled: true },
  { id: 'security', title: 'Security', href: '/security', dataTab: 'security', rendererName: 'security', apiEndpoint: '/api/v2/security', aliases: ['sec'], group: 'business', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['security', 'audit'], fallbackMode: 'empty', enabled: true },
  { id: 'privacy', title: 'Privacy', href: '/privacy', dataTab: 'privacy', rendererName: 'privacy', apiEndpoint: '/api/v2/privacy', aliases: [], group: 'business', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['privacy', 'gdpr'], fallbackMode: 'static', enabled: true },
  { id: 'release-candidate', title: 'Release Candidate', href: '/release-candidate', dataTab: 'release-candidate', rendererName: 'release-candidate', apiEndpoint: '/api/v2/release-candidate', aliases: ['rc'], group: 'ops', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['release candidate', 'rc'], fallbackMode: 'empty', enabled: true },
  { id: 'production-release', title: 'Production Release', href: '/production-release', dataTab: 'production-release', rendererName: 'production-release', apiEndpoint: '/api/v2/production-release', aliases: ['prod-release'], group: 'ops', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['production', 'release'], fallbackMode: 'empty', enabled: true },
  { id: 'reliability', title: 'Reliability', href: '/reliability', dataTab: 'reliability', rendererName: 'reliability', apiEndpoint: '/api/v2/reliability', aliases: ['sre'], group: 'ops', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['reliability', 'sla'], fallbackMode: 'empty', enabled: true },
  { id: 'research', title: 'Research', href: '/research', dataTab: 'research', rendererName: 'research', apiEndpoint: '/api/v2/research', aliases: ['rnd'], group: 'business', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['research', 'r&d'], fallbackMode: 'empty', enabled: true },
  { id: 'docs-intel', title: 'Docs Intel', href: '/docs-intel', dataTab: 'docs-intel', rendererName: 'docs-intel', apiEndpoint: '/api/v2/docs-intel', aliases: ['documentation-intel'], group: 'business', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['docs', 'documentation'], fallbackMode: 'empty', enabled: true },
  { id: 'model-router', title: 'Model Router', href: '/model-router', dataTab: 'model-router', rendererName: 'model-router', apiEndpoint: '/api/v2/model-router', aliases: ['router'], group: 'core', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['model', 'router', 'llm'], fallbackMode: 'empty', enabled: true },
  { id: 'plugins', title: 'Plugins', href: '/plugins', dataTab: 'plugins', rendererName: 'plugins', apiEndpoint: '/api/v2/plugins', aliases: ['extensions'], group: 'core', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['plugins', 'extensions'], fallbackMode: 'empty', enabled: true },
  { id: 'recipes', title: 'Recipes', href: '/recipes', dataTab: 'recipes', rendererName: 'recipes', apiEndpoint: '/api/v2/recipes', aliases: [], group: 'core', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['recipes', 'templates'], fallbackMode: 'empty', enabled: true },
  { id: 'mobile', title: 'Mobile', href: '/mobile', dataTab: 'mobile', rendererName: 'mobile', apiEndpoint: '/api/v2/mobile', aliases: ['mobile-view'], group: 'core', stable: true, publicVisible: true, mobileVisible: true, expectedContentKeywords: ['mobile'], fallbackMode: 'empty', enabled: true },
  { id: 'disaster-recovery', title: 'Disaster Recovery', href: '/disaster-recovery', dataTab: 'disaster-recovery', rendererName: 'disaster-recovery', apiEndpoint: '/api/v2/disaster-recovery', aliases: ['dr'], group: 'ops', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['disaster', 'recovery', 'dr'], fallbackMode: 'static', enabled: true },
  { id: 'consolidation', title: 'Consolidation', href: '/consolidation', dataTab: 'consolidation', rendererName: 'consolidation', apiEndpoint: '/api/v2/consolidation', aliases: ['consolidate'], group: 'ops', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['consolidation'], fallbackMode: 'empty', enabled: true },
  { id: 'stabilization', title: 'Stabilization', href: '/stabilization', dataTab: 'stabilization', rendererName: 'stabilization', apiEndpoint: '/api/v2/stabilization', aliases: ['stabilize'], group: 'ops', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['stabilization', 'stability'], fallbackMode: 'empty', enabled: true },
  { id: 'v2-planning', title: 'V2 Planning', href: '/v2-planning', dataTab: 'v2-planning', rendererName: 'v2-planning', apiEndpoint: '/api/v2/v2-planning', aliases: ['v2-plan'], group: 'business', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['v2', 'planning'], fallbackMode: 'empty', enabled: true },
  { id: 'registry-v2', title: 'Registry V2', href: '/registry-v2', dataTab: 'registry-v2', rendererName: 'registry-v2', apiEndpoint: '/api/v2/registry-v2', aliases: ['registry'], group: 'core', stable: true, publicVisible: true, mobileVisible: false, expectedContentKeywords: ['registry', 'v2'], fallbackMode: 'empty', enabled: true }
];

function buildDashboardTabRegistryV2(services) {
  return STABLE_TABS.map(tab => createUnifiedItem({
    ...tab,
    type: 'dashboard_tab',
    module: 'dashboard-tab-registry-v2',
    ownerModule: 'registry-v2'
  }));
}

function normalizeDashboardTabsFromLegacy(services) {
  if (services && services.legacyDashboardRegistry) {
    const legacy = services.legacyDashboardRegistry;
    return STABLE_TABS.map(tab => {
      const legacyTab = legacy.find(l => l.id === tab.id);
      return legacyTab ? { ...tab, ...legacyTab, stable: true } : tab;
    });
  }
  return [...STABLE_TABS];
}

function validateDashboardTabRegistryV2(registry, services) {
  const errors = [];
  if (!Array.isArray(registry)) return ['registry must be an array'];
  const ids = new Set();
  for (const tab of registry) {
    if (!tab.id) errors.push('tab missing id');
    if (!tab.title) errors.push(`tab ${tab.id || 'unknown'} missing title`);
    if (!tab.href) errors.push(`tab ${tab.id} missing href`);
    if (!tab.rendererName) errors.push(`tab ${tab.id} missing rendererName`);
    if (ids.has(tab.id)) errors.push(`duplicate tab id: ${tab.id}`);
    ids.add(tab.id);
  }
  return errors;
}

function getDashboardTabByAlias(alias, services) {
  for (const tab of STABLE_TABS) {
    if (tab.id === alias || tab.aliases.includes(alias)) return tab;
  }
  return null;
}

function generateSidebarFromRegistry(registry, services) {
  const groups = {};
  for (const tab of registry) {
    if (!tab.enabled) continue;
    const g = tab.group || 'ungrouped';
    if (!groups[g]) groups[g] = [];
    groups[g].push({
      id: tab.id,
      title: tab.title,
      href: tab.href,
      publicVisible: tab.publicVisible,
      stable: tab.stable
    });
  }
  return groups;
}

function generateMobileNavigationFromRegistry(registry, services) {
  return registry
    .filter(tab => tab.enabled && tab.mobileVisible)
    .map(tab => ({
      id: tab.id,
      title: tab.title,
      href: tab.href
    }));
}

module.exports = {
  STABLE_TABS,
  buildDashboardTabRegistryV2,
  normalizeDashboardTabsFromLegacy,
  validateDashboardTabRegistryV2,
  getDashboardTabByAlias,
  generateSidebarFromRegistry,
  generateMobileNavigationFromRegistry
};
