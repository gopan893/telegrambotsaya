/*
   V3 Blueprint Dashboard Renderer
   Phase 75 - AI OS v3 Core Blueprint + Safe Modularization Plan
*/

const DashboardV3Blueprint = {
  async render() {
    const container = document.getElementById('tab-content');
    if (!container) return;

    container.innerHTML = `
      <div style="padding:24px 0;">
        <div class="section-header" style="margin-bottom:24px;">
          <h2>🏗️ V3 Blueprint</h2>
          <p style="color:var(--text-secondary); margin-top:8px;">AI OS v3 core architecture, contracts, and migration plan</p>
        </div>

        <div class="dashboard-grid">
          <div class="card">
            <h3>📋 Core Blueprint</h3>
            <div id="core-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>📦 Module Contracts</h3>
            <div id="modules-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>📚 Registry v3</h3>
            <div id="registry-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>🖥️ Dashboard Shell</h3>
            <div id="dashboard-shell-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>🔌 API Contract</h3>
            <div id="api-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>✅ Readiness</h3>
            <div id="readiness-content" class="loading-placeholder">Loading...</div>
          </div>
        </div>

        <div style="margin-top:32px;">
          <div class="section-header">
            <h3>Convergence Plan</h3>
          </div>
          <div id="convergence-content" class="loading-placeholder">Loading convergence...</div>
        </div>

        <div style="margin-top:32px;">
          <div class="section-header">
            <h3>Storage Boundary Plan</h3>
          </div>
          <div id="storage-content" class="loading-placeholder">Loading storage...</div>
        </div>
      </div>
    `;

    await Promise.all([
      this.loadCore(),
      this.loadModules(),
      this.loadRegistry(),
      this.loadDashboardShell(),
      this.loadApiContract(),
      this.loadReadiness(),
      this.loadConvergence(),
      this.loadStorage()
    ]);
  },

  async loadCore() {
    const el = document.getElementById('core-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-blueprint/core');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">Core blueprint not available</p>';
        return;
      }

      el.innerHTML = `
        <p style="color:var(--success); font-weight:bold;">✅ Defined</p>
        <p style="color:var(--text-secondary); font-size:13px; margin-top:4px;">
          Core architecture ready
        </p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadModules() {
    const el = document.getElementById('modules-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-blueprint/modules');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">Module contracts not available</p>';
        return;
      }

      const data = response.data;
      const totalModules = data.totalModules || 0;

      el.innerHTML = `
        <div style="font-size:32px; font-weight:bold; color:var(--primary);">${totalModules}</div>
        <p style="color:var(--text-secondary); margin-top:8px;">Module contracts</p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadRegistry() {
    const el = document.getElementById('registry-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-blueprint/registry');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">Registry draft not available</p>';
        return;
      }

      const registries = response.data.registries || [];

      el.innerHTML = `
        <div style="font-size:32px; font-weight:bold; color:var(--primary);">${registries.length}</div>
        <p style="color:var(--text-secondary); margin-top:8px;">Registries defined</p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadDashboardShell() {
    const el = document.getElementById('dashboard-shell-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-blueprint/dashboard-shell');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">Dashboard shell plan not available</p>';
        return;
      }

      el.innerHTML = `
        <p style="color:var(--info); font-weight:bold;">📋 Planned</p>
        <p style="color:var(--text-secondary); font-size:13px; margin-top:4px;">
          Vanilla JS architecture
        </p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadApiContract() {
    const el = document.getElementById('api-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-blueprint/api-contract');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">API contract not available</p>';
        return;
      }

      el.innerHTML = `
        <p style="color:var(--success); font-weight:bold;">✅ Drafted</p>
        <p style="color:var(--text-secondary); font-size:13px; margin-top:4px;">
          JSON contract defined
        </p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadReadiness() {
    const el = document.getElementById('readiness-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-blueprint/readiness');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">Readiness unknown</p>';
        return;
      }

      const readiness = response.data;
      const status = readiness.overallStatus || 'unknown';

      const statusIcons = {
        ready: '✅',
        warning: '⚠️',
        blocked: '🚫',
        unknown: '❓'
      };

      const statusColors = {
        ready: 'var(--success)',
        warning: 'var(--warning)',
        blocked: 'var(--danger)',
        unknown: 'var(--text-secondary)'
      };

      el.innerHTML = `
        <div style="font-size:48px; text-align:center;">${statusIcons[status] || '❓'}</div>
        <p style="text-align:center; margin-top:8px; font-weight:bold; color:${statusColors[status]};">
          ${Utils.escapeHtml(status.toUpperCase())}
        </p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadConvergence() {
    const el = document.getElementById('convergence-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-blueprint/convergence');
      if (!response.ok || !response.data) {
        el.innerHTML = '<div class="empty-state"><p>Convergence plan not available</p></div>';
        return;
      }

      const convergence = response.data;
      const layers = convergence.layers || {};

      const layersHtml = Object.entries(layers).map(([key, desc]) => `
        <div class="card" style="margin-bottom:12px;">
          <h4 style="margin:0 0 4px 0;">${Utils.escapeHtml(key)}</h4>
          <p style="color:var(--text-secondary); font-size:14px; margin:0;">
            ${Utils.escapeHtml(desc)}
          </p>
        </div>
      `).join('');

      el.innerHTML = layersHtml || '<div class="empty-state"><p>No layers defined</p></div>';
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error loading convergence: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadStorage() {
    const el = document.getElementById('storage-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-blueprint/storage');
      if (!response.ok || !response.data) {
        el.innerHTML = '<div class="empty-state"><p>Storage plan not available</p></div>';
        return;
      }

      const storage = response.data;
      const architecture = storage.storageArchitecture || {};

      const criticalCount = architecture.critical?.length || 0;
      const durableCount = architecture.durable?.length || 0;

      el.innerHTML = `
        <div class="card">
          <p style="margin:0;"><strong>${criticalCount}</strong> critical storage modules</p>
          <p style="margin:8px 0 0 0;"><strong>${durableCount}</strong> durable storage modules</p>
          <p style="color:var(--text-secondary); font-size:13px; margin-top:8px;">
            Backup and migration policies defined
          </p>
        </div>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error loading storage: ${Utils.escapeHtml(error.message)}</p>`;
    }
  }
};

// Register with router
if (typeof window !== 'undefined' && window.DashboardRouter) {
  window.DashboardRouter.register('v3-blueprint', DashboardV3Blueprint);
}
