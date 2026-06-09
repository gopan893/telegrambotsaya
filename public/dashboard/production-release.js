/* Production Release Manager Dashboard Tab */

(function() {
  if (typeof window.DashboardUtils === 'undefined') {
    window.DashboardUtils = window.DashboardUtils || {};
  }
  const DU = window.DashboardUtils;

  async function api(path, opts = {}) {
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
      <div class="tab-header"><h2>Production Release Manager</h2></div>
      <div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" id="pr-create">Create v1.0.0 Release</button>
        <button class="btn btn-outline" id="pr-refresh">Refresh</button>
      </div>
      <div id="pr-status"><p>Loading...</p></div>
      <div id="pr-details" style="display:none"></div>
    `;
    document.getElementById('pr-create').addEventListener('click', createRelease);
    document.getElementById('pr-refresh').addEventListener('click', () => loadStatus(contentEl));
    loadStatus(contentEl);
  }

  async function loadStatus(contentEl) {
    const el = document.getElementById('pr-status');
    if (!el) return;
    el.innerHTML = '<p>Loading release status...</p>';
    const data = await api('/production-release');
    if (!data.ok) { el.innerHTML = '<p class="error">Failed to load release status</p>'; return; }
    const releases = data.releases || [];
    const latest = data.latest;
    let html = '<div class="card"><div class="card-body">';
    html += '<h3>Release Status</h3>';
    html += '<p>Total releases: ' + (data.count || 0) + '</p>';
    if (latest) {
      html += '<h4>Latest Release</h4>';
      html += '<table class="info-table"><tr><td>Version</td><td>' + (latest.version || '-') + '</td></tr>';
      html += '<tr><td>Status</td><td><span class="badge badge-' + (latest.status === 'ready' ? 'success' : latest.status === 'blocked' ? 'danger' : 'info') + '">' + (latest.status || 'draft') + '</span></td></tr>';
      html += '<tr><td>Created</td><td>' + (latest.createdAt || '-') + '</td></tr>';
      if (latest.blockers && latest.blockers.length > 0) html += '<tr><td>Blockers</td><td class="text-danger">' + latest.blockers.join(', ') + '</td></tr>';
      html += '</table>';
      html += '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">';
      html += '<button class="btn btn-sm btn-primary" onclick="window.runReadiness(\'' + latest.id + '\')">Run Readiness</button>';
      html += '<button class="btn btn-sm btn-outline" onclick="window.viewRolloutPlan(\'' + latest.id + '\')">Rollout Plan</button>';
      html += '<button class="btn btn-sm btn-outline" onclick="window.createGitHubProposal(\'' + latest.id + '\')">GitHub Proposal</button>';
      html += '<button class="btn btn-sm btn-outline" onclick="window.createDeployProposal(\'' + latest.id + '\')">Deploy Proposal</button>';
      html += '<button class="btn btn-sm btn-outline" onclick="window.viewVerification(\'' + latest.id + '\')">Verification</button>';
      html += '<button class="btn btn-sm btn-outline" onclick="window.viewReleaseReport(\'' + latest.id + '\')">Report</button>';
      html += '</div></div></div>';
    } else {
      html += '<p>No production release created yet. Click "Create v1.0.0 Release" to start.</p>';
    }
    el.innerHTML = html;
  }

  async function createRelease() {
    const data = await api('/production-release/create', { method: 'POST', body: { version: 'v1.0.0', sourceRcVersion: 'v1.0.0-rc.1' } });
    if (data.ok) {
      showToast('Release v1.0.0 created', 'success');
      const el = document.getElementById('pr-status');
      if (el) loadStatus(el);
    } else {
      showToast('Failed: ' + (data.error || 'unknown'), 'error');
    }
  }

  window.runReadiness = async function(id) {
    const data = await api('/production-release/' + id + '/readiness', { method: 'POST' });
    const el = document.getElementById('pr-details');
    if (!el) return;
    el.style.display = 'block';
    if (data.ok) {
      el.innerHTML = '<div class="card"><div class="card-body"><h3>Readiness Status: ' + (data.status || 'unknown') + '</h3>' +
        '<p>Blockers: ' + ((data.blockers || []).length || 0) + '</p>' +
        '<p>Warnings: ' + ((data.warnings || []).length || 0) + '</p></div></div>';
    } else {
      el.innerHTML = '<div class="card"><div class="card-body"><h3>Readiness: Blocked</h3><p class="text-danger">' + (data.error || 'Unknown blockers') + '</p></div></div>';
    }
  };

  window.viewRolloutPlan = async function(id) {
    const data = await api('/production-release/' + id + '/rollout-plan');
    const el = document.getElementById('pr-details');
    if (!el) return;
    el.style.display = 'block';
    if (!data.ok) { el.innerHTML = '<p class="error">Failed to load rollout plan</p>'; return; }
    let html = '<div class="card"><div class="card-body"><h3>Rollout Plan</h3><table class="info-table"><tr><th>Stage</th><th>Status</th></tr>';
    const stages = data.plan && data.plan.stages ? data.plan.stages : [];
    stages.forEach(function(s) {
      html += '<tr><td>' + s.stage + '</td><td><span class="badge badge-' + (s.status === 'completed' ? 'success' : 'info') + '">' + s.status + '</span></td></tr>';
    });
    html += '</table></div></div>';
    el.innerHTML = html;
  };

  window.createGitHubProposal = async function(id) {
    const data = await api('/production-release/' + id + '/github-proposal', { method: 'POST' });
    const el = document.getElementById('pr-details');
    if (!el) return;
    el.style.display = 'block';
    if (!data.ok) { el.innerHTML = '<p class="error">Failed to create GitHub proposal</p>'; return; }
    el.innerHTML = '<div class="card"><div class="card-body"><h3>GitHub Release Proposal (Proposal Only)</h3>' +
      '<p class="text-warning">This is a proposal only. No direct GitHub release/tag was created.</p>' +
      '<p>Tag: ' + (data.tagProposal && data.tagProposal.details ? data.tagProposal.details.tag : 'v1.0.0') + '</p>' +
      '<p>Evaluation required: Yes | Approval required: Yes</p></div></div>';
  };

  window.createDeployProposal = async function(id) {
    const data = await api('/production-release/' + id + '/deploy-proposal', { method: 'POST' });
    const el = document.getElementById('pr-details');
    if (!el) return;
    el.style.display = 'block';
    if (!data.ok) { el.innerHTML = '<p class="error">Failed to create deploy proposal</p>'; return; }
    el.innerHTML = '<div class="card"><div class="card-body"><h3>Deploy Proposal (Proposal Only)</h3>' +
      '<p class="text-warning">This is a proposal only. No direct deploy was triggered.</p>' +
      '<p>Method: ' + (data.deployProposal && data.deployProposal.details ? data.deployProposal.details.deployMethod : 'proposal') + '</p>' +
      '<p>Evaluation required: Yes | Approval required: Yes</p></div></div>';
  };

  window.viewVerification = async function(id) {
    const data = await api('/production-release/' + id + '/verification');
    const el = document.getElementById('pr-details');
    if (!el) return;
    el.style.display = 'block';
    if (!data.ok) { el.innerHTML = '<p class="error">Failed to load verification</p>'; return; }
    let html = '<div class="card"><div class="card-body"><h3>Release Verification</h3><table class="info-table">';
    if (data.checks) {
      Object.keys(data.checks).forEach(function(k) {
        html += '<tr><td>' + k + '</td><td><span class="badge badge-' + (data.checks[k] === 'pass' ? 'success' : 'danger') + '">' + data.checks[k] + '</span></td></tr>';
      });
    }
    html += '</table><p>All pass: ' + (data.allPass ? 'Yes' : 'No') + '</p></div></div>';
    el.innerHTML = html;
  };

  window.viewReleaseReport = async function(id) {
    const data = await api('/production-release/' + id + '/report');
    const el = document.getElementById('pr-details');
    if (!el) return;
    el.style.display = 'block';
    if (!data.ok) { el.innerHTML = '<p class="error">Failed to load report</p>'; return; }
    html = '<div class="card"><div class="card-body"><h3>Release Report</h3>';
    if (data.summary) html += '<p>RC Audit: ' + (data.summary.rcAuditStatus || '-') + ' | P0: ' + (data.summary.p0Count || 0) + ' | P1: ' + (data.summary.p1Count || 0) + '</p>';
    if (data.readiness) {
      html += '<h4>Rollout Readiness</h4><table class="info-table">';
      if (data.readiness.gates) {
        Object.keys(data.readiness.gates).forEach(function(g) {
          html += '<tr><td>' + g + '</td><td><span class="badge badge-' + (data.readiness.gates[g] === 'ready' ? 'success' : 'danger') + '">' + data.readiness.gates[g] + '</span></td></tr>';
        });
      }
      html += '</table>';
    }
    html += '</div></div>';
    el.innerHTML = html;
  };

  function showToast(msg, type) {
    var t = document.getElementById('toast-container');
    if (!t) return;
    var d = document.createElement('div');
    d.className = 'toast toast-' + (type || 'info');
    d.textContent = msg;
    t.appendChild(d);
    setTimeout(function() { if (d.parentNode) d.remove(); }, 4000);
  }

  window.renderProductionRelease = render;
  if (window.UI) window.UI.renderProductionRelease = render;
  window.DASHBOARD_TABS = window.DASHBOARD_TABS || {};
  window.DASHBOARD_TABS['production-release'] = { label: 'Production Release', title: 'Production Release Manager', navIcon: '🚀', navVisible: true, renderer: 'renderProductionRelease' };
})();
