'use strict';

(function registerMobileDashboard() {
  function esc(v) { return window.Utils?.escapeHtml ? Utils.escapeHtml(String(v ?? '')) : String(v ?? ''); }
  function actorId() { return localStorage.getItem('dashboard_actor_id') || localStorage.getItem('last_user_id') || 'dashboard-admin'; }
  function payload(extra = {}) { const p = { actorId: actorId(), userId: actorId(), workspaceId: localStorage.getItem('dashboard_workspace_id') || 'default', ...extra }; return p; }
  function badge(v) { const c = String(v ?? 'unknown').toLowerCase(); const cls = c === 'disabled' || c === 'none' || c === 'false' ? 'danger' : c === 'warning' ? 'warning' : 'success'; return `<span class="badge badge-${cls}">${esc(v || 'unknown')}</span>`; }

  async function loadMobile() {
    const [profile, nav, actions, offline, notifications] = await Promise.all([
      Api.apiGet('/mobile/profile', payload()),
      Api.apiGet('/mobile/navigation', payload()),
      Api.apiGet('/mobile/quick-actions', payload()),
      Api.apiGet('/mobile/offline', payload()),
      Api.apiGet('/mobile/notifications', payload())
    ]);
    return { profile: profile.data, nav: nav.data, actions: actions.data, offline: offline.data, notifications: notifications.data };
  }

  async function renderMobile(targetEl) {
    targetEl.innerHTML = '<div class="tab-header"><h2>Mobile / PWA UX</h2><p>Mobile dashboard profile, navigation, quick actions, offline control, and notification center.</p></div><div id="mobile-content">' + window.UI.renderLoading('Loading mobile settings...') + '</div>';
    const res = await loadMobile();
    const c = document.getElementById('mobile-content');
    if (!c) return;
    c.innerHTML = `
      <div class="dashboard-card"><div class="card-header"><h3>Profile</h3></div>
        <p>Layout: <strong>${esc(res.profile?.profile?.layoutMode || 'default')}</strong> | Compact: ${badge(res.profile?.profile?.compactMode)} | Notifications: ${badge(res.profile?.profile?.notificationMode)} | Offline: ${badge(res.profile?.profile?.offlineModeEnabled)}</p>
        <div class="form-group"><label>Layout Mode</label><select id="mobile-layout" class="dashboard-select"><option value="default" ${res.profile?.profile?.layoutMode === 'default' ? 'selected' : ''}>Default</option><option value="compact" ${res.profile?.profile?.layoutMode === 'compact' ? 'selected' : ''}>Compact</option></select></div>
        <div class="form-group"><label>Notification Mode</label><select id="mobile-notif-mode" class="dashboard-select"><option value="all" ${res.profile?.profile?.notificationMode === 'all' ? 'selected' : ''}>All</option><option value="important" ${res.profile?.profile?.notificationMode === 'important' ? 'selected' : ''}>Important Only</option><option value="none" ${res.profile?.profile?.notificationMode === 'none' ? 'selected' : ''}>None</option></select></div>
        <button class="btn btn-outline" id="btn-mobile-save-profile">Save Profile</button>
        <div id="mobile-profile-result" style="margin-top:8px;"></div>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Bottom Navigation</h3></div>
        <div class="table-wrapper"><table class="data-table"><thead><tr><th>Tab</th><th>Label</th></tr></thead>
        <tbody>${(res.nav?.bottomNav || []).map(n => `<tr><td>${esc(n.tab || n.id)}</td><td>${esc(n.label || n.title)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">No bottom nav items.</td></tr>'}</tbody></table></div>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Quick Actions (${(res.actions?.actions || []).length})</h3></div>
        <div class="table-wrapper"><table class="data-table"><thead><tr><th>Action</th><th>Risk</th><th>Type</th><th>Requires Approval</th></tr></thead>
        <tbody>${(res.actions?.actions || []).map(a => `<tr><td>${esc(a.title)}</td><td>${badge(a.riskLevel)}</td><td>${esc(a.actionType)}</td><td>${badge(a.requiresApproval)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No quick actions.</td></tr>'}</tbody></table></div>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>PWA / Offline</h3></div>
        <p>Online: ${badge(res.offline?.status?.online)} | Cache Ready: ${badge(res.offline?.status?.cacheReady)} | Offline Mode: ${badge(res.offline?.status?.offlineMode)}</p>
        <p><strong>Cache Policy:</strong> ${esc(res.offline?.cachePolicy?.summary || 'N/A')}</p>
        <p><strong>Limitations:</strong> ${esc(res.offline?.limitations || 'None')}</p>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Notifications (${(res.notifications?.notifications || []).length})</h3></div>
        ${(res.notifications?.notifications || []).slice(0, 10).map(n => `<div class="gap-item"><strong>${esc(n.type)}</strong> [${badge(n.severity)}] ${esc(n.title)} — ${esc(n.summary)} <span class="muted">${esc((n.createdAt || '').slice(0, 19))}</span></div>`).join('') || '<p class="muted">No notifications.</p>'}
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Actions</h3></div>
        <button class="btn btn-outline" id="btn-mobile-refresh">Refresh</button>
        <div id="mobile-result" style="margin-top:8px;"></div>
      </div>`;
    document.getElementById('btn-mobile-save-profile')?.addEventListener('click', async () => {
      const layout = document.getElementById('mobile-layout')?.value || 'default';
      const notif = document.getElementById('mobile-notif-mode')?.value || 'all';
      const r = document.getElementById('mobile-profile-result');
      if (r) r.innerHTML = window.UI.renderLoading('Saving...');
      const res = await Api.apiPost('/mobile/profile', payload({ layoutMode: layout, notificationMode: notif }));
      if (r) r.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-mobile-refresh')?.addEventListener('click', () => renderMobile(targetEl));
  }
  window.MOBILE_DASHBOARD = { renderMobile };
  if (window.UI) window.UI.renderMobile = renderMobile;
})();
