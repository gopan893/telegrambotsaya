/* Stabilization Dashboard Renderer */

(function() {
  const STABILIZATION_API = '/api/dashboard/stabilization';

  UI.renderStabilization = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading stabilization status...');
    try {
      const res = await Api.fetch(STABILIZATION_API);
      if (!res.ok) {
        container.innerHTML = UI.renderEmptyState('🔒', 'Stabilization', 'Stabilization module is not available.');
        return;
      }
      const data = res.data || {};
      const summary = data.summary || data.report || data.lockReport || {};
      const status = summary.status || 'checking';
      const score = summary.overallScore ?? summary.score ?? 0;
      const blockerCount = summary.blockerCount || 0;
      const warningCount = summary.warningCount || 0;
      const lockedCount = summary.lockedCount || 0;
      const totalChecks = summary.totalChecks || 8;

      let html = `
        <div class="section-header"><h2>🔒 V1 Final Stabilization</h2></div>
        <div class="card-grid">
          <div class="card"><div class="card-body">
            <div class="stat-value" style="color:${status === 'locked' ? 'var(--color-success)' : status === 'blocked' ? 'var(--color-danger)' : 'var(--color-warning)'}">${status.toUpperCase()}</div>
            <div class="stat-label">Lock Status</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${score}%</div>
            <div class="stat-label">Readiness Score</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${lockedCount}/${totalChecks}</div>
            <div class="stat-label">Checks Locked</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value" style="color:${blockerCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">${blockerCount}</div>
            <div class="stat-label">Blockers</div>
          </div></div>
        </div>
      `;

      const details = summary.details || data.details || {};
      const detailEntries = Object.entries(details);
      if (detailEntries.length) {
        html += '<div class="section-header" style="margin-top:24px;"><h3>Certification Details</h3></div><table class="data-table"><thead><tr><th>Check</th><th>Status</th></tr></thead><tbody>';
        for (const [key, val] of detailEntries) {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          const color = val === 'locked' ? 'var(--color-success)' : val === 'blocked' ? 'var(--color-danger)' : 'var(--color-warning)';
          html += `<tr><td>${Utils.escapeHtml(label)}</td><td style="color:${color};font-weight:600;">${Utils.escapeHtml(val)}</td></tr>`;
        }
        html += '</tbody></table>';
      }

      if (blockerCount > 0) {
        html += '<div class="section-header" style="margin-top:24px;"><h3>⚠️ Blockers</h3></div><ul style="color:var(--color-danger);">';
        (summary.blockers || []).forEach(b => { html += `<li>${Utils.escapeHtml(b)}</li>`; });
        html += '</ul>';
      }

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-primary" onclick="runStabilizationReadinessGate()">Run Readiness Gate</button>';
      html += '<button class="btn btn-outline" onclick="runStabilizationCertifyControlPanel()">Certify Control Panel</button>';
      html += '<button class="btn btn-outline" onclick="runStabilizationCertifyApi()">Certify API</button>';
      html += '<button class="btn btn-outline" onclick="runStabilizationCertifyPwa()">Certify PWA/Mobile</button>';
      html += '<button class="btn btn-outline" onclick="runStabilizationCertifyTelegram()">Certify Telegram</button>';
      html += '<button class="btn btn-outline" onclick="runStabilizationCertifySafety()">Certify Safety</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('Stabilization Error', err.message);
    }
  };

  window.runStabilizationReadinessGate = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Running readiness gate...');
    try {
      const res = await Api.fetch(STABILIZATION_API + '/readiness-gate', { method: 'POST' });
      if (res.ok) {
        UI.renderStabilization(container);
        Utils.showToast('Readiness gate completed', 'success');
      } else {
        Utils.showToast('Readiness gate failed', 'error');
      }
    } catch (err) {
      Utils.showToast('Readiness gate error: ' + err.message, 'error');
    }
  };

  window.runStabilizationCertifyControlPanel = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Certifying control panel...');
    try {
      await Api.fetch(STABILIZATION_API + '/certify-control-panel');
      UI.renderStabilization(container);
      Utils.showToast('Control panel certifier ran', 'success');
    } catch (err) { Utils.showToast('Certifier error: ' + err.message, 'error'); }
  };

  window.runStabilizationCertifyApi = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Certifying dashboard APIs...');
    try {
      await Api.fetch(STABILIZATION_API + '/certify-api');
      UI.renderStabilization(container);
      Utils.showToast('API certifier ran', 'success');
    } catch (err) { Utils.showToast('Certifier error: ' + err.message, 'error'); }
  };

  window.runStabilizationCertifyPwa = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Certifying PWA/mobile...');
    try {
      await Api.fetch(STABILIZATION_API + '/certify-pwa-mobile');
      UI.renderStabilization(container);
      Utils.showToast('PWA/mobile certifier ran', 'success');
    } catch (err) { Utils.showToast('Certifier error: ' + err.message, 'error'); }
  };

  window.runStabilizationCertifyTelegram = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Certifying Telegram commands...');
    try {
      await Api.fetch(STABILIZATION_API + '/certify-telegram');
      UI.renderStabilization(container);
      Utils.showToast('Telegram certifier ran', 'success');
    } catch (err) { Utils.showToast('Certifier error: ' + err.message, 'error'); }
  };

  window.runStabilizationCertifySafety = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Certifying safety boundaries...');
    try {
      await Api.fetch(STABILIZATION_API + '/certify-safety');
      UI.renderStabilization(container);
      Utils.showToast('Safety certifier ran', 'success');
    } catch (err) { Utils.showToast('Certifier error: ' + err.message, 'error'); }
  };
})();
