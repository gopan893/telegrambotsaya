/* Performance Dashboard Renderer */

(function() {
  const PERF_API = '/api/dashboard/performance';

  UI.renderPerformance = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading performance data...');
    try {
      const res = await Api.fetch(PERF_API);
      if (!res.ok) {
        container.innerHTML = UI.renderEmptyState('⚡', 'Performance', 'Performance module not available.');
        return;
      }
      const data = res.data || {};
      const scorecard = data.scorecard || {};
      const budgets = data.budgets || {};
      const overallScore = scorecard.overallScore ?? scorecard.score ?? 0;

      let html = `
        <div class="section-header"><h2>⚡ Performance Optimization</h2></div>
        <div class="card-grid">
          <div class="card"><div class="card-body">
            <div class="stat-value" style="color:${overallScore >= 85 ? 'var(--color-success)' : overallScore >= 70 ? 'var(--color-warning)' : 'var(--color-danger)'}">${overallScore}%</div>
            <div class="stat-label">Performance Score</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${data.startupCost ?? '-'}</div>
            <div class="stat-label">Startup Files</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${data.dashboardBundle ?? '-'}</div>
            <div class="stat-label">Dashboard Files</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${data.apiEndpoints ?? '-'}</div>
            <div class="stat-label">API Endpoints</div>
          </div></div>
        </div>
      `;

      if (scorecard.details) {
        html += '<div class="section-header" style="margin-top:24px;"><h3>Scores</h3></div><table class="data-table"><thead><tr><th>Category</th><th>Score</th></tr></thead><tbody>';
        for (const [key, val] of Object.entries(scorecard.details)) {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          html += '<tr><td>' + Utils.escapeHtml(label) + '</td><td>' + Utils.escapeHtml(String(val)) + '</td></tr>';
        }
        html += '</tbody></table>';
      }

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-outline" onclick="loadPerfSection(\'profile-startup\',\'Startup Profile\',\'POST\')">Profile Startup</button>';
      html += '<button class="btn btn-outline" onclick="loadPerfSection(\'import-cost\',\'Import Cost\')">Import Cost</button>';
      html += '<button class="btn btn-outline" onclick="loadPerfSection(\'dashboard-bundle\',\'Bundle Audit\')">Bundle Audit</button>';
      html += '<button class="btn btn-outline" onclick="loadPerfSection(\'payloads\',\'Payload Audit\')">Payload Audit</button>';
      html += '<button class="btn btn-outline" onclick="loadPerfSection(\'cache\',\'Cache Audit\')">Cache Audit</button>';
      html += '<button class="btn btn-outline" onclick="loadPerfSection(\'budgets\',\'Budgets\')">Budgets</button>';
      html += '<button class="btn btn-outline" onclick="loadPerfSection(\'scorecard\',\'Scorecard\')">Scorecard</button>';
      html += '<button class="btn btn-outline" onclick="loadPerfSection(\'regressions\',\'Regressions\')">Regressions</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('Performance Error', err.message);
    }
  };

  window.loadPerfSection = async function(endpoint, title, method) {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading ' + title + '...');
    try {
      const opts = method === 'POST' ? { method: 'POST' } : {};
      const res = await Api.fetch(PERF_API + '/' + endpoint, opts);
      if (res.ok) {
        const data = res.data || {};
        let html = '<div class="section-header"><h2>' + Utils.escapeHtml(title) + '</h2></div>';
        html += '<pre style="max-height:60vh;overflow:auto;background:var(--bg-secondary);padding:16px;border-radius:8px;font-size:12px;">' + Utils.escapeHtml(JSON.stringify(data, null, 2)) + '</pre>';
        html += '<div style="margin-top:16px;"><button class="btn btn-outline" onclick="UI.renderPerformance(document.getElementById(\'tab-content\'))">Back</button></div>';
        container.innerHTML = html;
      }
    } catch (err) { container.innerHTML = UI.renderError(title + ' Error', err.message); }
  };
})();
