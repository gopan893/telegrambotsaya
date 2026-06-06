'use strict';

(function attachObservabilityDashboard() {
  function esc(value) {
    if (window.Utils?.escapeHtml) return Utils.escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function statusClass(status) {
    if (status === 'healthy' || status === 'resolved' || status === 'closed') return 'success';
    if (status === 'degraded' || status === 'medium' || status === 'investigating') return 'warning';
    if (status === 'unhealthy' || status === 'high' || status === 'critical' || status === 'open') return 'danger';
    return 'info';
  }

  function badge(text, type) {
    return `<span class="badge badge-${statusClass(type || text)}">${esc(text || '-')}</span>`;
  }

  function renderHealthCards(health) {
    const checks = health?.checks || [];
    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${badge(health?.status || 'unknown')}</div>
          <div class="stat-label">Production Health</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${checks.length}</div>
          <div class="stat-label">Checks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${(health?.blockers || []).length}</div>
          <div class="stat-label">Blockers</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${(health?.warnings || []).length}</div>
          <div class="stat-label">Warnings</div>
        </div>
      </div>
      <div class="card-grid compact-grid">
        ${checks.map(check => `
          <div class="panel">
            <div class="panel-title">${esc(check.label || check.id)} ${badge(check.status || 'unknown')}</div>
            ${(check.warnings || []).slice(0, 3).map(w => `<p class="text-muted">⚠️ ${esc(w)}</p>`).join('')}
            ${(check.blockers || []).slice(0, 3).map(b => `<p class="text-danger">⛔ ${esc(b)}</p>`).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderIncidentRows(incidents = []) {
    if (!incidents.length) {
      return '<tr><td colspan="5" class="text-center text-muted" style="padding:32px;">Tidak ada production incident terbuka.</td></tr>';
    }
    return incidents.map(incident => `
      <tr>
        <td><code>${esc(incident.id)}</code></td>
        <td>${esc(incident.title)}</td>
        <td>${badge(incident.severity)}</td>
        <td>${badge(incident.status)}</td>
        <td>
          <button class="btn btn-outline btn-sm" data-obs-detail="${esc(incident.id)}">Detail</button>
          <button class="btn btn-outline btn-sm" data-obs-analyze="${esc(incident.id)}">Analyze</button>
          <button class="btn btn-outline btn-sm" data-obs-plan="${esc(incident.id)}">Plan</button>
        </td>
      </tr>
    `).join('');
  }

  function renderTimeline(events = []) {
    if (!events.length) return '<p class="text-muted">Belum ada timeline event.</p>';
    return `<div class="timeline-list">${events.map(event => `
      <div class="timeline-item">
        <div class="timeline-time">${esc(event.time || event.createdAt || '-')} ${badge(event.severity || 'info')}</div>
        <div class="timeline-title">${esc(event.type || 'event')} · ${esc(event.source || 'observability')}</div>
        <div class="timeline-body">${esc(event.summary || '')}</div>
      </div>
    `).join('')}</div>`;
  }

  async function loadOverview(targetEl) {
    const res = await Api.apiGet('/observability');
    if (!res.ok) {
      targetEl.innerHTML = UI.renderError('Gagal memuat Observability Center');
      return;
    }
    const data = res.data || {};
    targetEl.innerHTML = `
      <div class="tab-header">
        <div>
          <h2>🛰️ Observability / Incident Center</h2>
          <p class="text-muted">Production health, incident timeline, root cause, dan response proposal aman.</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" id="btn-prod-health-check">Run Health Check</button>
          <button class="btn btn-outline" id="btn-refresh-observability">Refresh</button>
        </div>
      </div>
      ${renderHealthCards(data.health)}
      <div class="panel">
        <div class="panel-header">
          <h3 class="panel-title">Open Production Incidents</h3>
          <span class="text-muted">Repair/rollback tetap proposal-only.</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>ID</th><th>Title</th><th>Severity</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${renderIncidentRows(data.incidents || [])}</tbody>
          </table>
        </div>
      </div>
      <div class="panel" id="observability-detail">
        <h3 class="panel-title">Incident Detail</h3>
        <p class="text-muted">Pilih incident untuk melihat timeline, root cause, dan proposal terkait.</p>
      </div>
    `;
    bindEvents(targetEl);
  }

  async function renderIncidentDetail(targetEl, incidentId) {
    const detailEl = targetEl.querySelector('#observability-detail');
    if (!detailEl) return;
    detailEl.innerHTML = UI.renderLoading('Memuat detail incident...');
    const res = await Api.apiGet(`/observability/incidents/${encodeURIComponent(incidentId)}`);
    if (!res.ok) {
      detailEl.innerHTML = UI.renderError('Incident tidak ditemukan');
      return;
    }
    const { incident, timeline, responsePlans } = res.data;
    detailEl.innerHTML = `
      <div class="panel-header">
        <h3 class="panel-title">${esc(incident.title)}</h3>
        <div>${badge(incident.severity)} ${badge(incident.status)}</div>
      </div>
      <p>${esc(incident.summary || '-')}</p>
      <div class="kv-grid">
        <div><strong>Affected</strong><br>${esc((incident.affectedSystems || []).join(', ') || '-')}</div>
        <div><strong>First seen</strong><br>${esc(incident.firstSeenAt || '-')}</div>
        <div><strong>Last seen</strong><br>${esc(incident.lastSeenAt || '-')}</div>
        <div><strong>Proposals</strong><br>${esc((incident.proposalIds || []).join(', ') || '-')}</div>
      </div>
      ${incident.rootCauseHypothesis ? `
        <div class="panel nested-panel">
          <h4>Root Cause Hypothesis</h4>
          <p><strong>Confidence:</strong> ${esc(incident.rootCauseHypothesis.confidence)}</p>
          <p>${esc(incident.rootCauseHypothesis.likelyCause || '')}</p>
          <p class="text-muted">${esc(incident.rootCauseHypothesis.recommendedMitigation || '')}</p>
        </div>
      ` : ''}
      <div class="panel nested-panel">
        <h4>Response Plans</h4>
        ${(responsePlans || []).length ? (responsePlans || []).map(plan => `
          <div class="action-row">
            <div><code>${esc(plan.id)}</code> · Risk ${badge(plan.riskLevel)}</div>
            <div>
              <button class="btn btn-outline btn-sm" data-obs-repair="${esc(incident.id)}">Propose Repair</button>
              <button class="btn btn-danger btn-sm" data-obs-rollback="${esc(incident.id)}">Propose Rollback</button>
            </div>
          </div>
        `).join('') : '<p class="text-muted">Belum ada response plan.</p>'}
      </div>
      <div class="panel nested-panel">
        <h4>Timeline</h4>
        ${renderTimeline(timeline || [])}
      </div>
    `;
    bindEvents(targetEl);
  }

  async function postAction(targetEl, path, successText) {
    const res = await Api.apiPost(path, {});
    if (window.Utils?.showToast) Utils.showToast(res.ok ? successText : (res.data?.error || res.error || 'Action gagal'), res.ok ? 'success' : 'danger');
    await loadOverview(targetEl);
  }

  function bindEvents(targetEl) {
    targetEl.querySelector('#btn-refresh-observability')?.addEventListener('click', () => loadOverview(targetEl));
    targetEl.querySelector('#btn-prod-health-check')?.addEventListener('click', async () => {
      const res = await Api.apiPost('/observability/health/check', {});
      if (window.Utils?.showToast) Utils.showToast(res.ok ? 'Production health check selesai.' : 'Health check gagal.', res.ok ? 'success' : 'danger');
      await loadOverview(targetEl);
    });
    targetEl.querySelectorAll('[data-obs-detail]').forEach(btn => btn.addEventListener('click', () => renderIncidentDetail(targetEl, btn.dataset.obsDetail)));
    targetEl.querySelectorAll('[data-obs-analyze]').forEach(btn => btn.addEventListener('click', () => postAction(targetEl, `/observability/incidents/${encodeURIComponent(btn.dataset.obsAnalyze)}/analyze`, 'Root cause analysis dibuat.')));
    targetEl.querySelectorAll('[data-obs-plan]').forEach(btn => btn.addEventListener('click', () => postAction(targetEl, `/observability/incidents/${encodeURIComponent(btn.dataset.obsPlan)}/response-plan`, 'Response plan dibuat.')));
    targetEl.querySelectorAll('[data-obs-repair]').forEach(btn => btn.addEventListener('click', () => postAction(targetEl, `/observability/incidents/${encodeURIComponent(btn.dataset.obsRepair)}/propose-repair`, 'Repair proposal dibuat.')));
    targetEl.querySelectorAll('[data-obs-rollback]').forEach(btn => btn.addEventListener('click', () => postAction(targetEl, `/observability/incidents/${encodeURIComponent(btn.dataset.obsRollback)}/propose-rollback`, 'Rollback proposal dibuat.')));
  }

  if (window.UI) {
    window.UI.renderObservability = async function renderObservability(targetEl) {
      targetEl.innerHTML = UI.renderLoading('Memuat Observability / Incident Center...');
      try {
        await loadOverview(targetEl);
      } catch (err) {
        targetEl.innerHTML = UI.renderError(`Gagal memuat Observability: ${esc(err.message)}`);
      }
    };
  }
})();
