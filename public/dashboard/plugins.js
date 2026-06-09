'use strict';

(function registerPluginsDashboard() {
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
    const cls = clean.includes('disabled') || clean.includes('disconnected') || clean === 'false' ? 'danger' : clean.includes('warning') || clean.includes('connecting') ? 'warning' : 'success';
    return `<span class="badge badge-${cls}">${esc(value || 'unknown')}</span>`;
  }

  async function loadPlugins() {
    const [list, connectors, registry, marketplace, health, logs, updates, dep] = await Promise.all([
      Api.apiGet('/plugins/list'),
      Api.apiGet('/plugins/connectors'),
      Api.apiGet('/plugins/registry'),
      Api.apiGet('/plugins/marketplace'),
      Api.apiGet('/plugins/health'),
      Api.apiGet('/plugins/logs'),
      Api.apiGet('/plugins/updates'),
      Api.apiGet('/plugins/dependency')
    ]);
    return { installed: list.data, connectors: connectors.data, registry: registry.data, marketplace: marketplace.data, health: health.data, logs: logs.data, updates: updates.data, dependency: dep.data };
  }

  async function renderPlugins(targetEl) {
    targetEl.innerHTML = '<div class="tab-header"><h2>Plugin / Connector SDK</h2><p>Install plugins, manage connectors, browse marketplace, and view health.</p></div><div id="plugins-content">' + window.UI.renderLoading('Loading plugins...') + '</div>';
    const res = await loadPlugins();
    const content = document.getElementById('plugins-content');
    if (!content) return;
    content.innerHTML = `
      <div class="dashboard-card">
        <div class="card-header"><h3>Installed Plugins <span class="badge badge-info">${res.installed?.plugins?.length || 0}</span></h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>ID</th><th>Name</th><th>Version</th><th>Type</th><th>Status</th><th>Enabled</th><th>Actions</th></tr></thead>
          <tbody>${(res.installed?.plugins || []).map(p => `<tr><td>${esc(p.id)}</td><td>${esc(p.name)}</td><td>${esc(p.version)}</td><td>${esc(p.type)}</td><td>${badge(p.status)}</td><td>${badge(p.enabled)}</td><td><button class="btn btn-sm ${p.enabled ? 'btn-warning' : 'btn-success'}" onclick="togglePlugin('${esc(p.id)}')">${p.enabled ? 'Disable' : 'Enable'}</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No plugins installed.</td></tr>'}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Connector Catalog <span class="badge badge-info">${res.connectors?.connectors?.length || 0}</span></h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Category</th><th>Auth</th></tr></thead>
          <tbody>${(res.connectors?.connectors || []).map(c => `<tr><td>${esc(c.id)}</td><td>${esc(c.name)}</td><td>${badge(c.type)}</td><td>${esc(c.category)}</td><td>${esc((c.authMethods || []).join(', '))}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Active Connector Instances <span class="badge badge-info">${res.registry?.connectors?.length || 0}</span></h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>ID</th><th>Connector</th><th>Status</th><th>Connected</th></tr></thead>
          <tbody>${(res.registry?.connectors || []).map(c => `<tr><td>${esc(c.id)}</td><td>${esc(c.connectorId)}</td><td>${badge(c.status)}</td><td>${badge(c.connected)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No connector instances.</td></tr>'}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Marketplace</h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Plugin</th><th>Description</th><th>Author</th><th>Rating</th><th>Downloads</th></tr></thead>
          <tbody>${(res.marketplace?.plugins || []).map(p => `<tr><td><strong>${esc(p.name)}</strong> v${esc(p.version)}</td><td>${esc(p.description)}</td><td>${esc(p.author)}</td><td>${p.rating}/5</td><td>${p.downloads}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Connector Health</h3></div>
        <p>Connected: <strong>${res.health?.health?.connected || 0}</strong> | Disconnected: <strong>${res.health?.health?.disconnected || 0}</strong> | Errored: <strong>${res.health?.health?.errored || 0}</strong></p>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Updates Available <span class="badge badge-warning">${res.updates?.updates?.updatesAvailable || 0}</span></h3></div>
        ${(res.updates?.updates?.results || []).filter(u => u.updateAvailable).map(u => `<div class="gap-item">${esc(u.pluginId)}: ${esc(u.currentVersion)} → ${esc(u.latestVersion)}</div>`).join('') || '<p class="muted">All plugins up to date.</p>'}
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Dependency Graph</h3></div>
        <p>Healthy: ${badge(res.dependency?.report?.healthy)} (${res.dependency?.report?.ok || 0}/${res.dependency?.report?.total || 0} plugins)</p>
        ${(res.dependency?.report?.issues || []).map(i => `<div class="gap-item">⚠ ${esc(i.pluginId)}: ${esc(i.error)}</div>`).join('')}
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Actions</h3></div>
        <button class="btn btn-outline" id="btn-plugins-install">Install Sample Plugin</button>
        <button class="btn btn-outline" id="btn-plugins-create-connector">Create Sample Connector</button>
        <button class="btn btn-outline" id="btn-plugins-refresh">Refresh</button>
        <div id="plugins-result" style="margin-top:12px;"></div>
      </div>`;
    document.getElementById('btn-plugins-install')?.addEventListener('click', async () => {
      const result = document.getElementById('plugins-result');
      if (result) result.innerHTML = window.UI.renderLoading('Installing...');
      const res = await Api.apiPost('/plugins/install', payload({ manifest: { id: 'sample_plugin_' + Date.now(), name: 'Sample Plugin', version: '1.0.0', main: 'index.js', type: 'module' } }));
      if (result) result.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-plugins-create-connector')?.addEventListener('click', async () => {
      const result = document.getElementById('plugins-result');
      if (result) result.innerHTML = window.UI.renderLoading('Creating connector...');
      const res = await Api.apiPost('/plugins/connector/create', payload({ connectorId: 'http_webhook', config: { url: 'https://example.com/hook' } }));
      if (result) result.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-plugins-refresh')?.addEventListener('click', () => renderPlugins(targetEl));
  }

  window.togglePlugin = async function(pluginId) {
    const res = await Api.apiPost('/plugins/toggle', payload({ pluginId }));
    renderPlugins(document.getElementById('tab-content'));
  };

  window.PLUGINS_DASHBOARD = { renderPlugins };
  if (window.UI) window.UI.renderPlugins = renderPlugins;
})();
