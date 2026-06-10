/* Dashboard lightweight state store + tab registry */

const DASHBOARD_TABS = {
  overview: {
    label: 'Overview',
    title: 'System Overview',
    navIcon: '📊',
    navVisible: true,
    aliases: ['home', 'system-overview', 'system_overview'],
    renderer: 'renderOverview'
  },
  ops: {
    label: 'Ops Viewer',
    title: 'Ops Viewer',
    navIcon: '⚙️',
    navVisible: true,
    aliases: ['ops-viewer', 'opsviewer', 'ops_viewer', 'opsview'],
    renderer: 'renderOps'
  },
  workspaces: {
    label: 'Workspaces',
    title: 'Workspaces',
    navIcon: '🏢',
    navVisible: true,
    aliases: ['workspace', 'beranda'],
    renderer: 'renderWorkspaces'
  },
  users: {
    label: 'Users',
    title: 'Users',
    navIcon: '👥',
    navVisible: true,
    aliases: ['user', 'pengguna'],
    renderer: 'renderUsers'
  },
  permissions: {
    label: 'Permissions',
    title: 'Permissions',
    navIcon: '🛡️',
    navVisible: true,
    aliases: ['permission', 'izin'],
    renderer: 'renderPermissions'
  },
  memory: {
    label: 'Memory',
    title: 'Memory Records',
    navIcon: '🧠',
    navVisible: true,
    aliases: ['memories', 'memori'],
    renderer: 'renderMemory'
  },
  goals: {
    label: 'Goals',
    title: 'Goals',
    navIcon: '🎯',
    navVisible: true,
    aliases: ['goal', 'tujuan'],
    renderer: 'renderGoals'
  },
  workflows: {
    label: 'Workflows',
    title: 'Workflows',
    navIcon: '🔄',
    navVisible: true,
    aliases: ['workflow', 'alur'],
    renderer: 'renderWorkflows'
  },
  planner: {
    label: 'Planner',
    title: 'Planner',
    navIcon: '🗺️',
    navVisible: true,
    aliases: ['plans', 'plan', 'perencana'],
    renderer: 'renderPlanner'
  },
  executor: {
    label: 'Executor',
    title: 'Executor',
    navIcon: '✅',
    navVisible: true,
    aliases: ['executions', 'eksekusi', 'eksekutor'],
    renderer: 'renderExecutor'
  },
  agents: {
    label: 'Agents',
    title: 'Agents / Multi-Bot',
    navIcon: '🤖',
    navVisible: true,
    aliases: ['agent', 'multibot', 'multi-bot', 'agen'],
    renderer: 'renderAgents'
  },
  tools: {
    label: 'Tools',
    title: 'Tools',
    navIcon: '🧰',
    navVisible: true,
    aliases: ['tool', 'tool-registry', 'alat'],
    renderer: 'renderTools'
  },
  integrations: {
    label: 'Integrations',
    title: 'External Integrations',
    navIcon: '🔌',
    navVisible: true,
    aliases: ['integration', 'integrasi'],
    renderer: 'renderIntegrations'
  },
  backup: {
    label: 'Backup',
    title: 'Backup & Recovery',
    navIcon: '💾',
    navVisible: true,
    aliases: ['backups', 'cadangan'],
    renderer: 'renderBackup'
  },
  insights: {
    label: 'Insights',
    title: 'Cognitive Insights',
    navIcon: '💡',
    navVisible: true,
    aliases: ['insight', 'wawasan'],
    renderer: 'renderInsights'
  },
  graph: {
    label: 'Knowledge Graph',
    title: 'Knowledge Graph',
    navIcon: '🕸️',
    navVisible: true,
    aliases: ['kgraph', 'graf'],
    renderer: 'renderGraph'
  },
  benchmarks: {
    label: 'Benchmarks',
    title: 'Benchmarks Audit',
    navIcon: '⚡',
    navVisible: true,
    aliases: ['benchmark', 'tolok-ukur'],
    renderer: 'renderBenchmarks'
  },
  incidents: {
    label: 'Incidents',
    title: 'Incidents Log',
    navIcon: '⚠️',
    navVisible: true,
    aliases: ['incident', 'kejadian', 'insiden'],
    renderer: 'renderIncidents'
  },
  observability: {
    label: 'Observability',
    title: 'Observability / Incidents',
    navIcon: '🛰️',
    navVisible: true,
    aliases: ['incident-center', 'prod-monitor', 'health-monitor', 'observability-center'],
    renderer: 'renderObservability'
  },
  portfolio: {
    label: 'Portfolio',
    title: 'Portfolio',
    navIcon: '📚',
    navVisible: true,
    aliases: ['projects', 'multi-project', 'priority', 'portfolio-manager', 'roadmap-manager'],
    renderer: 'renderPortfolio'
  },
  research: {
    label: 'Research / Docs',
    title: 'Research / Docs',
    navIcon: '🔎',
    navVisible: true,
    aliases: ['research-agent', 'evidence', 'sources', 'web-research', 'riset'],
    renderer: 'renderResearch'
  },
  lifeos: {
    label: 'Life OS',
    title: 'Life OS',
    navIcon: '🌱',
    navVisible: true,
    aliases: ['life', 'personal', 'productivity', 'daily', 'habits', 'focus', 'reminders'],
    renderer: 'renderLifeOS'
  },
  audit: {
    label: 'Audit Log',
    title: 'Audit Log',
    navIcon: '🧾',
    navVisible: true,
    aliases: ['audit-log', 'auditlog', 'catatan'],
    renderer: 'renderAuditLog'
  },
  commands: {
    label: 'Commands',
    title: 'Command Catalog',
    navIcon: '📜',
    navVisible: true,
    aliases: ['command', 'perintah'],
    renderer: 'renderCommands'
  },
  env: {
    label: 'Env Check',
    title: 'Environment Check',
    navIcon: '🔒',
    navVisible: true,
    aliases: ['env-check', 'environment', 'lingkungan'],
    renderer: 'renderEnv'
  },
  settings: {
    label: 'Settings',
    title: 'Settings Control',
    navIcon: '🔧',
    navVisible: true,
    aliases: ['setting', 'pengaturan'],
    renderer: 'renderSettings'
  },
  'agent-evaluation': {
    label: 'Agent Evaluation',
    title: 'Agent Evaluation',
    navIcon: '📊',
    navVisible: true,
    aliases: ['agent-eval', 'eval', 'evaluation', 'agent_evaluation'],
    renderer: 'renderAgentEvaluation'
  },
  'coding': {
    label: 'Coding Workspace',
    title: 'Coding Workspace',
    navIcon: '💻',
    navVisible: true,
    aliases: ['coding-workspace', 'codingworkspace', 'coding_workspace', 'codingWorkspace', 'code-workspace', 'coding-ws'],
    renderer: 'renderCodingWorkspace'
  },
  release: {
    label: 'Release',
    title: 'Release / Health',
    navIcon: '🚀',
    navVisible: true,
    aliases: ['release-health', 'releasecheck', 'release-check', 'health-release', 'rilis'],
    renderer: 'renderRelease'
  },
  routines: {
    label: 'Routines',
    title: 'Routine Center',
    navIcon: '⏰',
    navVisible: true,
    routeEnabled: true,
    internalOnly: false,
    aliases: ['routine', 'routine-center', 'daily-ops', 'rutinitas'],
    renderer: 'renderRoutines'
  },
  selfhealing: {
    label: 'Self-Healing',
    title: 'Self-Healing & Regression Guard',
    navIcon: '🛡️',
    navVisible: true,
    aliases: ['self-healing', 'regression-guard', 'regressionguard', 'repair', 'repair-planner', 'health'],
    renderer: 'renderSelfHealing'
  },
  monitoring: {
    label: 'Monitoring',
    title: 'Real-Time Monitoring',
    navIcon: '📡',
    navVisible: true,
    aliases: ['monitor', 'realtime', 'realtime-monitoring', 'realtime_monitoring'],
    renderer: 'renderMonitoring'
  },
  cicd: {
    label: 'CI/CD',
    title: 'CI/CD Pipeline',
    navIcon: '🔄',
    navVisible: true,
    aliases: ['ci-cd', 'cicd', 'pipeline', 'deploy-pipeline'],
    renderer: 'renderCicd'
  },
  devgovernance: {
    label: 'Dev Governance',
    title: 'Dev Governance',
    navIcon: '🏛️',
    navVisible: true,
    aliases: ['devgov', 'dev-governance', 'dev_governance'],
    renderer: 'renderDevGovernance'
  },
  githubops: {
    label: 'GitHub Ops',
    title: 'GitHub Ops Pipeline',
    navIcon: '🐙',
    navVisible: true,
    aliases: ['github-ops', 'githubops', 'ghops', 'gh-ops'],
    renderer: 'renderGithubOps'
  },
  deploy: {
    label: 'Deploy / Release',
    title: 'Deploy & Release Manager',
    navIcon: '🚀',
    navVisible: true,
    aliases: ['deployment', 'release-manager', 'render', 'rollback', 'release-control'],
    renderer: 'renderDeploy'
  },
  cost: {
    label: 'Cost / Budget',
    title: 'Cost, Token & Budget Governance',
    navIcon: '💰',
    navVisible: true,
    aliases: ['token', 'tokens', 'budget', 'usage', 'model-usage', 'cost-governance', 'biaya'],
    renderer: 'renderCost'
  },
  knowledge: {
    label: 'Knowledge',
    title: 'Project Knowledge Graph & Memory',
    navIcon: '🕸️',
    navVisible: true,
    aliases: ['memory-graph', 'knowledge-graph', 'project-memory', 'decisions', 'long-memory', 'project-knowledge'],
    renderer: 'renderKnowledge'
  },
  'telegram-control': {
    label: 'Telegram Control',
    title: 'Telegram Control Panel',
    navIcon: '📡',
    navVisible: true,
    aliases: ['telegram', 'command-center', 'bot-control', 'telegram-menu'],
    renderer: 'renderTelegramControl'
  },
  'operating-loop': {
    label: 'Operating Loop',
    title: 'Operating Loop',
    navIcon: '🔄',
    navVisible: true,
    aliases: ['loop', 'ai-os-loop', 'daily-loop', 'ops-loop', 'autonomous-loop'],
    renderer: 'renderOperatingLoop'
  },
  'improvement': {
    label: 'Improvement',
    title: 'Continuous Improvement & Learning',
    navIcon: '📈',
    navVisible: true,
    aliases: ['feedback', 'learning', 'continuous-improvement', 'lessons', 'quality-loop', 'regressions', 'ci'],
    renderer: 'renderImprovement'
  },
  governance: {
    label: 'Governance',
    title: 'Unified Governance Policy & Capability Control',
    navIcon: '🛡️',
    navVisible: true,
    aliases: ['policy', 'policies', 'safety', 'capability', 'capability-center', 'control-policy', 'kebijakan', 'tata-kelola'],
    renderer: 'renderGovernance'
  },
  security: {
    label: 'Security',
    title: 'Security Hardening & Red-Team Audit',
    navIcon: '🔐',
    navVisible: true,
    aliases: ['security-center', 'secrets', 'redteam', 'security-audit', 'hardening', 'keamanan'],
    renderer: 'renderSecurity'
  },
  privacy: {
    label: 'Privacy',
    title: 'Privacy, Data Retention & Export Control',
    navIcon: '🔏',
    navVisible: true,
    aliases: ['data-privacy', 'retention', 'export', 'data-control', 'privacy-center', 'data-inventory', 'privasi'],
    renderer: 'renderPrivacy'
  },
  'release-candidate': {
    label: 'Release Candidate',
    title: 'Release Candidate Manager',
    navIcon: '🚀',
    navVisible: true,
    aliases: ['rc', 'stable-release', 'v1', 'release-v1', 'production-ready', 'rilis-kandidat'],
    renderer: 'renderReleaseCandidate'
  },
  'production-release': {
    label: 'Production Release',
    title: 'Production Release Manager',
    navIcon: '🏭',
    navVisible: true,
    aliases: ['pr', 'prod-release', 'production', 'v1-release', 'release-plan', 'rilis-produksi'],
    renderer: 'renderProductionRelease'
  },
  'reliability': {
    label: 'Reliability',
    title: 'Reliability & SLO Monitor',
    navIcon: '📊',
    navVisible: true,
    aliases: ['slo', 'uptime', 'health-window', 'post-release', 'reliability-score', 'keandalan'],
    renderer: 'renderReliability'
  },
  'docs-intel': {
    label: 'Docs Intel',
    title: 'Documentation Intelligence',
    navIcon: '📝',
    navVisible: true,
    aliases: ['docs', 'documentation', 'docs-intel', 'docscheck', 'documentation-intelligence', 'docs-intelligence', 'dokumentasi'],
    renderer: 'renderDocsIntel'
  },
  'model-router': {
    label: 'Model Router',
    title: 'Hybrid Local/Cloud AI Model Router',
    navIcon: '🌐',
    navVisible: true,
    aliases: ['models', 'model-router', 'local-ai', 'cloud-ai', 'ai-router', 'hybrid-ai', 'router-model'],
    renderer: 'renderModelRouter'
  },
  'plugins': {
    label: 'Plugins',
    title: 'Plugin / Connector SDK',
    navIcon: '🔌',
    navVisible: true,
    aliases: ['plugin', 'connectors', 'connector', 'plugin-sdk', 'plugin_sdk', 'pasang'],
    renderer: 'renderPlugins'
  },
  'operator': {
    label: 'Operator',
    title: 'Project Operator',
    navIcon: '🤖',
    navVisible: true,
    aliases: ['project-operator', 'project-ops', 'semi-autonomous', 'project-delivery', 'goal-operator', 'operator-panel'],
    renderer: 'renderOperator'
  },
  'mobile': {
    label: 'Mobile',
    title: 'Mobile / PWA UX',
    navIcon: '📱',
    navVisible: true,
    aliases: ['mobile', 'pwa', 'offline', 'ux', 'mobile-ux', 'notifications', 'hp', 'ponsel'],
    renderer: 'renderMobile'
  },
  'disaster-recovery': {
    label: 'DR',
    title: 'Disaster Recovery',
    navIcon: '🛟',
    navVisible: true,
    aliases: ['disaster-recovery', 'dr', 'recovery', 'restore', 'backup-encryption', 'restore-rehearsal', 'bencana'],
    renderer: 'renderDisasterRecovery'
  },
  'consolidation': {
    label: 'Consolidation',
    title: 'Architecture Consolidation',
    navIcon: '🏗️',
    navVisible: true,
    aliases: ['consolidation', 'architecture', 'v2', 'v2-roadmap', 'registry-audit', 'module-audit', 'arsitektur'],
    renderer: 'renderConsolidation'
  },
  'rag-kb': {
    label: 'RAG / KB',
    title: 'Personal Knowledge Search & RAG',
    navIcon: '📚',
    navVisible: true,
    aliases: ['rag', 'kb', 'knowledge-base', 'vector-search', 'semantic-search', 'dokumen', 'dokumen-search', 'knowledge-search', 'knowledge_search'],
    renderer: 'renderRagKb'
  },
  'recipes': {
    label: 'Recipes',
    title: 'Automation Recipe Builder',
    navIcon: '⚡',
    navVisible: true,
    aliases: ['recipe', 'automation', 'workflow-automation', 'recipe-builder', 'resep'],
    renderer: 'renderRecipes'
  },
  'stabilization': {
    label: 'Stabilization',
    title: 'V1 Final Stabilization',
    navIcon: '🔒',
    navVisible: true,
    aliases: ['stabilization', 'v1-stabilization', 'stabilize', 'final-lock', 'v1lock'],
    renderer: 'renderStabilization'
  },
  'v2-planning': {
    label: 'V2 Planning',
    title: 'AI OS v2 Planning Gate',
    navIcon: '📋',
    navVisible: true,
    aliases: ['v2-planning', 'v2planning', 'v2-gate', 'v2gate', 'v2-scope', 'v2scope'],
    renderer: 'renderV2Planning'
  },
  'registry-v2': {
    label: 'Registry v2',
    title: 'Registry Normalization v2',
    navIcon: '📋',
    navVisible: true,
    aliases: ['registry-v2', 'registryv2', 'registry', 'normalization', 'tab-registry', 'command-registry', 'capability-registry'],
    renderer: 'renderRegistryV2'
  },
  'boundary': {
    label: 'Boundaries',
    title: 'Storage & Module Boundary',
    navIcon: '🧱',
    navVisible: true,
    aliases: ['boundary', 'boundaries', 'storage-boundary', 'module-boundary', 'env-contract', 'module-map'],
    renderer: 'renderBoundary'
  },
  'performance': {
    label: 'Performance',
    title: 'Performance Optimization',
    navIcon: '⚡',
    navVisible: true,
    aliases: ['performance', 'perf', 'optimization', 'speed', 'startup', 'bundle', 'payload'],
    renderer: 'renderPerformance'
  },
  'v2-release': {
    label: 'V2 Release',
    title: 'AI OS v2 Release Candidate',
    navIcon: '🚀',
    navVisible: true,
    aliases: ['v2-release', 'v2-rc', 'v2rc', 'ai-os-v2', 'release-v2', 'v2-readiness'],
    renderer: 'renderV2Release'
  },
  'v2-stabilization': {
    label: 'V2 Stabilization',
    title: 'V2 RC Stabilization Audit',
    navIcon: '🔒',
    navVisible: true,
    aliases: ['v2-stabilization', 'v2-rc-stabilization', 'rc-stabilization', 'v2-rc-audit', 'rc-audit'],
    renderer: 'renderV2Stabilization'
  },
  'v2-production': {
    label: 'V2 Production',
    title: 'AI OS v2 Production Release',
    navIcon: '🏭',
    navVisible: true,
    aliases: ['v2-production', 'production-v2', 'release-v2-production', 'v2-rollout', 'v2-deploy-plan'],
    renderer: 'renderV2Production'
  },
  'post-v2': {
    label: 'Post-v2 Watch',
    title: 'Post-v2 Reliability & Regression Watch',
    navIcon: '👁️',
    navVisible: true,
    aliases: ['post-v2', 'post-v2-watch', 'v2-monitoring', 'v2-reliability', 'v2-regression-watch'],
    renderer: 'renderPostV2'
  },
  'plugin-hardening': {
    label: 'Plugin Hardening',
    title: 'Plugin Ecosystem Hardening',
    navIcon: '🔌',
    navVisible: true,
    aliases: ['plugin-security', 'plugin-certification', 'connector-hardening', 'plugin-health'],
    renderer: 'renderPluginHardening'
  },
  'rag-quality': {
    label: 'RAG Quality',
    title: 'RAG Quality & Memory Intelligence',
    navIcon: '📚',
    navVisible: true,
    aliases: ['memory-intelligence', 'memory-quality', 'retrieval-quality', 'citations', 'hallucination-guard'],
    renderer: 'renderRagQuality'
  },
  'agent-runtime': {
    label: 'Agent Runtime',
    title: 'Agent Runtime Optimization & Model Strategy',
    navIcon: '⚡',
    navVisible: true,
    aliases: ['agent-optimization', 'model-strategy', 'model-routing-v2', 'agent-performance', 'model-budget'],
    renderer: 'renderAgentRuntime'
  }
};

