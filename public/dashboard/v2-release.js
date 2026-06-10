/* V2 Release Dashboard Renderer */

(function() {
  const RELEASE_API = '/api/dashboard/v2-release';

  UI.renderV2Release = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading V2 release data...');
    try {
      const res = await Api.fetch(RELEASE_API);
      if (!res.ok) {
        container.innerHTML = UI.renderEmptyState('🚀', 'V2 Release', 'V2 Release module not available.');
        return;
      }
      const data = res.data || {};
      const candidates = data.candidates || [];
      const latest = data.latest || null;
      const status = latest ? latest.status : 'not_started';
      const version = latest ? latest.version : 'v2.0.0-rc.1';

      let html = `
        <div class="section-header"><h2>🚀 AI OS v2 Release Candidate</h2></div>
        <div class="card-grid">
          <div class="card"><div class="card-body">
            <div class="stat-value">${Utils.escapeHtml(version)}</div>
            <div class="stat-label">Version</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value" style="color:${status === 'ready' ? 'var(--color-success)' : status === 'blocked' ? 'var(--color-danger)' : 'var(--color-warning)'}">${Utils.escapeHtml(status.toUpperCase())}</div>
            <div class="stat-label">Status</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${candidates.length}</div>
            <div class="stat-label">Candidates</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${latest && latest.blockers ? latest.blockers.length : 0}</div>
            <div class="stat-label" style="color:${latest && latest.blockers && latest.blockers.length ? 'var(--color-danger)' : 'var(--color-success)'}">Blockers</div>
          </div></div>
        </div>
      `;

      if (latest) {
        html += '<div class="section-header" style="margin-top:24px;"><h3>Latest Candidate Details</h3></div><table class="data-table"><thead><tr><th>Check</th><th>Status</th></tr></thead><tbody>';
        const checks = {
          'Registry v2': latest.registryV2Status,
          'Boundary': latest.boundaryStatus,
          'Performance': latest.performanceStatus,
          'Control Panel': latest.controlPanelStatus,
          'Safety': latest.safetyStatus,
          'Compatibility': latest.compatibilityStatus
        };
        for (const [key, val] of Object.entries(checks)) {
          const color = val === 'ready' || val === 'locked' || val === 'passed' ? 'var(--color-success)' : val === 'blocked' ? 'var(--color-danger)' : 'var(--color-warning)';
          html += '<tr><td>' + Utils.escapeHtml(key) + '</td><td style="color:' + color + ';font-weight:600;">' + Utils.escapeHtml(val || 'unknown') + '</td></tr>';
        }
        html += '</tbody></table>';
      }

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-primary" onclick="createV2ReleaseCandidate()">Create RC</button>';
      if (latest) {
        html += '<button class="btn btn-outline" onclick="runV2Readiness(\'' + latest.id + '\')">Run Readiness</button>';
        html += '<button class="btn btn-outline" onclick="runV2Regression(\'' + latest.id + '\')">Run Regression</button>';
        html += '<button class="btn btn-outline" onclick="loadReleaseSection(\'' + latest.id + '\',\'compatibility\',\'Compatibility\')">Compatibility</button>';
        html += '<button class="btn btn-outline" onclick="loadReleaseSection(\'' + latest.id + '\',\'changelog\',\'Changelog\')">Changelog</button>';
        html += '<button class="btn btn-outline" onclick="loadReleaseSection(\'' + latest.id + '\',\'upgrade-guide\',\'Upgrade Guide\')">Upgrade Guide</button>';
        html += '<button class="btn btn-outline" onclick="loadReleaseSection(\'' + latest.id + '\',\'rollback-plan\',\'Rollback Plan\')">Rollback Plan</button>';
        html += '<button class="btn btn-outline" onclick="loadReleaseSection(\'' + latest.id + '\',\'notes\',\'Release Notes\')">Release Notes</button>';
        html += '<button class="btn btn-outline" onclick="createV2Proposal(\'' + latest.id + '\')">Create Proposal</button>';
      }
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('V2 Release Error', err.message);
    }
  };

  window.createV2ReleaseCandidate = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Creating release candidate...');
    try {
      const res = await Api.fetch(RELEASE_API + '/create', { method: 'POST', body: JSON.stringify({ version: 'v2.0.0-rc.1' }), headers: { 'Content-Type': 'application/json' } });
      if (res.ok) { UI.renderV2Release(container); Utils.showToast('Release candidate created', 'success'); }
      else { Utils.showToast('Create failed', 'error'); }
    } catch (err) { Utils.showToast('Create error: ' + err.message, 'error'); }
  };

  window.runV2Readiness = async function(id) {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Running readiness gate...');
    try {
      const res = await Api.fetch(RELEASE_API + '/' + id + '/readiness', { method: 'POST' });
      if (res.ok) { UI.renderV2Release(container); Utils.showToast('Readiness complete', 'success'); }
      else { Utils.showToast('Readiness failed', 'error'); }
    } catch (err) { Utils.showToast('Readiness error: ' + err.message, 'error'); }
  };

  window.runV2Regression = async function(id) {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Running regression suite...');
    try {
      const res = await Api.fetch(RELEASE_API + '/' + id + '/regression-suite', { method: 'POST' });
      if (res.ok) { UI.renderV2Release(container); Utils.showToast('Regression complete', 'success'); }
      else { Utils.showToast('Regression failed', 'error'); }
    } catch (err) { Utils.showToast('Regression error: ' + err.message, 'error'); }
  };

  window.createV2Proposal = async function(id) {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Creating release proposal...');
    try {
      const res = await Api.fetch(RELEASE_API + '/' + id + '/proposal', { method: 'POST' });
      if (res.ok) { UI.renderV2Release(container); Utils.showToast('Proposal created (not executed)', 'success'); }
      else { Utils.showToast('Proposal failed', 'error'); }
    } catch (err) { Utils.showToast('Proposal error: ' + err.message, 'error'); }
  };

  window.loadReleaseSection = async function(id, endpoint, title) {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading ' + title + '...');
    try {
      const res = await Api.fetch(RELEASE_API + '/' + id + '/' + endpoint);
      if (res.ok) {
        const data = res.data || {};
        let html = '<div class="section-header"><h2>' + Utils.escapeHtml(title) + '</h2></div>';
        html += '<pre style="max-height:60vh;overflow:auto;background:var(--bg-secondary);padding:16px;border-radius:8px;font-size:12px;">' + Utils.escapeHtml(typeof data === 'string' ? data : JSON.stringify(data, null, 2)) + '</pre>';
        html += '<div style="margin-top:16px;"><button class="btn btn-outline" onclick="UI.renderV2Release(document.getElementById(\'tab-content\'))">Back</button></div>';
        container.innerHTML = html;
      }
    } catch (err) { container.innerHTML = UI.renderError(title + ' Error', err.message); }
  };
})();
