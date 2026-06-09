'use strict';

(function registerNotificationCenter() {
  function esc(v) { return window.Utils?.escapeHtml ? Utils.escapeHtml(String(v ?? '')) : String(v ?? ''); }
  function actorId() { return localStorage.getItem('dashboard_actor_id') || localStorage.getItem('last_user_id') || 'dashboard-admin'; }
  function payload(extra = {}) { return { actorId: actorId(), userId: actorId(), workspaceId: localStorage.getItem('dashboard_workspace_id') || 'default', ...extra }; }
  function badge(v) { const c = String(v ?? 'unknown').toLowerCase(); const cls = c === 'critical' ? 'danger' : c === 'warning' ? 'warning' : 'info'; return `<span class="badge badge-${cls}">${esc(v || 'unknown')}</span>`; }

  async function loadNotifications() {
    const res = await Api.apiGet('/mobile/notifications', payload());
    return res.data?.notifications || [];
  }

  async function renderNotificationCenter(targetEl) {
    targetEl.innerHTML = '<div class="tab-header"><h2>Notification Center</h2><p>System notifications, warnings, pending approvals, and alerts.</p></div><div id="notif-content">' + window.UI.renderLoading('Loading notifications...') + '</div>';
    const notifications = await loadNotifications();
    const c = document.getElementById('notif-content');
    if (!c) return;
    const unread = notifications.filter(n => !n.read).length;
    c.innerHTML = `
      <div class="dashboard-card"><div class="card-header"><h3>All Notifications <span class="badge badge-info">${notifications.length}</span> <span class="badge badge-warning">${unread} unread</span></h3></div>
        ${notifications.length === 0 ? '<p class="muted">No notifications yet.</p>' : notifications.map(n => `
          <div class="gap-item" style="opacity: ${n.read ? 0.6 : 1}">
            <strong>${badge(n.type)}</strong> ${badge(n.severity)} <strong>${esc(n.title)}</strong>
            <p>${esc(n.summary)}</p>
            <span class="muted">${esc(n.sourceModule || '')} | ${esc((n.createdAt || '').slice(0, 19))}</span>
            ${!n.read ? `<button class="btn btn-sm btn-outline" onclick="markNotifRead('${esc(n.id)}')">Mark Read</button>` : ''}
            <button class="btn btn-sm btn-outline" onclick="dismissNotif('${esc(n.id)}')">Dismiss</button>
          </div>`).join('')}
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Actions</h3></div>
        <button class="btn btn-outline" id="btn-notif-refresh">Refresh</button>
        <div id="notif-result" style="margin-top:8px;"></div>
      </div>`;
    document.getElementById('btn-notif-refresh')?.addEventListener('click', () => renderNotificationCenter(targetEl));
  }

  window.markNotifRead = async function(id) {
    await Api.apiPost('/mobile/notifications/' + id + '/read', payload());
    renderNotificationCenter(document.getElementById('tab-content'));
  };
  window.dismissNotif = async function(id) {
    await Api.apiPost('/mobile/notifications/' + id + '/dismiss', payload());
    renderNotificationCenter(document.getElementById('tab-content'));
  };
  window.NOTIFICATION_CENTER = { renderNotificationCenter };
  if (window.UI) window.UI.renderNotificationCenter = renderNotificationCenter;
})();
