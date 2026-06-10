/* V2 Planning Dashboard Renderer */

(function() {
  const V2_API = '/api/dashboard/v2-planning';

  UI.renderV2Planning = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading V2 planning data...');
    try {
      const res = await Api.fetch(V2_API);
      if (!res.ok) {
        container.innerHTML = UI.renderEmptyState('📋', 'V2 Planning', 'V2 Planning module is not available.');
        return;
      }
      const data = res.data || {};
      const gateStatus = data.gateStatus || data.status || 'not_started';
      const score = data.overallScore ?? data.score ?? 0;

      let html = `
        <div class="section-header"><h2>📋 AI OS v2 Planning Gate</h2></div>
        <div class="card-grid">
          <div class="card"><div class="card-body">
            <div class="stat-value" style="color:${gateStatus === 'locked' || gateStatus === 'passed' ? 'var(--color-success)' : 'var(--color-warning)'}">${Utils.escapeHtml(gateStatus.toUpperCase())}</div>
            <div class="stat-label">Gate Status</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${score}%</div>
            <div class="stat-label">Planning Score</div>
          </div></div>
        </div>
      `;

      const scope = data.scope || data.scopeItems || [];
      if (Array.isArray(scope) && scope.length) {
        html += '<div class="section-header" style="margin-top:24px;"><h3>Scope</h3></div><table class="data-table"><thead><tr><th>Category</th><th>Priority</th><th>Description</th></tr></thead><tbody>';
        scope.forEach(s => {
          html += `<tr><td>${Utils.escapeHtml(s.category || s.id || '')}</td><td>${Utils.escapeHtml(s.priority || '')}</td><td>${Utils.escapeHtml(s.description || '')}</td></tr>`;
        });
        html += '</tbody></table>';
      }

      const risks = data.risks || data.riskRegister || [];
      if (Array.isArray(risks) && risks.length) {
        html += '<div class="section-header" style="margin-top:24px;"><h3>Risks</h3></div><table class="data-table"><thead><tr><th>Risk</th><th>Severity</th><th>Mitigation</th></tr></thead><tbody>';
        risks.forEach(r => {
          html += `<tr><td>${Utils.escapeHtml(r.category || r.id || '')}</td><td>${Utils.escapeHtml(r.severity || '')}</td><td>${Utils.escapeHtml(r.mitigation || r.recommendation || '')}</td></tr>`;
        });
        html += '</tbody></table>';
      }

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-primary" onclick="runV2PlanningGate()">Run Planning Gate</button>';
      html += '<button class="btn btn-outline" onclick="loadV2Scope()">View Scope</button>';
      html += '<button class="btn btn-outline" onclick="loadV2Principles()">View Principles</button>';
      html += '<button class="btn btn-outline" onclick="loadV2MigrationPlan()">Migration Plan</button>';
      html += '<button class="btn btn-outline" onclick="loadV2Risks()">Risk Register</button>';
      html += '<button class="btn btn-outline" onclick="loadV2Criteria()">Acceptance Criteria</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('V2 Planning Error', err.message);
    }
  };

  window.runV2PlanningGate = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Running V2 planning gate...');
    try {
      const res = await Api.fetch(V2_API + '/run-gate', { method: 'POST' });
      if (res.ok) { UI.renderV2Planning(container); Utils.showToast('Planning gate completed', 'success'); }
      else { Utils.showToast('Planning gate failed', 'error'); }
    } catch (err) { Utils.showToast('Gate error: ' + err.message, 'error'); }
  };

  window.loadV2Scope = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading V2 scope...');
    try {
      const res = await Api.fetch(V2_API + '/scope');
      if (res.ok) {
        const data = res.data || {};
        let html = '<div class="section-header"><h2>V2 Scope</h2></div>';
        const items = data.items || data.scope || [];
        if (Array.isArray(items) && items.length) {
          html += '<table class="data-table"><thead><tr><th>Category</th><th>Priority</th><th>Description</th></tr></thead><tbody>';
          items.forEach(s => { html += `<tr><td>${Utils.escapeHtml(s.category || '')}</td><td>${Utils.escapeHtml(s.priority || '')}</td><td>${Utils.escapeHtml(s.description || '')}</td></tr>`; });
          html += '</tbody></table>';
        } else { html += UI.renderEmptyState('📋', 'No scope defined', 'Run planning gate first.'); }
        container.innerHTML = html;
      }
    } catch (err) { container.innerHTML = UI.renderError('Scope Error', err.message); }
  };

  window.loadV2Principles = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading V2 principles...');
    try {
      const res = await Api.fetch(V2_API + '/principles');
      if (res.ok) {
        const data = res.data || {};
        let html = '<div class="section-header"><h2>V2 Architecture Principles</h2></div>';
        const principles = data.principles || data.items || [];
        if (Array.isArray(principles) && principles.length) {
          html += '<ul style="line-height:2;">';
          principles.forEach(p => { html += `<li><strong>${Utils.escapeHtml(p.title || p.name || '')}:</strong> ${Utils.escapeHtml(p.description || '')}</li>`; });
          html += '</ul>';
        } else { html += UI.renderEmptyState('📋', 'No principles defined', ''); }
        container.innerHTML = html;
      }
    } catch (err) { container.innerHTML = UI.renderError('Principles Error', err.message); }
  };

  window.loadV2MigrationPlan = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading migration plan...');
    try {
      const res = await Api.fetch(V2_API + '/migration-plan');
      if (res.ok) {
        const data = res.data || {};
        let html = '<div class="section-header"><h2>V2 Migration Plan</h2></div>';
        const phases = data.phases || data.steps || [];
        if (Array.isArray(phases) && phases.length) {
          html += '<table class="data-table"><thead><tr><th>Phase</th><th>Description</th><th>Files Affected</th></tr></thead><tbody>';
          phases.forEach(p => {
            const files = Array.isArray(p.files) ? p.files.join(', ') : p.files || '';
            html += `<tr><td>${Utils.escapeHtml(p.phase || p.name || '')}</td><td>${Utils.escapeHtml(p.description || '')}</td><td>${Utils.escapeHtml(files)}</td></tr>`;
          });
          html += '</tbody></table>';
        } else { html += UI.renderEmptyState('📋', 'No migration plan', 'Run planning gate first.'); }
        container.innerHTML = html;
      }
    } catch (err) { container.innerHTML = UI.renderError('Migration Error', err.message); }
  };

  window.loadV2Risks = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading risk register...');
    try {
      const res = await Api.fetch(V2_API + '/risk-register');
      if (res.ok) {
        const data = res.data || {};
        let html = '<div class="section-header"><h2>V2 Risk Register</h2></div>';
        const risks = data.risks || data.items || [];
        if (Array.isArray(risks) && risks.length) {
          html += '<table class="data-table"><thead><tr><th>Category</th><th>Severity</th><th>Mitigation</th></tr></thead><tbody>';
          risks.forEach(r => { html += `<tr><td>${Utils.escapeHtml(r.category || '')}</td><td>${Utils.escapeHtml(r.severity || '')}</td><td>${Utils.escapeHtml(r.mitigation || r.recommendation || '')}</td></tr>`; });
          html += '</tbody></table>';
        } else { html += UI.renderEmptyState('📋', 'No risks defined', ''); }
        container.innerHTML = html;
      }
    } catch (err) { container.innerHTML = UI.renderError('Risk Error', err.message); }
  };

  window.loadV2Criteria = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading acceptance criteria...');
    try {
      const res = await Api.fetch(V2_API + '/acceptance-criteria');
      if (res.ok) {
        const data = res.data || {};
        let html = '<div class="section-header"><h2>V2 Acceptance Criteria</h2></div>';
        const criteria = data.criteria || data.items || [];
        if (Array.isArray(criteria) && criteria.length) {
          html += '<ul style="line-height:2;">';
          criteria.forEach(c => { html += `<li>${Utils.escapeHtml(c.description || c.title || '')}</li>`; });
          html += '</ul>';
        } else { html += UI.renderEmptyState('📋', 'No criteria defined', ''); }
        container.innerHTML = html;
      }
    } catch (err) { container.innerHTML = UI.renderError('Criteria Error', err.message); }
  };
})();
