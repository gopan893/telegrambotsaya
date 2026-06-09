'use strict';

(function registerModelRouterDashboard() {
  function esc(value) {
    return window.Utils?.escapeHtml ? Utils.escapeHtml(String(value ?? '')) : String(value ?? '');
  }
  function actorId() {
    return localStorage.getItem('dashboard_actor_id') || localStorage.getItem('last_user_id') || 'dashboard-admin';
  }
  function workspaceId() {
    return localStorage.getItem('dashboard_workspace_id') || 'default';
  }
  function payload(extra = {}) {
    return { actorId: actorId(), userId: actorId(), workspaceId: workspaceId(), ...extra };
  }
  function badge(value) {
    const clean = String(value || 'unknown').toLowerCase();
    const cls = clean.includes('disabled') || clean.includes('unavailable') ? 'danger' : clean.includes('warning') || clean.includes('medium') ? 'warning' : 'success';
    return `<span class="badge badge-${cls}">${esc(value || 'unknown')}</span>`;
  }

  async function loadModelRouter() {
    const query = new URLSearchParams(payload()).toString();
    const [providers, health, caps, audit] = await Promise.all([
      Api.apiGet(`/model-router/providers?${query}`),
      Api.apiPost('/model-router/health', payload()),
      Api.apiGet(`/model-router/capabilities?${query}`),
      Api.apiGet(`/model-router/audit?${query}`)
    ]);
    return { providers: providers.data, health: health.data, capabilities: caps.data, audits: audit.data };
  }

  async function renderModelRouter(targetEl) {
    targetEl.innerHTML = '<div class="tab-header"><h2>Hybrid Local/Cloud AI Model Router</h2><p>Provider registry, routing decisions, health checks, benchmark, and audit.</p></div><div id="model-router-content">' + window.UI.renderLoading('Loading model router...') + '</div>';
    const res = await loadModelRouter();
    const content = document.getElementById('model-router-content');
    if (!content) return;
    content.innerHTML = `
      <div class="dashboard-card">
        <div class="card-header"><h3>Providers</h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Name</th><th>Type</th><th>Privacy</th><th>Cost</th><th>Vision</th><th>Tools</th></tr></thead>
          <tbody>${(res.providers?.providers || []).map(p => `<tr><td>${esc(p.name)}</td><td>${badge(p.type)}</td><td>${esc(p.privacyLevel)}</td><td>${esc(p.costTier)}</td><td>${p.supportsVision ? badge('Yes') : badge('No')}</td><td>${p.supportsTools ? badge('Yes') : badge('No')}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Provider Health</h3></div>
        <p>${esc(res.health?.health?.summary || 'Unknown')}</p>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Provider</th><th>Status</th></tr></thead>
          <tbody>${(res.health?.health?.providers || []).map(p => `<tr><td>${esc(p.name)}</td><td>${badge(p.status)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Capabilities</h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Provider</th><th>Model</th><th>Capability</th><th>Quality</th><th>Enabled</th></tr></thead>
          <tbody>${(res.capabilities?.capabilities || []).map(c => `<tr><td>${esc(c.providerId)}</td><td>${esc(c.modelName)}</td><td>${esc(c.capability)}</td><td>${c.qualityTier}/5</td><td>${c.enabled ? badge('Yes') : badge('No')}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Route Simulator</h3></div>
        <div class="form-group"><label>Input text</label><input id="router-sim-input" class="dashboard-input" placeholder="tulis pesan untuk simulasi routing..."></div>
        <div class="form-group"><label>Privacy mode</label><select id="router-sim-privacy" class="dashboard-select"><option value="">default</option><option value="local_preferred">Local Preferred</option><option value="local_only">Local Only</option></select></div>
        <button class="btn btn-outline" id="btn-router-simulate">Simulate Route</button>
        <div id="router-sim-result" style="margin-top:12px;"></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Route Audit (last 10)</h3></div>
        ${(res.audits?.audits || []).slice(0, 10).map(a => `<div class="gap-item"><strong>${esc(a.event)}</strong>: ${esc(a.detail)} <span class="muted">${esc(a.timestamp || '')}</span></div>`).join('') || '<p>Belum ada audit.</p>'}
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Actions</h3></div>
        <button class="btn btn-outline" id="btn-model-benchmark">Run Smoke Benchmark</button>
        <button class="btn btn-outline" id="btn-model-health">Refresh Health</button>
        <div id="model-router-result" style="margin-top:12px;"></div>
      </div>`;
    document.getElementById('btn-router-simulate')?.addEventListener('click', async () => {
      const text = document.getElementById('router-sim-input')?.value || '';
      const privacy = document.getElementById('router-sim-privacy')?.value || '';
      const result = document.getElementById('router-sim-result');
      if (result) result.innerHTML = window.UI.renderLoading('Simulating...');
      const res = await Api.apiPost('/model-router/simulate', payload({ text, context: { privacyMode: privacy } }));
      if (result) result.innerHTML = `<pre class="pre-wrap">${esc(JSON.stringify(res.data, null, 2))}</pre>`;
    });
    document.getElementById('btn-model-benchmark')?.addEventListener('click', async () => {
      const result = document.getElementById('model-router-result');
      if (result) result.innerHTML = window.UI.renderLoading('Running benchmark...');
      const res = await Api.apiPost('/model-router/benchmark', payload({ scope: 'smoke' }));
      if (result) result.innerHTML = `<pre class="pre-wrap">${esc(JSON.stringify(res.data, null, 2))}</pre>`;
    });
    document.getElementById('btn-model-health')?.addEventListener('click', async () => {
      const result = document.getElementById('model-router-result');
      if (result) result.innerHTML = window.UI.renderLoading('Refreshing health...');
      const res = await Api.apiPost('/model-router/health', payload());
      if (result) result.innerHTML = `<pre class="pre-wrap">${esc(JSON.stringify(res.data, null, 2))}</pre>`;
    });
  }

  window.MODEL_ROUTER_DASHBOARD = { renderModelRouter };
  if (window.UI) window.UI.renderModelRouter = renderModelRouter;
})();
