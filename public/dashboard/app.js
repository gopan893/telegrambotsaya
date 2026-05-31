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

  // Mobile navigation drawer toggle
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Close mobile sidebar when a nav item is clicked
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const tab = item.getAttribute('data-tab');
      if (tab) {
        currentTab = tab;
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        window.location.hash = `#${tab}`;
        sidebar.classList.remove('open');
      }
    });
  });

  // Main UI routing based on active tab hash
  const routeTab = async () => {
    if (!Auth.isLoggedIn()) {
      showLoginView();
      return;
    }

    const hash = window.location.hash.substring(1) || 'overview';
    currentTab = hash;

    // Highlight nav item
    navItems.forEach(nav => {
      if (nav.getAttribute('data-tab') === currentTab) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    switch (currentTab) {
      case 'overview':
        await UI.renderOverview(tabContent);
        break;
      case 'ops':
        await UI.renderOps(tabContent);
        break;
      case 'memory':
        await UI.renderMemory(tabContent);
        break;
      case 'goals':
        await UI.renderGoals(tabContent);
        break;
      case 'workflows':
        await UI.renderWorkflows(tabContent);
        break;
      case 'insights':
        await UI.renderInsights(tabContent);
        break;
      case 'graph':
        await UI.renderGraph(tabContent);
        break;
      case 'benchmarks':
        await UI.renderBenchmarks(tabContent);
        break;
      case 'incidents':
        await UI.renderIncidents(tabContent);
        break;
      case 'commands':
        await UI.renderCommands(tabContent);
        break;
      case 'env':
        await UI.renderEnv(tabContent);
        break;
      case 'settings':
        UI.renderSettings(tabContent);
        break;
      default:
        await UI.renderOverview(tabContent);
    }
  };

  // Switch display container to login view
  const showLoginView = async () => {
    loginContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    
    // Check health endpoint for warning flags
    const res = await Api.getHealth();
    if (res.ok) {
      const info = res.data;
      if (versionEl) versionEl.textContent = info.version || 'v1.0.0';
      localStorage.setItem('server_dashboard_enabled', info.dashboardEnabled ? 'ENABLED' : 'DISABLED');
      
      const warningAlert = document.getElementById('login-status-warning');
      const disabledAlert = document.getElementById('login-status-disabled');

      if (!info.dashboardEnabled) {
        disabledAlert.classList.remove('hidden');
        warningAlert.classList.add('hidden');
      } else if (!info.adminTokenSet) {
        warningAlert.classList.remove('hidden');
        disabledAlert.classList.add('hidden');
      } else {
        warningAlert.classList.add('hidden');
        disabledAlert.classList.add('hidden');
      }
    }
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
    if (res.ok) {
      const data = res.data;
      if (versionEl) versionEl.textContent = data.version || 'v1.0.0';

      healthIndicator.className = 'public-health-badge healthy';
      healthIndicator.querySelector('.status-text').textContent = 'Healthy';
      localStorage.setItem('server_dashboard_enabled', data.dashboardEnabled ? 'ENABLED' : 'DISABLED');

      // Update status class if degradations are present in public response
      if (!data.ok) {
        healthIndicator.className = 'public-health-badge degraded';
        healthIndicator.querySelector('.status-text').textContent = 'Degraded';
      }
    } else {
      healthIndicator.className = 'public-health-badge critical';
      healthIndicator.querySelector('.status-text').textContent = 'Offline';
    }
  };

  // Run Auth system initialization
  Auth.init(
    async () => {
      // Auth Success - verify token with server
      const verifyRes = await Api.getSummary();
      if (verifyRes.ok) {
        Utils.showToast('Login berhasil!', 'success');
        showAppView();
      } else if (verifyRes.status === 401) {
        Auth.handleUnauthorized(() => {
          showLoginView();
        });
      } else {
        // Network error / offline but logged in
        showAppView();
      }
    },
    () => {
      // Auth required / invalid token
      showLoginView();
    }
  );

  // Set Routing Event Listeners
  window.addEventListener('hashchange', routeTab);

  // Set health monitor polling (every 30 seconds)
  updatePublicHealth();
  setInterval(updatePublicHealth, 30000);
});
