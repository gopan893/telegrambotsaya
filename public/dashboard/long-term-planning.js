/*
   Long-Term Planning Dashboard Renderer
   Phase 73 - AI OS Long-Term Autonomous Planning v2
*/

const DashboardLongTermPlanning = {
  async render() {
    const container = document.getElementById('tab-content');
    if (!container) return;

    container.innerHTML = `
      <div style="padding:24px 0;">
        <div class="section-header" style="margin-bottom:24px;">
          <h2>📋 Long-Term Planning</h2>
          <p style="color:var(--text-secondary); margin-top:8px;">Goals, roadmaps, milestones, and strategic planning</p>
        </div>

        <div class="dashboard-grid">
          <div class="card">
            <h3>⏱️ Weekly Focus</h3>
            <div id="weekly-focus-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>🎯 Active Goals</h3>
            <div id="active-goals-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>🗺️ Monthly Roadmap</h3>
            <div id="monthly-roadmap-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>⚠️ Blockers</h3>
            <div id="blockers-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>📊 Progress Review</h3>
            <div id="progress-content" class="loading-placeholder">Loading...</div>
          </div>

          <div class="card">
            <h3>💡 Strategy Recommendations</h3>
            <div id="strategy-content" class="loading-placeholder">Loading...</div>
          </div>
        </div>

        <div style="margin-top:32px;">
          <div class="section-header">
            <h3>All Goals</h3>
          </div>
          <div id="goals-list-content" class="loading-placeholder">Loading goals...</div>
        </div>
      </div>
    `;

    // Load all sections
    await Promise.all([
      this.loadWeeklyFocus(),
      this.loadActiveGoals(),
      this.loadMonthlyRoadmap(),
      this.loadBlockers(),
      this.loadProgress(),
      this.loadStrategy(),
      this.loadAllGoals()
    ]);
  },

  async loadWeeklyFocus() {
    const el = document.getElementById('weekly-focus-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/long-term-planning/roadmap/weekly');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">No weekly focus available</p>';
        return;
      }

      const roadmap = response.data;
      const focusAreas = roadmap.focusAreas || [];

      if (focusAreas.length === 0) {
        el.innerHTML = '<p class="text-muted">No focus areas defined</p>';
        return;
      }

      el.innerHTML = `
        <ul style="margin:0; padding-left:20px;">
          ${focusAreas.map(area => `<li>${Utils.escapeHtml(area)}</li>`).join('')}
        </ul>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error loading weekly focus: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadActiveGoals() {
    const el = document.getElementById('active-goals-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/long-term-planning/goals?status=active');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">No active goals</p>';
        return;
      }

      const goals = response.data.goals || [];

      if (goals.length === 0) {
        el.innerHTML = '<p class="text-muted">No active goals</p>';
        return;
      }

      el.innerHTML = `
        <div style="font-size:32px; font-weight:bold; color:var(--primary);">${goals.length}</div>
        <p style="color:var(--text-secondary); margin-top:8px;">Active goals in progress</p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadMonthlyRoadmap() {
    const el = document.getElementById('monthly-roadmap-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/long-term-planning/roadmap/monthly');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">No monthly roadmap available</p>';
        return;
      }

      const roadmap = response.data;
      const milestones = roadmap.milestones || [];

      el.innerHTML = `
        <p style="margin:0;"><strong>${milestones.length}</strong> milestones planned</p>
        <p style="color:var(--text-secondary); margin-top:4px; font-size:13px;">
          ${roadmap.summary || 'Planning in progress'}
        </p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadBlockers() {
    const el = document.getElementById('blockers-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/long-term-planning/blockers');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">No blockers detected</p>';
        return;
      }

      const blockers = response.data.blockers || [];

      if (blockers.length === 0) {
        el.innerHTML = '<p style="color:var(--success);">✅ No blockers detected</p>';
        return;
      }

      el.innerHTML = `
        <div style="font-size:32px; font-weight:bold; color:var(--danger);">${blockers.length}</div>
        <p style="color:var(--text-secondary); margin-top:8px;">Active blockers need attention</p>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadProgress() {
    const el = document.getElementById('progress-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/long-term-planning/progress');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">No progress data available</p>';
        return;
      }

      const progress = response.data;
      const completedGoals = progress.completedGoals || 0;
      const totalGoals = progress.totalGoals || 0;

      el.innerHTML = `
        <p style="margin:0;"><strong>${completedGoals}/${totalGoals}</strong> goals completed</p>
        <div style="background:var(--border-color); height:8px; border-radius:4px; margin-top:8px; overflow:hidden;">
          <div style="background:var(--success); height:100%; width:${totalGoals > 0 ? (completedGoals/totalGoals*100) : 0}%;"></div>
        </div>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadStrategy() {
    const el = document.getElementById('strategy-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/long-term-planning');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">No recommendations available</p>';
        return;
      }

      const recommendations = response.data.recommendations || [];

      if (recommendations.length === 0) {
        el.innerHTML = '<p class="text-muted">No recommendations at this time</p>';
        return;
      }

      el.innerHTML = `
        <ul style="margin:0; padding-left:20px; font-size:14px;">
          ${recommendations.slice(0, 3).map(rec => `<li>${Utils.escapeHtml(rec)}</li>`).join('')}
        </ul>
      `;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  async loadAllGoals() {
    const el = document.getElementById('goals-list-content');
    if (!el) return;

    try {
      const response = await Api.fetch('/api/dashboard/long-term-planning/goals');
      if (!response.ok || !response.data) {
        el.innerHTML = '<p class="text-muted">No goals available</p>';
        return;
      }

      const goals = response.data.goals || [];

      if (goals.length === 0) {
        el.innerHTML = '<div class="empty-state"><p>No goals created yet</p></div>';
        return;
      }

      const goalsHtml = goals.map(goal => `
        <div class="card" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:start;">
            <div style="flex:1;">
              <h4 style="margin:0 0 8px 0;">${Utils.escapeHtml(goal.title || 'Untitled Goal')}</h4>
              <p style="color:var(--text-secondary); font-size:14px; margin:0;">
                ${Utils.escapeHtml(goal.description || 'No description')}
              </p>
              <div style="margin-top:8px; font-size:13px;">
                <span class="badge ${this.getStatusBadgeClass(goal.status)}">${Utils.escapeHtml(goal.status || 'unknown')}</span>
                <span class="badge badge-outline" style="margin-left:4px;">${Utils.escapeHtml(goal.category || 'unknown')}</span>
                <span class="badge badge-outline" style="margin-left:4px;">${Utils.escapeHtml(goal.horizon || 'unknown')}</span>
              </div>
            </div>
          </div>
        </div>
      `).join('');

      el.innerHTML = goalsHtml;
    } catch (error) {
      el.innerHTML = `<p class="text-danger">Error loading goals: ${Utils.escapeHtml(error.message)}</p>`;
    }
  },

  getStatusBadgeClass(status) {
    const statusMap = {
      active: 'badge-success',
      draft: 'badge-info',
      paused: 'badge-warning',
      blocked: 'badge-danger',
      completed: 'badge-success',
      archived: 'badge-secondary'
    };
    return statusMap[status] || 'badge-secondary';
  }
};

// Register with router
if (typeof window !== 'undefined' && window.DashboardRouter) {
  window.DashboardRouter.register('long-term-planning', DashboardLongTermPlanning);
}