const DashboardState = (() => {
  const listeners = new Set();
  const state = {
    activeTab: 'overview',
    currentUserId: localStorage.getItem('last_user_id') || '',
    preferences: loadUserPreferences()
  };

  function notify() {
    const snapshot = getState();
    listeners.forEach(listener => {
      try { listener(snapshot); } catch (_) {}
    });
  }

  function getState() {
    return {
      ...state,
      preferences: { ...(state.preferences || {}) }
    };
  }

  function setState(patch = {}) {
    Object.assign(state, patch || {});
    notify();
    return getState();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function setActiveTab(tab) {
    const canonical = normalizeCanonicalTabId(tab);
    if (canonical) {
      localStorage.setItem('dashboard_last_tab', canonical);
    }
    return setState({ activeTab: String(canonical || 'overview') });
  }

  function setCurrentUserId(userId) {
    const clean = String(userId || '').trim();
    if (clean) localStorage.setItem('last_user_id', clean);
    return setState({ currentUserId: clean });
  }

  function saveUserPreferences(preferences = {}) {
    const next = { ...(state.preferences || {}), ...(preferences || {}) };
    state.preferences = next;
    try { localStorage.setItem('dashboard_preferences', JSON.stringify(next)); } catch (_) {}
    notify();
    return next;
  }

  function loadUserPreferences() {
    try {
      const parsed = JSON.parse(localStorage.getItem('dashboard_preferences') || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function isPublicRoutableTab(tabId) {
    const config = DASHBOARD_TABS[tabId];
    return Boolean(config && config.navVisible !== false && config.routeEnabled !== false && config.internalOnly !== true);
  }

  function getTabConfig(tabId) {
    return isPublicRoutableTab(tabId) ? DASHBOARD_TABS[tabId] : null;
  }

  function getTabIds() {
    return Object.keys(DASHBOARD_TABS).filter(isPublicRoutableTab);
  }

  function getAllTabIds() {
    return Object.keys(DASHBOARD_TABS);
  }

  function getInternalTabIds() {
    return Object.keys(DASHBOARD_TABS).filter(id => !isPublicRoutableTab(id));
  }

  function getNavTabs() {
    return Object.entries(DASHBOARD_TABS)
      .filter(([id]) => isPublicRoutableTab(id))
      .map(([id, config]) => ({ id, ...config }));
  }

  function findTabId(hash) {
    const clean = String(hash || '').replace(/^#/, '').trim().toLowerCase();
    if (!clean) return 'overview';
    if (isPublicRoutableTab(clean)) return clean;
    for (const [id, config] of Object.entries(DASHBOARD_TABS)) {
      if (!isPublicRoutableTab(id)) continue;
      if ((config.aliases || []).some(a => a.toLowerCase() === clean)) {
        return id;
      }
    }
    return null;
  }

  function normalizeCanonicalTabId(tabId) {
    return findTabId(tabId) || 'overview';
  }

  function restoreLastTab() {
    try {
      const saved = localStorage.getItem('dashboard_last_tab');
      const canonical = findTabId(saved);
      if (canonical && isPublicRoutableTab(canonical)) return canonical;
      if (saved) localStorage.removeItem('dashboard_last_tab');
    } catch (_) {}
    return 'overview';
  }

  return {
    getState,
    setState,
    subscribe,
    setActiveTab,
    setCurrentUserId,
    saveUserPreferences,
    loadUserPreferences,
    getTabConfig,
    getTabIds,
    getAllTabIds,
    getInternalTabIds,
    getNavTabs,
    findTabId,
    isPublicRoutableTab,
    normalizeCanonicalTabId,
    restoreLastTab
  };
})();

window.DashboardState = DashboardState;
window.DASHBOARD_TABS = DASHBOARD_TABS;
