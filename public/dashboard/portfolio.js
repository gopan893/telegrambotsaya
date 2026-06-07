'use strict';

(function registerPortfolioDashboard() {
  function esc(value) {
    return window.Utils?.escapeHtml ? Utils.escapeHtml(String(value ?? '')) : String(value ?? '');
  }

  function metric(label, value, hint) {
    return `
      <div class="stat-card">
        <div class="stat-value">${esc(value)}</div>
        <div class="stat-label">${esc(label)}</div>
        ${hint ? `<div class="stat-hint">${esc(hint)}</div>` : ''}
      </div>
    `;
  }

  function statusBadge(value) {
    const clean = String(value || 'unknown').toLowerCase();
    const cls = clean.includes('critical') || clean.includes('blocked') ? 'danger' : (clean.includes('warning') || clean.includes('medium') ? 'warning' : 'success');
    return `<span class="badge badge-${cls}">${esc(value || 'unknown')}</span>`;
  }

  function actorId() {
    return localStorage.getItem('dashboard_actor_id') || localStorage.getItem('last_user_id') || 'dashboard-admin';
  }

  function workspaceId() {
    return localStorage.getItem('dashboard_workspace_id') || 'default';
  }

  function basePayload() {
    return { actorId: actorId(), userId: actorId(), workspaceId: workspaceId() };
  }

  async function loadAll() {
    const query = new URLSearchParams(basePayload()).toString();
    const [snapshot, priorities, dependencies, stale, risk, cost, nextAction, report] = await Promise.all([
      Api.apiGet(`/portfolio/snapshot?${query}`),
      Api.apiGet(`/portfolio/priorities?${query}`),
      Api.apiGet(`/portfolio/dependencies?${query}`),
      Api.apiGet(`/portfolio/stale?${query}`),
      Api.apiGet(`/portfolio/risk?${query}`),
      Api.apiGet(`/portfolio/cost?${query}`),
      Api.apiGet(`/portfolio/next-action?${query}`),
      Api.apiGet(`/portfolio/report?${query}&type=weekly`)
    ]);
    return { snapshot, priorities, dependencies, stale, risk, cost, nextAction, report };
  }

  function renderProjects(items = []) {
    if (!items.length) {
      return '<div class="empty-state"><h3>Belum ada project aktif</h3><p>Buat goal/plan dulu agar portfolio bisa memberi ranking.</p></div>';
    }
    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Rank</th><th>Project</th><th>Priority</th><th>Health</th><th>Rekomendasi</th></tr></thead>
          <tbody>
            ${items.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td><strong>${esc(item.goal?.title || item.goalId)}</strong><br><span class="muted">${esc(item.goalId)}</span></td>
                <td>${esc(item.priorityScore)}/100<br>${statusBadge(item.priorityLabel)}</td>
                <td>${esc(item.health?.score ?? '-')}/100<br>${statusBadge(item.health?.status || '-')}</td>
                <td>${esc(item.recommendation || item.explanation || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDependencyList(edges = []) {
    if (!edges.length) return '<p class="muted">Belum ada dependency lintas project yang terdeteksi.</p>';
    return `<ul class="compact-list">${edges.slice(0, 12).map(edge => `<li><strong>${esc(edge.from)}</strong> ${esc(edge.type)} ${esc(edge.to)} <span class="muted">${esc(edge.evidence || '')}</span></li>`).join('')}</ul>`;
  }

  async function runPortfolioAction(action, targetEl) {
    const resultEl = document.getElementById('portfolio-action-result');
    if (resultEl) resultEl.innerHTML = UI.renderLoading('Memproses portfolio action...');
    const payload = basePayload();
    const map = {
      weekly: () => Api.apiPost('/portfolio/weekly-plan', payload),
      monthly: () => Api.apiPost('/portfolio/monthly-plan', payload),
      proposal: () => Api.apiPost('/portfolio/proposal', payload),
      refresh: async () => {
        await window.UI.renderPortfolio(targetEl);
        return { ok: true, data: { ok: true, message: 'Dashboard refreshed' } };
      }
    };
    try {
      const res = await (map[action] || map.refresh)();
      const data = res.data || res;
      if (!res.ok && resultEl) {
        resultEl.innerHTML = UI.renderError(data.error || data.reason || 'Portfolio action gagal');
        return;
      }
      if (resultEl) {
        resultEl.innerHTML = `<pre style="background:var(--bg-secondary); padding:12px; border-radius:6px; overflow:auto; max-height:50vh;">${esc(JSON.stringify(data, null, 2))}</pre>`;
      }
    } catch (err) {
      if (resultEl) resultEl.innerHTML = UI.renderError('Portfolio exception', err.message);
    }
  }

  async function renderPortfolio(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat Portfolio Manager...');
    const data = await loadAll();
    const snapshot = data.snapshot.data || {};
    const totals = snapshot.totals || {};
    const priorities = data.priorities.data?.items || [];
    const deps = data.dependencies.data?.edges || [];
    const stale = data.stale.data?.stale || [];
    const risk = data.risk.data || {};
    const cost = data.cost.data || {};
    const next = data.nextAction.data || {};
    const report = data.report.data || {};
    targetEl.innerHTML = `
      <div class="tab-header">
        <h2>📚 Portfolio Manager</h2>
        <p>Multi-project priority intelligence. Semua write/external/danger action tetap proposal + approval.</p>
      </div>

      <div class="grid grid-4">
        ${metric('Active Projects', totals.activeGoals || 0)}
        ${metric('Open Tasks', totals.activeTasks || 0, `${totals.blockedTasks || 0} blocked`)}
        ${metric('Pending Approval', totals.pendingApprovals || 0)}
        ${metric('Open Incidents', totals.openIncidents || 0)}
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Next Recommended Action</h3>${statusBadge(next.riskLevel || 'low')}</div>
        <pre class="pre-wrap">${esc(next.summary || 'Belum ada rekomendasi.')}</pre>
        <div class="button-row">
          <button class="btn btn-outline" data-portfolio-action="refresh">Refresh</button>
          <button class="btn btn-primary" data-portfolio-action="weekly">Generate Weekly Plan</button>
          <button class="btn btn-outline" data-portfolio-action="monthly">Generate Monthly Plan</button>
          <button class="btn btn-danger" data-portfolio-action="proposal">Create Proposal</button>
        </div>
        <div id="portfolio-action-result" style="margin-top:12px;"></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Priority Ranking</h3><span class="muted">mode=${esc(snapshot.portfolio?.priorityMode || 'balanced')}</span></div>
        ${renderProjects(priorities)}
      </div>

      <div class="grid grid-2">
        <div class="dashboard-card">
          <div class="card-header"><h3>Risk Summary</h3>${statusBadge(risk.riskLevel || 'unknown')}</div>
          <ul class="compact-list">${(risk.warnings || []).slice(0, 8).map(item => `<li>${esc(item)}</li>`).join('') || '<li>No major warning.</li>'}</ul>
        </div>
        <div class="dashboard-card">
          <div class="card-header"><h3>Cost Summary</h3>${statusBadge(cost.status || 'unknown')}</div>
          <p>Average tokens: <strong>${esc(cost.averageTokens || 0)}</strong></p>
          <p>AI/request: <strong>${esc(cost.aiPerRequest || 0)}</strong></p>
          <ul class="compact-list">${(cost.recommendations || []).slice(0, 4).map(item => `<li>${esc(item.action || item.reason || item)}</li>`).join('') || '<li>No cost warning.</li>'}</ul>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="dashboard-card">
          <div class="card-header"><h3>Dependencies</h3><span class="muted">${deps.length} edge(s)</span></div>
          ${renderDependencyList(deps)}
        </div>
        <div class="dashboard-card">
          <div class="card-header"><h3>Stale / Blocked</h3><span class="muted">${stale.length} project(s)</span></div>
          ${stale.length ? `<ul class="compact-list">${stale.slice(0, 8).map(item => `<li><strong>${esc(item.goal?.title || item.goal?.id)}</strong> - ${esc(item.suggestedAction || '')}</li>`).join('')}</ul>` : '<p class="muted">Tidak ada stale project besar.</p>'}
        </div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Weekly Report</h3><span class="muted">${esc(report.generatedAt || '')}</span></div>
        <pre class="pre-wrap">${esc(report.text || '-')}</pre>
      </div>
    `;

    targetEl.querySelectorAll('[data-portfolio-action]').forEach(button => {
      button.addEventListener('click', () => runPortfolioAction(button.dataset.portfolioAction, targetEl));
    });
  }

  window.PORTFOLIO = {
    renderPortfolio,
    runPortfolioAction
  };

  if (window.UI) {
    window.UI.renderPortfolio = renderPortfolio;
  }
})();
