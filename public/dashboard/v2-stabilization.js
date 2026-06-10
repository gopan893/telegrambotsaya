/* V2 RC Stabilization Dashboard Renderer */

(function() {
  const API = '/api/dashboard/v2-stabilization';

  UI.renderV2Stabilization = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading V2 RC stabilization...');
    try {
      const statusRes = await Api.fetch(API);
      let auditData = null;
      let blockerData = null;
      let reportData = null;
      if (statusRes.ok && statusRes.data) {
        auditData = statusRes.data;
      }
      try {
        const blockerRes = await Api.fetch(API + '/blockers');
        if (blockerRes.ok) blockerData = blockerRes.data;
      } catch (_) {}
      try {
        const reportRes = await Api.fetch(API + '/report');
        if (reportRes.ok) reportData = reportRes.data;
      } catch (_) {}

      let html = '';
      html += '<div class="section-header"><h2>V2 RC Stabilization</h2></div>';

      html += buildAuditStatusSection(auditData);
      html += buildBlockerSection(blockerData);
      html += buildCertificationSection(reportData);
      html += buildFixPolicySection(reportData);
      html += buildRecommendationSection(auditData, blockerData);

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-primary" onclick="runV2RcAudit()">Run Full Audit</button>';
      html += '<button class="btn btn-outline" onclick="UI.renderV2Stabilization(document.getElementById(\'tab-content\'))">Refresh</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('V2 Stabilization Error', err.message);
    }
  };

  function buildAuditStatusSection(data) {
    if (!data) return UI.renderEmptyState('', 'Audit Status', 'No audit data. Run an audit to begin.');
    const status = data.status || 'checking';
    const badgeColors = {
      ready: 'var(--color-success)',
      blocked: 'var(--color-danger)',
      warning: 'var(--color-warning)',
      checking: 'var(--color-info)'
    };
    const color = badgeColors[status] || 'var(--color-warning)';
    let html = '<div class="section-header" style="margin-top:16px;"><h3>Audit Status</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<span class="badge" style="background:' + color + ';color:#fff;font-size:14px;padding:4px 12px;">' + Utils.escapeHtml(status.toUpperCase()) + '</span>';
    html += '<div class="stat-label" style="margin-top:8px;">Overall Status</div>';
    html += '</div></div>';
    if (data.blockerCount !== undefined) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="color:' + (data.blockerCount > 0 ? 'var(--color-danger)' : 'var(--color-success)') + ';">' + data.blockerCount + '</div>';
      html += '<div class="stat-label">Blockers</div>';
      html += '</div></div>';
    }
    if (data.warningCount !== undefined) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="color:' + (data.warningCount > 0 ? 'var(--color-warning)' : 'var(--color-success)') + ';">' + data.warningCount + '</div>';
      html += '<div class="stat-label">Warnings</div>';
      html += '</div></div>';
    }
    if (data.rcVersion) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value">' + Utils.escapeHtml(data.rcVersion) + '</div>';
      html += '<div class="stat-label">RC Version</div>';
      html += '</div></div>';
    }
    html += '</div>';

    const subStatuses = [
      { key: 'controlPanelStatus', label: 'Control Panel' },
      { key: 'registryV2Status', label: 'Registry v2' },
      { key: 'boundaryStatus', label: 'Boundary' },
      { key: 'performanceStatus', label: 'Performance' },
      { key: 'securityStatus', label: 'Security' },
      { key: 'privacyStatus', label: 'Privacy' },
      { key: 'safetyBoundaryStatus', label: 'Safety Boundary' },
      { key: 'docsStatus', label: 'Docs/Test' }
    ];
    const rows = subStatuses.filter(s => data[s.key]).map(s => {
      const val = data[s.key];
      const c = val === 'ok' || val === 'ready' || val === 'locked' || val === 'passed' ? 'var(--color-success)' : val === 'blocked' ? 'var(--color-danger)' : 'var(--color-warning)';
      return '<tr><td>' + Utils.escapeHtml(s.label) + '</td><td style="color:' + c + ';font-weight:600;">' + Utils.escapeHtml(val) + '</td></tr>';
    }).join('');
    if (rows) {
      html += '<table class="data-table" style="margin-top:12px;"><thead><tr><th>Subsystem</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
    return html;
  }

  function buildBlockerSection(data) {
    if (!data) return '';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Blockers & Warnings</h3></div>';
    const p0 = (data.p0Findings || data.p0 || []);
    const p1 = (data.p1Findings || data.p1 || []);
    const p2 = (data.p2Findings || data.p2 || []);
    if (p0.length === 0 && p1.length === 0 && p2.length === 0) {
      html += '<p style="color:var(--color-success);">No blockers or warnings found.</p>';
      return html;
    }
    if (p0.length > 0) {
      html += '<h4 style="color:var(--color-danger);margin-top:12px;">P0 Blockers (' + p0.length + ')</h4><ul style="color:var(--color-danger);">';
      p0.forEach(function(item) {
        var msg = item.message || item;
        html += '<li>' + Utils.escapeHtml(msg) + '</li>';
      });
      html += '</ul>';
    }
    if (p1.length > 0) {
      html += '<h4 style="color:#ff8c00;margin-top:12px;">P1 Must-Fix (' + p1.length + ')</h4><ul style="color:#ff8c00;">';
      p1.forEach(function(item) {
        var msg = item.message || item;
        html += '<li>' + Utils.escapeHtml(msg) + '</li>';
      });
      html += '</ul>';
    }
    if (p2.length > 0) {
      html += '<h4 style="color:var(--color-warning);margin-top:12px;">P2 Warnings (' + p2.length + ')</h4><ul style="color:var(--color-warning);">';
      p2.forEach(function(item) {
        var msg = item.message || item;
        html += '<li>' + Utils.escapeHtml(msg) + '</li>';
      });
      html += '</ul>';
    }
    return html;
  }

  function buildCertificationSection(reportData) {
    if (!reportData || !reportData.certification) return '';
    const cert = reportData.certification;
    const passed = cert.passed;
    const score = cert.score;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Certification Result</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + (passed ? 'var(--color-success)' : 'var(--color-danger)') + ';">' + (passed ? 'PASSED' : 'FAILED') + '</div>';
    html += '<div class="stat-label">Certification</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + score + '%</div>';
    html += '<div class="stat-label">Score</div>';
    html += '</div></div>';
    html += '</div>';
    if (cert.summary) {
      html += '<p>' + Utils.escapeHtml(cert.summary) + '</p>';
    }
    return html;
  }

  function buildFixPolicySection(reportData) {
    if (!reportData || !reportData.fixPolicy) return '';
    const policy = reportData.fixPolicy;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Allowed Fix Policy</h3></div>';
    const allowed = policy.allowed || [];
    const blocked = policy.blocked || [];
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + allowed.length + '</div>';
    html += '<div class="stat-label">Allowed Fix Types</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + blocked.length + '</div>';
    html += '<div class="stat-label">Blocked Change Types</div>';
    html += '</div></div>';
    html += '</div>';
    if (allowed.length > 0) {
      html += '<h4 style="margin-top:8px;">Allowed Fixes</h4><ul>';
      allowed.forEach(function(a) { html += '<li>' + Utils.escapeHtml(a) + '</li>'; });
      html += '</ul>';
    }
    if (blocked.length > 0) {
      html += '<h4 style="margin-top:8px;color:var(--color-danger);">Blocked Changes</h4><ul style="color:var(--color-danger);">';
      blocked.forEach(function(b) { html += '<li>' + Utils.escapeHtml(b) + '</li>'; });
      html += '</ul>';
    }
    if (policy.report && policy.report.summary) {
      html += '<p style="margin-top:8px;font-style:italic;">' + Utils.escapeHtml(policy.report.summary) + '</p>';
    }
    return html;
  }

  function buildRecommendationSection(auditData, blockerData) {
    if (!auditData && !blockerData) return '';
    const status = auditData ? auditData.status : 'checking';
    const p0Count = blockerData ? (blockerData.p0 || 0) : 0;
    let recommendation = 'No data to recommend.';
    let color = 'var(--color-warning)';
    if (status === 'ready' && p0Count === 0) {
      recommendation = 'Ready for Phase 51 production release consideration. All checks pass.';
      color = 'var(--color-success)';
    } else if (status === 'blocked' || p0Count > 0) {
      recommendation = 'Not ready. Resolve P0 blockers before proceeding to Phase 51.';
      color = 'var(--color-danger)';
    } else if (status === 'warning') {
      recommendation = 'Proceed with caution. Review P1 and P2 items before Phase 51.';
      color = 'var(--color-warning)';
    } else {
      recommendation = 'Run a full audit to get a recommendation.';
    }
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Final Recommendation</h3></div>';
    html += '<div class="card"><div class="card-body" style="border-left:4px solid ' + color + ';">';
    html += '<p style="color:' + color + ';font-weight:600;margin:0;">' + Utils.escapeHtml(recommendation) + '</p>';
    html += '</div></div>';
    return html;
  }

  window.runV2RcAudit = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Running V2 RC audit...');
    try {
      const res = await Api.fetch(API + '/audit', { method: 'POST' });
      if (res.ok) {
        UI.renderV2Stabilization(container);
        Utils.showToast('V2 RC audit completed', 'success');
      } else {
        Utils.showToast('V2 RC audit failed', 'error');
      }
    } catch (err) {
      Utils.showToast('V2 RC audit error: ' + err.message, 'error');
    }
  };
})();
