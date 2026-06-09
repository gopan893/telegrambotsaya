/* Reliability Dashboard Tab */

(function() {
  if (typeof window.DashboardUtils === 'undefined') {
    window.DashboardUtils = window.DashboardUtils || {};
  }

  async function api(path, opts) {
    opts = opts || {};
    const token = localStorage.getItem('dashboard_token');
    try {
      const res = await fetch('/api/dashboard' + path, {
        headers: { 'Authorization': 'Bearer ' + (token || ''), 'Content-Type': 'application/json', ...(opts.headers || {}) },
        method: opts.method || 'GET',
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
      return res.ok ? res.json() : { ok: false, error: res.statusText };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function render(contentEl) {
    contentEl.innerHTML = `
      <div class="tab-header"><h2>Reliability & SLO Monitor</h2></div>
      <div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline" id="rel-refresh">Refresh</button>
      </div>
      <div id="rel-loading"><p>Loading reliability data...</p></div>
      <div id="rel-scorecard" style="display:none"></div>
      <div id="rel-slos" style="display:none"></div>
      <div id="rel-regressions" style="display:none"></div>
    `;
    document.getElementById('rel-refresh').addEventListener('click', loadAll);
    loadAll();
  }

  async function loadAll() {
    var loading = document.getElementById('rel-loading');
    var scorecardEl = document.getElementById('rel-scorecard');
    var slosEl = document.getElementById('rel-slos');
    var regsEl = document.getElementById('rel-regressions');
    if (!loading || !scorecardEl || !slosEl || !regsEl) return;

    loading.style.display = 'block';
    scorecardEl.style.display = 'none';
    slosEl.style.display = 'none';
    regsEl.style.display = 'none';

    var data = await api('/reliability');
    if (!data.ok) { loading.innerHTML = '<p class="error">Failed to load reliability data</p>'; return; }
    loading.style.display = 'none';

    // Scorecard
    if (data.scorecard) {
      var sc = data.scorecard;
      scorecardEl.style.display = 'block';
      scorecardEl.innerHTML = '<div class="card"><div class="card-body"><h3>Reliability Scorecard</h3>' +
        '<p>Overall: <strong>' + (sc.overall || 0) + '</strong> / 100 — <span class="badge badge-' + (sc.level === 'production_stable' ? 'success' : sc.level === 'acceptable' ? 'info' : 'danger') + '">' + (sc.level || 'unknown') + '</span></p>' +
        '<table class="info-table">';
      if (sc.scores) {
        Object.keys(sc.scores).forEach(function(k) {
          scorecardEl.innerHTML += '<tr><td>' + k + '</td><td>' + sc.scores[k] + '</td></tr>';
        });
      }
      scorecardEl.innerHTML += '</table></div></div>';
    }

    // SLO Status
    if (data.sloStatus) {
      var slo = data.sloStatus;
      slosEl.style.display = 'block';
      slosEl.innerHTML = '<div class="card"><div class="card-body"><h3>SLO Status</h3>' +
        '<p>Overall: <span class="badge badge-' + (slo.overall === 'healthy' ? 'success' : slo.overall === 'warning' ? 'warning' : 'danger') + '">' + (slo.overall || 'unknown') + '</span></p>' +
        '<table class="info-table"><tr><th>SLO</th><th>Target</th><th>Current</th><th>Status</th></tr>';
      if (slo.results) {
        slo.results.forEach(function(r) {
          slosEl.innerHTML += '<tr><td>' + (r.name || '-') + '</td><td>' + (r.target || '-') + '%</td><td>' + (r.currentValue || '-') + '%</td><td><span class="badge badge-' + (r.status === 'healthy' ? 'success' : r.status === 'warning' ? 'warning' : 'danger') + '">' + (r.status || '-') + '</span></td></tr>';
        });
      }
      slosEl.innerHTML += '</table></div></div>';
    }

    // Regression Watchdog
    if (data.regressions) {
      regsEl.style.display = 'block';
      regsEl.innerHTML = '<div class="card"><div class="card-body"><h3>Regression Watchdog</h3>';
      if (data.regressions.length === 0) {
        regsEl.innerHTML += '<p>No regressions detected.</p>';
      } else {
        regsEl.innerHTML += '<table class="info-table"><tr><th>ID</th><th>Module</th><th>Detected</th></tr>';
        data.regressions.forEach(function(r) {
          regsEl.innerHTML += '<tr><td>' + (r.id || '-') + '</td><td>' + (r.module || '-') + '</td><td>' + (r.detectedAt || '-') + '</td></tr>';
        });
        regsEl.innerHTML += '</table>';
      }
      regsEl.innerHTML += '</div></div>';
    }
  }

  window.renderReliability = render;
  if (window.UI) window.UI.renderReliability = render;
  window.DASHBOARD_TABS = window.DASHBOARD_TABS || {};
  window.DASHBOARD_TABS.reliability = { label: 'Reliability', title: 'Reliability & SLO Monitor', navIcon: '📊', navVisible: true, renderer: 'renderReliability' };
})();
