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

  let serverOnline = false;

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
      const tabId = item.getAttribute('data-tab');
      if (tabId) {
        const canonical = DashboardState.normalizeCanonicalTabId(tabId);
        if (canonical) {
          window.location.hash = `#${canonical}`;
        }
        if (sidebar) sidebar.classList.remove('open');
        e.preventDefault();
      }
    });
  });

  // Main UI routing based on active tab hash
  const routeTab = async () => {
    if (!Auth.isLoggedIn()) {
      showLoginView();
      return;
    }

    const rawHash = window.location.hash.substring(1) || '';
    const tabId = DashboardState.findTabId(rawHash) || '';
    const canonical = tabId || DashboardState.restoreLastTab();

    // Save and set active tab
    DashboardState.setActiveTab(canonical);

    // Highlight nav item
    navItems.forEach(nav => {
      if (nav.getAttribute('data-tab') === canonical) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    // Render the tab
    await renderTabContent(canonical);
  };

  async function renderTabContent(tabId) {
    const config = DashboardState.getTabConfig(tabId);
    if (!config) {
      return UI.renderOverview(tabContent);
    }

    const rendererName = config.renderer;
    const renderFn = UI[rendererName];

    if (typeof renderFn === 'function') {
      try {
        if (renderFn.constructor.name === 'AsyncFunction' || renderFn.toString().includes('async')) {
          await renderFn.call(UI, tabContent);
        } else {
          renderFn.call(UI, tabContent);
        }
      } catch (err) {
        console.error(`Error rendering tab "${tabId}":`, err);
        tabContent.innerHTML = `
          <div class="error-state">
            <span style="font-size:32px; display:block; margin-bottom:12px;">⚠️</span>
            <h3>Error loading "${Utils.escapeHtml(config.title || tabId)}"</h3>
            <p style="color:var(--text-secondary); margin-top:8px;">${Utils.escapeHtml(err.message)}</p>
          </div>
        `;
      }
    } else {
      // Known tab but renderer missing — show placeholder
      tabContent.innerHTML = `
        <div style="padding:40px 24px;">
          <div class="section-header" style="margin-bottom:24px;">
            <h2>${Utils.escapeHtml(config.title || tabId)}</h2>
          </div>
          <div class="empty-state">
            <span class="empty-state-emoji">📄</span>
            <h3>${Utils.escapeHtml(config.title || 'Page')}</h3>
            <p>Page module belum tersedia atau belum termuat.</p>
          </div>
        </div>
      `;
    }
  }

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
    } else if (!info.adminTokenSet) {
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
    // On first load, if no hash, restore last tab
    if (!window.location.hash || window.location.hash === '#') {
      const lastTab = DashboardState.restoreLastTab();
      window.location.hash = `#${lastTab}`;
    }
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
