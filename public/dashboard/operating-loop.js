/* Dashboard Operating Loop tab */
/* global Api, UI, DashboardState */

(function() {
  'use strict';

  const TAB_ID = 'operating-loop';
  const API_BASE = '/api/dashboard/operating-loop';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  async function apiGet(path) {
    return Api.apiGet ? Api.apiGet(API_BASE + path) : Api.get(API_BASE + path);
  }

  async function apiPost(path, body) {
    return Api.apiPost ? Api.apiPost(API_BASE + path, body || {}) : Api.post(API_BASE + path, body);
  }

  async function renderOperatingLoop(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat Operating Loop...');

    try {
      const statusRes = await apiGet('/status');
      const loopsRes = await apiGet('/loops');
      const snapshotRes = await apiGet('/snapshot');
      const blockersRes = await apiGet('/blockers');
      const nextActionRes = await apiGet('/next-action');
      const proposalsRes = await apiGet('/pending-proposals');
      const runsRes = await apiGet('/runs');

      const status = statusRes.ok ? statusRes.data || statusRes : {};
      const loops = loopsRes.ok ? loopsRes.data || [] : [];
      const snapshot = snapshotRes.ok ? snapshotRes.data || {} : {};
      const blockers = blockersRes.ok ? blockersRes.data || [] : [];
      const nextAction = nextActionRes.ok ? nextActionRes.data || null : null;
      const proposals = proposalsRes.ok ? proposalsRes.data || [] : [];
      const runs = runsRes.ok ? runsRes.data || [] : [];

      let html = '';

      html += `<div class="tab-content">
        <div class="section-header">
          <h2>🔄 Operating Loop Dashboard</h2>
          <div class="section-actions">
            <button class="btn btn-outline" id="ol-refresh-btn">🔄 Refresh</button>
          </div>
        </div>`;

      const healthEmoji = snapshot.healthStatus === 'healthy' ? '🟢' : snapshot.healthStatus === 'critical' ? '🔴' : '🟡';
      html += `<div class="card-grid">
        <div class="card">
          <div class="card-title">System Health</div>
          <div class="card-value" style="color: ${snapshot.healthStatus === 'healthy' ? 'var(--color-success)' : snapshot.healthStatus === 'critical' ? 'var(--color-danger)' : 'var(--color-warning)'}">
            ${healthEmoji} ${esc(snapshot.healthStatus || 'unknown').toUpperCase()}
          </div>
          <div class="card-subtitle">${esc(snapshot.summary || '')}</div>
        </div>
        <div class="card">
          <div class="card-title">Loops</div>
          <div class="card-value">${esc(status.totalLoops || 0)}</div>
          <div class="card-subtitle">${esc(status.enabledCount || 0)} enabled</div>
        </div>
        <div class="card">
          <div class="card-title">Blockers</div>
          <div class="card-value" style="color: ${blockers.length > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">${blockers.length}</div>
          <div class="card-subtitle">${blockers.length > 0 ? 'Require attention' : 'All clear'}</div>
        </div>
        <div class="card">
          <div class="card-title">Pending Proposals</div>
          <div class="card-value">${proposals.length}</div>
          <div class="card-subtitle">Awaiting approval</div>
        </div>
      </div>`;

      html += `<div class="card-grid">
        <div class="card">
          <h3>Recommended Next Action</h3>
          <div id="ol-next-action-content">`;

      if (nextAction) {
        html += `<p><strong>${esc(nextAction.title || 'N/A')}</strong></p>
          <p class="card-subtitle">${esc(nextAction.description || '')}</p>
          <p class="card-subtitle">Priority: ${esc(nextAction.priority || 'N/A')} | Module: ${esc(nextAction.module || 'N/A')}</p>`;
      } else {
        html += `<p class="muted">No next action recommended.</p>`;
      }

      html += `</div></div>
        <div class="card">
          <h3>Reports</h3>
          <div class="form-row">
            <button class="btn btn-primary" id="ol-daily-report-btn">📋 Daily AI OS Report</button>
            <button class="btn btn-outline" id="ol-weekly-report-btn">📊 Weekly AI OS Report</button>
          </div>
          <div id="ol-report-result" class="result-box hidden" style="margin-top:12px;"></div>
        </div>
      </div>`;

      html += `<div class="section-header"><h3>Operating Loops</h3></div>
        <div class="table-responsive">
          <table class="table">
            <thead><tr>
              <th>ID</th><th>Name</th><th>Mode</th><th>Status</th><th>Cadence</th><th>Last Run</th><th>Actions</th>
            </tr></thead>
            <tbody>`;

      if (loops.length === 0) {
        html += `<tr><td colspan="7" class="text-center muted">No loops registered.</td></tr>`;
      } else {
        for (const loop of loops) {
          const statusClass = loop.status === 'enabled' ? 'badge-success' : loop.status === 'disabled' ? 'badge-error' : 'badge-warning';
          html += `<tr>
            <td><code>${esc(loop.id)}</code></td>
            <td>${esc(loop.name || '')}</td>
            <td>${esc(loop.mode || '')}</td>
            <td><span class="badge ${statusClass}">${esc(loop.status || 'unknown')}</span></td>
            <td>${esc(loop.cadence || '')}</td>
            <td>${esc(loop.lastRun ? new Date(loop.lastRun).toLocaleString() : '-')}</td>
            <td>
              <button class="btn btn-sm btn-primary ol-run-btn" data-loop-id="${esc(loop.id)}">▶ Run</button>
              ${loop.status === 'enabled'
                ? `<button class="btn btn-sm btn-warning ol-disable-btn" data-loop-id="${esc(loop.id)}">⏸ Disable</button>`
                : `<button class="btn btn-sm btn-success ol-enable-btn" data-loop-id="${esc(loop.id)}">▶ Enable</button>`}
            </td>
          </tr>`;
        }
      }

      html += `</tbody></table></div>`;

      if (blockers.length > 0) {
        html += `<div class="section-header"><h3>🚨 Current Blockers</h3></div>
          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>Severity</th><th>Module</th><th>Title</th><th>Description</th></tr></thead>
              <tbody>`;
        for (const b of blockers) {
          const sev = b.severity || 'info';
          html += `<tr>
            <td><span class="badge badge-${sev === 'critical' ? 'error' : sev === 'high' ? 'warning' : 'info'}">${esc(sev)}</span></td>
            <td>${esc(b.module || '')}</td>
            <td>${esc(b.title || '')}</td>
            <td>${esc((b.description || '').slice(0, 120))}</td>
          </tr>`;
        }
        html += `</tbody></table></div>`;
      }

      if (proposals.length > 0) {
        html += `<div class="section-header"><h3>📋 Pending Proposals</h3></div>
          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>ID</th><th>Title</th><th>Status</th></tr></thead>
              <tbody>`;
        for (const p of proposals) {
          html += `<tr><td><code>${esc(p.id || '')}</code></td><td>${esc(p.title || p.description || '')}</td><td><span class="badge badge-warning">${esc(p.status || 'pending')}</span></td></tr>`;
        }
        html += `</tbody></table></div>`;
      }

      if (runs.length > 0) {
        html += `<div class="section-header"><h3>📜 Run History</h3></div>
          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>Loop ID</th><th>Status</th><th>Timestamp</th></tr></thead>
              <tbody>`;
        for (const r of runs) {
          html += `<tr><td><code>${esc(r.loopId || r.id || '')}</code></td>
            <td><span class="badge badge-${r.status === 'completed' ? 'success' : r.status === 'failed' ? 'error' : 'info'}">${esc(r.status || 'unknown')}</span></td>
            <td>${esc(r.timestamp || r.createdAt ? new Date(r.timestamp || r.createdAt).toLocaleString() : '-')}</td></tr>`;
        }
        html += `</tbody></table></div>`;
      }

      html += `<div id="ol-report-container"></div>
        <div id="ol-run-result" style="margin-top:12px;"></div>
      </div>`;

      targetEl.innerHTML = html;

      document.getElementById('ol-refresh-btn')?.addEventListener('click', () => renderOperatingLoop(targetEl));

      document.querySelectorAll('.ol-enable-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const loopId = btn.dataset.loopId;
          await apiPost(`/loops/${esc(loopId)}/enable`, {});
          UI.showToast?.('Loop enabled', 'success');
          renderOperatingLoop(targetEl);
        });
      });

      document.querySelectorAll('.ol-disable-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const loopId = btn.dataset.loopId;
          await apiPost(`/loops/${esc(loopId)}/disable`, {});
          UI.showToast?.('Loop disabled', 'success');
          renderOperatingLoop(targetEl);
        });
      });

      document.querySelectorAll('.ol-run-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const loopId = btn.dataset.loopId;
          btn.disabled = true;
          btn.textContent = 'Running...';
          try {
            await apiPost(`/loops/${esc(loopId)}/run`, {});
            UI.showToast?.('Loop executed', 'success');
            renderOperatingLoop(targetEl);
          } catch (err) {
            UI.showToast?.(err.message || 'Run failed', 'error');
            btn.disabled = false;
            btn.textContent = '▶ Run';
          }
        });
      });

      document.getElementById('ol-daily-report-btn')?.addEventListener('click', async () => {
        const container = document.getElementById('ol-report-result');
        container.classList.remove('hidden');
        container.innerHTML = UI.renderLoading('Generating daily report...');
        try {
          const res = await apiGet('/reports/daily');
          if (res.ok) {
            const report = res.data || {};
            let rHtml = `<div class="report-box"><h4>${esc(report.type || 'daily').toUpperCase()} Report</h4>`;
            rHtml += `<p><strong>Health:</strong> ${esc(report.healthStatus || 'unknown')}</p>`;
            rHtml += `<p><strong>Summary:</strong> ${esc(report.summary || '')}</p>`;
            if (report.topBlockers?.length) {
              rHtml += `<p><strong>Blockers:</strong> ${report.topBlockers.length}</p>`;
            }
            if (report.topNextAction) {
              rHtml += `<p><strong>Next Action:</strong> ${esc(report.topNextAction.title || '')}</p>`;
            }
            rHtml += `<p><small>${esc(report.createdAt || '')}</small></p></div>`;
            container.innerHTML = rHtml;
          } else {
            container.innerHTML = UI.renderError('Report failed', res.error || 'Unknown error');
          }
        } catch (err) {
          container.innerHTML = UI.renderError('Report failed', err.message);
        }
      });

      document.getElementById('ol-weekly-report-btn')?.addEventListener('click', async () => {
        const container = document.getElementById('ol-report-result');
        container.classList.remove('hidden');
        container.innerHTML = UI.renderLoading('Generating weekly report...');
        try {
          const res = await apiGet('/reports/weekly');
          if (res.ok) {
            const report = res.data || {};
            let rHtml = `<div class="report-box"><h4>${esc(report.type || 'weekly').toUpperCase()} Report</h4>`;
            rHtml += `<p><strong>Health:</strong> ${esc(report.healthStatus || 'unknown')}</p>`;
            rHtml += `<p><strong>Summary:</strong> ${esc(report.summary || '')}</p>`;
            if (report.topBlockers?.length) {
              rHtml += `<p><strong>Blockers:</strong> ${report.topBlockers.length}</p>`;
            }
            if (report.topNextAction) {
              rHtml += `<p><strong>Next Action:</strong> ${esc(report.topNextAction.title || '')}</p>`;
            }
            rHtml += `<p><small>${esc(report.createdAt || '')}</small></p></div>`;
            container.innerHTML = rHtml;
          } else {
            container.innerHTML = UI.renderError('Report failed', res.error || 'Unknown error');
          }
        } catch (err) {
          container.innerHTML = UI.renderError('Report failed', err.message);
        }
      });

    } catch (err) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat', err.message || 'Operating Loop dashboard error');
    }
  }

  window.UI.renderOperatingLoop = renderOperatingLoop;
  window.OPERATING_LOOP_DASHBOARD = { renderOperatingLoop };
})();
