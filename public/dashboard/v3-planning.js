/*
   V3 Planning Dashboard Renderer
   Phase 74 - AI OS v3 Planning Gate
*/

const DashboardV3Planning = {
  async render() {
    const container = document.getElementById('tab-content');
    if (!container) return;

    container.innerHTML = `
      <div style="padding:24px 0;">
        <div class="section-header" style="margin-bottom:24px;">
          <h2>📋 V3 Planning Gate</h2>
          <p style="color:var(--text-secondary); margin-top:8px;">AI OS v3 planning, lessons from v2, scope, risks, and migration strategy</p>
        </div>

        <div class="dashboard-grid">
          <div class="card">
            <h3>🚪 Planning Gate Status</h3>
            <div id="gate-status-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>📚 V2 Lessons</h3>
            <div id="lessons-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>🎯 V3 Scope</h3>
            <div id="scope-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>⚠️ Risks</h3>
            <div id="risks-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>🗺️ Migration Strategy</h3>
            <div id="migration-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>📋 Decisions</h3>
            <div id="decisions-content" class="loading-placeholder">Loading...</div>
          </div>
        </div>

        <div style="margin-top:32px;">
          <div class="section-header">
            <h3>V3 Roadmap</h3>
          </div>
          <div id="roadmap-content" class="loading-placeholder">Loading roadmap...</div>
        </div>

        <div style="margin-top:32px;">
          <div class="section-header">
            <h3>Architecture Principles</h3>
          </div>
          <div id="principles-content" class="loading-placeholder">Loading principles...</div>
        </div>
      </div>
    `;

    await Promise.all([
      this.loadGateStatus(),
      this.loadLessons(),
      this.loadScope(),
      this.loadRisks(),
      this.loadMigration(),
      this.loadDecisions(),
      this.loadRoadmap(),
      this.loadPrinciples()
    ]);
  },

  async loadGateStatus() {
    const el = document.getElementById('gate-status-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-planning');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">Gate status unavailable</p>';
        return;
      }

      const gateStatus = response.data.gateStatus || {};
      const status = gateStatus.status || 'unknown';

      const statusIcons = {
        ready: '✅',
        warning: '⚠️',
        blocked: '🚫',
        checking: '🔄',
        unknown: '❓'
      };

      const statusColors = {
        ready: 'var(--success)',
        warning: 'var(--warning)',
        blocked: 'var(--danger)',
        checking: 'var(--info)',
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

  async loadLessons() {
    const el = document.getElementById('lessons-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-planning/lessons');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">No lessons available</p>';
        return;
      }

      const lessons = response.data.lessons || [];
      el.innerHTML = `
        <div style="font-size:32px; font-weight:bold; color:var(--primary);">${lessons.length}</div>
        <p style="color:var(--text-secondary); margin-top:8px;">Lessons from v2</p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadScope() {
    const el = document.getElementById('scope-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-planning/scope');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">Scope not defined</p>';
        return;
      }

      const scope = response.data.scopeItems || [];
      el.innerHTML = `
        <div style="font-size:32px; font-weight:bold; color:var(--primary);">${scope.length}</div>
        <p style="color:var(--text-secondary); margin-top:8px;">Scope items defined</p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadRisks() {
    const el = document.getElementById('risks-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-planning/risks');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">No risks registered</p>';
        return;
      }

      const risks = response.data.risks || [];
      const highRisks = risks.filter(r => r.severity === 'high').length;

      el.innerHTML = `
        <div style="font-size:32px; font-weight:bold; color:${highRisks > 0 ? 'var(--danger)' : 'var(--success)'};">
          ${risks.length}
        </div>
        <p style="color:var(--text-secondary); margin-top:8px;">
          ${highRisks} high-severity
        </p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadMigration() {
    const el = document.getElementById('migration-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-planning/migration');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">Migration strategy not defined</p>';
        return;
      }

      const migration = response.data;
      const slices = migration.slices || [];

      el.innerHTML = `
        <p style="margin:0;"><strong>${slices.length}</strong> migration slices</p>
        <p style="color:var(--text-secondary); margin-top:4px; font-size:13px;">
          ${migration.status || 'Planning'}
        </p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadDecisions() {
    const el = document.getElementById('decisions-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-planning/decisions');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">No decisions recorded</p>';
        return;
      }

      const decisions = response.data.decisions || [];
      el.innerHTML = `
        <div style="font-size:32px; font-weight:bold; color:var(--primary);">${decisions.length}</div>
        <p style="color:var(--text-secondary); margin-top:8px;">Decisions logged</p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadRoadmap() {
    const el = document.getElementById('roadmap-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-planning/roadmap');
      if (!response.ok || !response.data) {
        el.innerHTML = '<div class="empty-state"><p>Roadmap not available</p></div>';
        return;
      }

      const roadmap = response.data;
      const phases = roadmap.phases || [];

      if (phases.length === 0) {
        el.innerHTML = '<div class="empty-state"><p>No phases defined</p></div>';
        return;
      }

      const phasesHtml = phases.map((phase, idx) => `
        <div class="card" style="margin-bottom:12px;">
          <h4 style="margin:0 0 8px 0;">Phase ${idx + 76}: ${Utils.escapeHtml(phase.name || 'Unnamed Phase')}</h4>
          <p style="color:var(--text-secondary); font-size:14px; margin:0;">
            ${Utils.escapeHtml(phase.description || 'No description')}
          </p>
        </div>
      `).join('');

      el.innerHTML = phasesHtml;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error loading roadmap: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadPrinciples() {
    const el = document.getElementById('principles-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/v3-planning/principles');
      if (!response.ok || !response.data) {
        el.innerHTML = '<div class="empty-state"><p>Principles not available</p></div>';
        return;
      }

      const principles = response.data.principles || [];

      if (principles.length === 0) {
        el.innerHTML = '<div class="empty-state"><p>No principles defined</p></div>';
        return;
      }

      const principlesHtml = `
        <ul style="margin:0; padding-left:20px;">
          ${principles.map(p => `<li style="margin-bottom:8px;">${Utils.escapeHtml(p)}</li>`).join('')}
        </ul>
      `;

      el.innerHTML = principlesHtml;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error loading principles: ${Utils.escapeHtml(error.message)}</p>`;
    }
  }
};

// Register with router
if (typeof window !== 'undefined' && window.DashboardRouter) {
  window.DashboardRouter.register('v3-planning', DashboardV3Planning);
}
