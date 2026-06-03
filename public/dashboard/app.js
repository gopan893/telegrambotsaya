/* 
   =========================================
   Telegram AI OS Dashboard - App Core Router
   =========================================
*/

document.addEventListener('DOMContentLoaded', () => {
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  const healthIndicator = document.getElementById('public-health-indicator');
  const tabContent = document.getElementById('tab-content');
  const sidebar = document.getElementById('app-sidebar');
  const menuToggle = document.getElementById('menu-toggle');
  const navItems = document.querySelectorAll('.nav-item');
  const versionEl = document.getElementById('app-version');

  let currentTab = 'overview';
  let serverOnline = false;

  const TAB_ROUTES = {
    overview: UI.renderOverview,
    ops: UI.renderOps,
    workspaces: UI.renderWorkspacesAdmin,
    users: UI.renderUsers,
    permissions: UI.renderPermissions,
    memory: UI.renderMemory,
    goals: UI.renderGoals,
    workflows: UI.renderWorkflows,
    planner: UI.renderPlanner,
    executor: UI.renderExecutor,
    agents: UI.renderAgents,
    tools: UI.renderTools,
    integrations: UI.renderIntegrations,
    backup: UI.renderBackupRecovery,
    insights: UI.renderInsights,
    graph: UI.renderGraph,
    benchmarks: UI.renderBenchmarks,
    incidents: UI.renderIncidents,
    audit: UI.renderAudit,
    commands: UI.renderCommands,
    env: UI.renderEnv,
    settings: UI.renderSettings
  };

  const normalizeTab = (tab) => {
    const clean = String(tab || '').replace(/^#/, '').trim();
    return Object.prototype.hasOwnProperty.call(TAB_ROUTES, clean) ? clean : 'overview';
  };

  const getRequestedTab = () => {
    const hashTab = window.location.hash ? window.location.hash.substring(1) : '';
    if (hashTab) return normalizeTab(hashTab);
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    if (queryTab) return normalizeTab(queryTab);
    return normalizeTab(window.DashboardState?.getState?.().activeTab || 'overview');
  };

  const navigateToTab = (tab) => {
    const nextTab = normalizeTab(tab);
    if (window.location.hash === `#${nextTab}`) {
      routeTab();
    } else {
      window.location.hash = `#${nextTab}`;
    }
  };

  window.DashboardApp = {
    ...(window.DashboardApp || {}),
    TAB_ROUTES: Object.keys(TAB_ROUTES),
    normalizeTab,
    getRequestedTab,
    navigateToTab
  };

  // Ensure confirm-modal is hidden on startup
  const confirmModal = document.getElementById('confirm-modal');
  if (confirmModal) confirmModal.classList.add('hidden');

  // Mobile navigation drawer toggle
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Close mobile sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (sidebar && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && e.target !== menuToggle) {
        sidebar.classList.remove('open');
      }
    }
  });

  // Close mobile sidebar when a nav item is clicked
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      if (tab) {
        if (sidebar) sidebar.classList.remove('open');
        navigateToTab(tab);
      }
    });
  });

  // Main UI routing based on active tab hash
  const routeTab = async () => {
    if (!Auth.isLoggedIn()) {
      showLoginView();
      return;
    }

    const requestedTab = getRequestedTab();
    currentTab = requestedTab;
    if (window.DashboardState) DashboardState.setActiveTab(currentTab);

    // Highlight nav item
    navItems.forEach(nav => {
      if (nav.getAttribute('data-tab') === currentTab) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    const renderer = TAB_ROUTES[currentTab] || TAB_ROUTES.overview;
    if (!TAB_ROUTES[currentTab] && window.location.hash !== '#overview') {
      window.location.hash = '#overview';
      return;
    }
    await renderer(tabContent);
  };

  // Check server health and update login view state alerts
  const checkServerAndUpdateLoginUI = async () => {
    const warningAlert = document.getElementById('login-status-warning');
    const disabledAlert = document.getElementById('login-status-disabled');
    const offlineAlert = document.getElementById('login-status-offline');

    // Hide all alerts first
    if (warningAlert) warningAlert.classList.add('hidden');
    if (disabledAlert) disabledAlert.classList.add('hidden');
    if (offlineAlert) offlineAlert.classList.add('hidden');

    const res = await Api.getHealth();

    if (!res.ok || res.error === 'NETWORK_ERROR') {
      // Server unreachable (running from file://, server offline, or network issue)
      serverOnline = false;
      if (offlineAlert) offlineAlert.classList.remove('hidden');
      return;
    }

    serverOnline = true;
    const info = res.data;

    if (versionEl) versionEl.textContent = info.version || 'v1.0.0';
    localStorage.setItem('server_dashboard_enabled', info.dashboardEnabled ? 'ENABLED' : 'DISABLED');

    if (!info.dashboardEnabled) {
      if (disabledAlert) disabledAlert.classList.remove('hidden');
    } else if (!(info.tokenConfigured ?? info.adminTokenSet)) {
      if (warningAlert) warningAlert.classList.remove('hidden');
    }
    // else: server is OK, no alerts needed
  };

  // Switch display container to login view
  const showLoginView = async () => {
    loginContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    await checkServerAndUpdateLoginUI();
  };

  // Switch display container to app view
  const showAppView = async () => {
    loginContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    await routeTab();
  };

  // Periodic Public Health indicator updates
  const updatePublicHealth = async () => {
    const res = await Api.getHealth();
    if (res.ok && res.data) {
      const data = res.data;
      serverOnline = true;

      if (versionEl && data.version) {
        versionEl.textContent = data.version;
      }

      localStorage.setItem('server_dashboard_enabled', data.dashboardEnabled ? 'ENABLED' : 'DISABLED');

      if (!data.ok) {
        healthIndicator.className = 'public-health-badge degraded';
        healthIndicator.querySelector('.status-text').textContent = 'Degraded';
      } else {
        healthIndicator.className = 'public-health-badge healthy';
        healthIndicator.querySelector('.status-text').textContent = 'Healthy';
      }
    } else {
      serverOnline = false;
      healthIndicator.className = 'public-health-badge critical';
      healthIndicator.querySelector('.status-text').textContent = 'Offline';
    }
  };

  // Run Auth system initialization
  Auth.init(
    async () => {
      // Auth Success callback - verify token with server
      const verifyRes = await Api.getSummary();

      if (verifyRes.ok) {
        Utils.showToast('Login berhasil!', 'success');
        showAppView();
      } else if (verifyRes.status === 401) {
        Auth.handleUnauthorized(() => {
          showLoginView();
        });
      } else if (verifyRes.error === 'NETWORK_ERROR' || verifyRes.status === 0) {
        // Server offline — still show the app but with a warning
        Utils.showToast('Server tidak dapat dijangkau. Beberapa fitur mungkin terbatas.', 'warning');
        showAppView();
      } else {
        // Other error - show login again
        showLoginView();
      }
    },
    () => {
      // Auth required / no token stored
      showLoginView();
    }
  );

  // Set Routing Event Listeners
  window.addEventListener('hashchange', routeTab);

  // Set health monitor polling (every 30 seconds)
  updatePublicHealth();
  setInterval(updatePublicHealth, 30000);
});
