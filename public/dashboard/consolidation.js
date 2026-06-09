'use strict';

(function registerConsolidationDashboard() {
  function esc(v) { return window.Utils?.escapeHtml ? Utils.escapeHtml(String(v ?? '')) : String(v ?? ''); }
  function actorId() { return localStorage.getItem('dashboard_actor_id') || localStorage.getItem('last_user_id') || 'dashboard-admin'; }
  function payload(extra = {}) { return { actorId: actorId(), userId: actorId(), workspaceId: localStorage.getItem('dashboard_workspace_id') || 'default', ...extra }; }
  function badge(v) { const c = String(v ?? 'unknown').toLowerCase(); const cls = c === 'high' || c === 'blocked' ? 'danger' : c === 'medium' || c === 'warning' ? 'warning' : c === 'low' ? 'info' : 'success'; return `<span class="badge badge-${cls}">${esc(v || 'unknown')}</span>`; }

  async function loadConsolidation() {
    await Api.apiPost('/consolidation/audit', payload());
    const [modules, duplicates, routes, commands, capabilities, registry, docs, tests, perf, roadmap] = await Promise.all([
      Api.apiGet('/consolidation/modules', payload()),
      Api.apiGet('/consolidation/duplicates', payload()),
      Api.apiGet('/consolidation/routes', payload()),
      Api.apiGet('/consolidation/commands', payload()),
      Api.apiGet('/consolidation/capabilities', payload()),
      Api.apiGet('/consolidation/dashboard-registry', payload()),
      Api.apiGet('/consolidation/docs', payload()),
      Api.apiGet('/consolidation/tests', payload()),
      Api.apiGet('/consolidation/performance', payload()),
      Api.apiGet('/consolidation/v2-roadmap', payload())
    ]);
    return { modules: modules.data, duplicates: duplicates.data, routes: routes.data, commands: commands.data, capabilities: capabilities.data, registry: registry.data, docs: docs.data, tests: tests.data, perf: perf.data, roadmap: roadmap.data };
  }

  async function renderConsolidation(targetEl) {
    targetEl.innerHTML = '<div class="tab-header"><h2>Architecture Consolidation</h2><p>Architecture audit, module duplication, route/command/capability registry audit, docs/test/performance audit, and v2 roadmap.</p></div><div id="consolidation-content">' + window.UI.renderLoading('Running architecture audit...') + '</div>';
    const res = await loadConsolidation();
    const c = document.getElementById('consolidation-content');
    if (!c) return;
    c.innerHTML = `
      <div class="dashboard-card"><div class="card-header"><h3>Module Directories</h3></div>
        <div class="table-wrapper"><table class="data-table"><thead><tr><th>Directory</th><th>Module Count</th></tr></thead>
        <tbody>${Object.entries(res.modules?.modules || res.modules || {}).map(([dir, count]) => `<tr><td><code>${esc(dir)}</code></td><td>${count}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">No data.</td></tr>'}</tbody></table></div>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Duplicates <span class="badge badge-warning">${(res.duplicates?.duplicates?.duplicates || []).length}</span></h3></div>
        ${(res.duplicates?.duplicates?.duplicates || []).slice(0, 20).map(d => `<div class="gap-item">${badge(d.risk)} ${esc(d.type)}: ${esc(d.detail || JSON.stringify(d))}</div>`).join('') || '<p class="muted">No duplicates detected.</p>'}
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Route Registry</h3></div>
        <pre class="pre-wrap">${esc(JSON.stringify(res.routes?.routes || res.routes, null, 2).slice(0, 1500))}</pre>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Command Registry</h3></div>
        <pre class="pre-wrap">${esc(JSON.stringify(res.commands?.commands || res.commands, null, 2).slice(0, 1500))}</pre>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Capability Registry</h3></div>
        <pre class="pre-wrap">${esc(JSON.stringify(res.capabilities?.capabilities || res.capabilities, null, 2).slice(0, 1500))}</pre>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Dashboard Registry Audit</h3></div>
        <pre class="pre-wrap">${esc(JSON.stringify(res.registry?.dashboardRegistry || res.registry, null, 2).slice(0, 1500))}</pre>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Docs Audit</h3></div>
        <pre class="pre-wrap">${esc(JSON.stringify(res.docs?.docs || res.docs, null, 2).slice(0, 1000))}</pre>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Test Coverage</h3></div>
        <pre class="pre-wrap">${esc(JSON.stringify(res.tests?.tests || res.tests, null, 2).slice(0, 1000))}</pre>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Performance Baseline</h3></div>
        <pre class="pre-wrap">${esc(JSON.stringify(res.perf?.performance || res.perf, null, 2).slice(0, 1000))}</pre>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>v2 Roadmap</h3></div>
        <pre class="pre-wrap">${esc(JSON.stringify(res.roadmap?.roadmap || res.roadmap, null, 2).slice(0, 2000))}</pre>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Actions</h3></div>
        <button class="btn btn-outline" id="btn-consolidation-refresh">Refresh All Audits</button>
        <div id="consolidation-result" style="margin-top:12px;"></div>
      </div>`;
    document.getElementById('btn-consolidation-refresh')?.addEventListener('click', () => renderConsolidation(targetEl));
  }
  window.CONSOLIDATION_DASHBOARD = { renderConsolidation };
  if (window.UI) window.UI.renderConsolidation = renderConsolidation;
})();
