'use strict';

(function () {
  var API_PREFIX = '/api/dashboard/security';
  var auditHistory = [];

  var ACTION_CONFIG = {
    full_audit: { label: 'Full Audit', endpoint: '/audit/full', method: 'post' },
    secret_scan: { label: 'Secret Scan', endpoint: '/secret-scan', method: 'post' },
    env_drift: { label: 'Env Drift', endpoint: '/env-drift', method: 'post' },
    permission_audit: { label: 'Permission Audit', endpoint: '/permission-audit', method: 'post' },
    capability_audit: { label: 'Capability Audit', endpoint: '/capability-audit', method: 'post' },
    bypass_audit: { label: 'Bypass Audit', endpoint: '/bypass-audit', method: 'post' },
    redteam: { label: 'Red-Team', endpoint: '/redteam', method: 'post' },
    scorecard: { label: 'Scorecard', endpoint: '/scorecard', method: 'get' }
  };

  function esc(text) {
    if (window.Utils && Utils.escapeHtml) return Utils.escapeHtml(text);
    return String(text ?? '').replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function statusBadge(status) {
    var clean = String(status || 'unknown').toLowerCase();
    var cls = 'badge-info';
    if (['pass', 'passed', 'safe', 'healthy', 'secure', 'ok', 'success', 'none', 'compliant', 'closed', 'resolved'].indexOf(clean) !== -1) cls = 'badge-passed';
    else if (['fail', 'failed', 'danger', 'critical', 'blocked', 'high', 'breach', 'open', 'drifted', 'vulnerable'].indexOf(clean) !== -1) cls = 'badge-danger';
    else if (['warning', 'warn', 'medium', 'degraded', 'suspicious', 'attention', 'partial'].indexOf(clean) !== -1) cls = 'badge-warning';
    return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
  }

  function apiGet(path) {
    if (Api.apiGet) return Api.apiGet(path);
    return Api.get(path);
  }

  function apiPost(path, body) {
    if (body === void 0) body = {};
    if (Api.apiPost) return Api.apiPost(path, body);
    return Api.post(path, body);
  }

  function extractData(res) {
    if (res && typeof res === 'object' && 'ok' in res) {
      return res.ok ? res.data : null;
    }
    return res;
  }

  function getResultSummary(type, data) {
    if (!data) return 'No data';
    switch (type) {
      case 'scorecard':
        return 'Score: ' + esc(data.overall ?? data.score ?? 'N/A');
      case 'full_audit':
        return 'Audit: ' + esc(data.auditId || data.id || 'done');
      case 'secret_scan':
        var sf = data.findings || data.secrets || [];
        return sf.length + ' finding(s)';
      case 'env_drift':
        var di = data.issues || data.drifts || [];
        return di.length + ' issue(s)';
      case 'permission_audit':
        var pf = data.findings || data.permissions || [];
        return pf.length + ' finding(s)';
      case 'capability_audit':
        var cr = data.risks || data.capabilities || [];
        return cr.length + ' risk(s)';
      case 'bypass_audit':
        return 'Status: ' + esc(data.status || data.overall || 'done');
      case 'redteam':
        var p = data.passed || 0;
        var f = data.failed || 0;
        return 'Passed: ' + p + ', Failed: ' + f;
      default:
        return 'Completed';
    }
  }

  function renderSummaryCards(data, type) {
    var area = document.getElementById('security-summary');
    if (!area) return;
    var cards = [];

    switch (type) {
      case 'scorecard':
        cards.push({ label: 'Overall Score', value: (data.overall ?? data.score ?? 0) + '%' });
        if (data.categories) {
          Object.keys(data.categories).slice(0, 3).forEach(function (k) {
            cards.push({ label: k.replace(/_/g, ' '), value: data.categories[k] + '%' });
          });
        }
        break;
      case 'full_audit':
        cards.push({ label: 'Audit ID', value: esc(data.auditId || data.id || '-').slice(0, 16) });
        if (data.sections) cards.push({ label: 'Sections', value: data.sections.length || 0 });
        if (data.counts || data.summary) {
          var c = data.counts || data.summary || {};
          Object.keys(c).slice(0, 3).forEach(function (k) {
            cards.push({ label: k.replace(/_/g, ' '), value: c[k] });
          });
        }
        break;
      case 'secret_scan':
      case 'secret_scan_results':
        var sf = data.findings || data.secrets || [];
        cards.push({ label: 'Findings', value: sf.length });
        cards.push({ label: 'Status', value: sf.length === 0 ? 'Clean' : 'Issues Found' });
        break;
      case 'env_drift':
        var di = data.issues || data.drifts || [];
        cards.push({ label: 'Drifted', value: di.length });
        if (data.total) cards.push({ label: 'Total Checks', value: data.total });
        break;
      case 'permission_audit':
        var pf = data.findings || data.permissions || [];
        cards.push({ label: 'Findings', value: pf.length });
        break;
      case 'capability_audit':
        var cr = data.risks || data.capabilities || [];
        var high = cr.filter(function (r) { return (r.riskLevel || r.severity || '').toLowerCase() === 'high' || (r.riskLevel || r.severity || '').toLowerCase() === 'danger'; }).length;
        cards.push({ label: 'Risks', value: cr.length });
        cards.push({ label: 'High', value: high });
        break;
      case 'bypass_audit':
        cards.push({ label: 'Status', value: esc(data.status || data.overall || 'Unknown') });
        var bp = data.paths || data.bypasses || [];
        cards.push({ label: 'Paths', value: bp.length });
        break;
      case 'redteam':
        cards.push({ label: 'Passed', value: data.passed || 0 });
        cards.push({ label: 'Failed', value: data.failed || 0 });
        cards.push({ label: 'Overall', value: esc(data.overall || data.result || (data.failed > 0 ? 'Fail' : 'Pass')) });
        break;
    }

    area.innerHTML = cards.map(function (c) {
      return '<div class="card" style="padding:16px; text-align:center;">' +
        '<div class="card-value" style="font-size:24px;">' + esc(c.value) + '</div>' +
        '<div class="card-title" style="margin-top:4px;">' + esc(c.label) + '</div>' +
        '</div>';
    }).join('');
  }

  window.renderSecurity = function renderSecurity() {
    var container = document.getElementById('tab-content');
    if (!container) return;

    container.innerHTML =
      '<div id="security-container">' +
        '<div class="section-header">' +
          '<h2>\uD83D\uDEE1\uFE0F Security Center</h2>' +
        '</div>' +

        '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">' +
          '<button class="btn btn-primary" data-sec-action="full_audit">\uD83D\uDD0D Full Audit</button>' +
          '<button class="btn btn-outline" data-sec-action="secret_scan">\uD83D\uDD0E Secret Scan</button>' +
          '<button class="btn btn-outline" data-sec-action="env_drift">\uD83C\uDF10 Env Drift</button>' +
          '<button class="btn btn-outline" data-sec-action="permission_audit">\uD83D\uDC64 Permission Audit</button>' +
          '<button class="btn btn-outline" data-sec-action="capability_audit">\u26A0\uFE0F Capability Audit</button>' +
          '<button class="btn btn-outline" data-sec-action="bypass_audit">\uD83D\uDEE1\uFE0F Bypass Audit</button>' +
          '<button class="btn btn-outline" data-sec-action="redteam">\uD83D\uDD34 Red-Team</button>' +
          '<button class="btn btn-outline" data-sec-action="scorecard">\uD83D\uDCCA Scorecard</button>' +
        '</div>' +

        '<div id="security-summary" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:12px; margin-bottom:20px;"></div>' +

        '<div id="security-results">' +
          '<div class="empty-state">' +
            '<span class="empty-state-emoji">\uD83D\uDEE1\uFE0F</span>' +
            '<h3>Run an audit to see results</h3>' +
          '</div>' +
        '</div>' +

        '<div id="security-history" style="margin-top:24px;"></div>' +
      '</div>';

    container.querySelectorAll('[data-sec-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.secAction;
        var config = ACTION_CONFIG[action];
        if (config) runSecurityAction(btn, config);
      });
    });

    renderAuditLog();
  };

  function runSecurityAction(button, config) {
    var originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '\u23F3 Running...';

    var resultsArea = document.getElementById('security-results');
    if (!resultsArea) { button.disabled = false; button.innerHTML = originalText; return; }

    resultsArea.innerHTML = '<div class="loading" style="text-align:center; padding:32px;"><div class="spinner"></div><p style="margin-top:12px;">Running ' + esc(config.label) + '...</p></div>';

    var method = config.method === 'get' ? apiGet : apiPost;
    method(API_PREFIX + config.endpoint).then(function (res) {
      var data = extractData(res);
      if (!data) {
        resultsArea.innerHTML = '<div class="empty-state"><span class="empty-state-emoji">\u274C</span><h3>' + esc(config.label) + ' failed</h3><p>No data returned.</p></div>';
        Utils.showToast(config.label + ' failed', 'danger');
        return;
      }
      var type = Object.keys(ACTION_CONFIG).find(function (k) { return ACTION_CONFIG[k] === config; }) || 'full_audit';
      auditHistory.unshift({ type: type, label: config.label, timestamp: new Date().toISOString(), summary: getResultSummary(type, data) });
      if (auditHistory.length > 50) auditHistory.pop();

      renderSummaryCards(data, type);
      renderSecurityResults(type, data);
      renderAuditLog();
      Utils.showToast(config.label + ' completed', 'success');
    }).catch(function (err) {
      console.error('Security audit error:', err);
      resultsArea.innerHTML = '<div class="error-state"><span style="font-size:32px; display:block; margin-bottom:12px;">\u26A0\uFE0F</span><h3>' + esc(config.label) + ' Error</h3><p>' + esc(err.message || 'Unknown error') + '</p></div>';
      Utils.showToast(config.label + ' failed: ' + (err.message || 'Unknown error'), 'danger');
    }).finally(function () {
      button.disabled = false;
      button.innerHTML = originalText;
    });
  }

  function renderSecurityResults(type, data) {
    var resultsArea = document.getElementById('security-results');
    if (!resultsArea) return;

    var html = '';
    switch (type) {
      case 'scorecard': html = renderScorecard(data); break;
      case 'full_audit': html = renderFullAudit(data); break;
      case 'secret_scan': html = renderSecretScanResults(data); break;
      case 'env_drift': html = renderEnvDrift(data); break;
      case 'permission_audit': html = renderPermissionAudit(data); break;
      case 'capability_audit': html = renderCapabilityAudit(data); break;
      case 'bypass_audit': html = renderBypassAudit(data); break;
      case 'redteam': html = renderRedteam(data); break;
      default: html = renderGenericResult(data); break;
    }
    resultsArea.innerHTML = html;
  }

  function renderScorecard(data) {
    var overall = data.overall ?? data.score ?? 0;
    var categories = data.categories || data.details || {};
    var level = overall >= 80 ? 'badge-passed' : overall >= 50 ? 'badge-warning' : 'badge-danger';

    var html = '<div class="panel">' +
      '<h3 class="panel-title">\uD83D\uDCCA Security Scorecard</h3>' +
      '<div style="text-align:center; padding:16px 0;">' +
        '<div style="font-size:48px; font-weight:700; font-family:var(--font-mono);">' + esc(overall) + '<span style="font-size:24px; color:var(--text-secondary);">%</span></div>' +
        '<div style="margin-top:8px;">' + statusBadge(overall >= 80 ? 'Secure' : overall >= 50 ? 'Attention' : 'Critical') + '</div>' +
      '</div>';

    var entries = Object.keys(categories);
    if (entries.length) {
      html += '<div style="margin-top:16px; border-top:1px solid var(--border-color); padding-top:16px;">';
      entries.forEach(function (k) {
        var val = categories[k];
        var barLevel = val >= 80 ? 'var(--color-success)' : val >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
        html += '<div style="margin-bottom:12px;">' +
          '<div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">' +
            '<span>' + esc(k.replace(/_/g, ' ')) + '</span>' +
            '<span>' + esc(val) + '%</span>' +
          '</div>' +
          '<div class="progress-container"><div class="progress-bar" style="width:' + val + '%; background:' + barLevel + ';"></div></div>' +
        '</div>';
      });
      html += '</div>';
    }

    if (data.summary || data.description) {
      html += '<div style="margin-top:12px; padding:8px 12px; background:var(--bg-primary); border-radius:8px; font-size:13px; color:var(--text-secondary);">' + esc(data.summary || data.description) + '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderFullAudit(data) {
    var auditId = data.auditId || data.id || 'N/A';
    var sections = data.sections || [];
    var counts = data.counts || data.summary || {};

    var html = '<div class="panel">' +
      '<h3 class="panel-title">\uD83D\uDD0D Full Audit</h3>' +
      '<div class="kv-list">' +
        '<div class="kv-item"><span class="kv-key">Audit ID</span><span class="kv-value"><code>' + esc(auditId) + '</code></span></div>';

    Object.keys(counts).forEach(function (k) {
      html += '<div class="kv-item"><span class="kv-key">' + esc(k.replace(/_/g, ' ')) + '</span><span class="kv-value">' + esc(counts[k]) + '</span></div>';
    });

    html += '</div>';

    if (sections.length) {
      html += '<div style="margin-top:16px; border-top:1px solid var(--border-color); padding-top:12px;">' +
        '<h4 style="margin:0 0 8px;">Sections (' + sections.length + ')</h4>' +
        '<div style="overflow-x:auto;"><table class="data-table" style="width:100%; font-size:12px;"><thead><tr><th>Name</th><th>Status</th><th>Findings</th></tr></thead><tbody>';
      sections.forEach(function (s) {
        html += '<tr><td>' + esc(s.name || s.section || '-') + '</td><td>' + statusBadge(s.status || 'unknown') + '</td><td>' + esc(s.findings ?? s.count ?? 0) + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    html += '</div>';
    return html;
  }

  function renderSecretScanResults(data) {
    var findings = data.findings || data.secrets || [];
    var html = '<div class="panel">' +
      '<h3 class="panel-title">\uD83D\uDD0E Secret Scan Results</h3>' +
      '<div style="margin-bottom:12px;"><strong>Total findings:</strong> ' + findings.length + '</div>';

    if (!findings.length) {
      html += '<div class="empty-state" style="padding:24px;"><span class="empty-state-emoji">\u2705</span><h3>No secrets found</h3></div>';
    } else {
      html += '<div style="overflow-x:auto;"><table class="data-table" style="width:100%; font-size:12px;"><thead><tr><th>Type</th><th>Location</th><th>Severity</th><th>Description</th></tr></thead><tbody>';
      findings.forEach(function (f) {
        html += '<tr>' +
          '<td>' + statusBadge(f.type || f.secretType || 'unknown') + '</td>' +
          '<td style="font-family:var(--font-mono); font-size:11px;">' + esc(f.location || f.file || f.path || '-') + '</td>' +
          '<td>' + statusBadge(f.severity || f.riskLevel || 'medium') + '</td>' +
          '<td>' + esc(f.description || f.message || '') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    }

    if (data.redacted) {
      html += '<div style="margin-top:12px; padding:8px 12px; background:var(--bg-primary); border-radius:8px;">' +
        '<strong>Redacted content:</strong>' +
        '<pre style="margin-top:4px; font-size:11px; white-space:pre-wrap; max-height:200px; overflow:auto;">' + esc(data.redacted) + '</pre>' +
      '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderEnvDrift(data) {
    var issues = data.issues || data.drifts || [];
    var html = '<div class="panel">' +
      '<h3 class="panel-title">\uD83C\uDF10 Environment Drift Detection</h3>' +
      '<div style="margin-bottom:12px; display:flex; gap:16px; font-size:13px;">' +
        '<span><strong>Drifted:</strong> ' + issues.length + '</span>' +
        (data.total !== undefined ? '<span><strong>Total checks:</strong> ' + data.total + '</span>' : '') +
        (data.checked !== undefined ? '<span><strong>Checked:</strong> ' + data.checked + '</span>' : '') +
      '</div>';

    if (!issues.length) {
      html += '<div class="empty-state" style="padding:24px;"><span class="empty-state-emoji">\u2705</span><h3>No environment drift detected</h3></div>';
    } else {
      html += '<div style="overflow-x:auto;"><table class="data-table" style="width:100%; font-size:12px;"><thead><tr><th>Variable</th><th>Expected</th><th>Actual</th><th>Severity</th></tr></thead><tbody>';
      issues.forEach(function (d) {
        html += '<tr>' +
          '<td style="font-family:var(--font-mono); font-size:11px;">' + esc(d.variable || d.key || d.name || '-') + '</td>' +
          '<td style="font-size:11px;">' + esc(d.expected || d.expectedValue || '-') + '</td>' +
          '<td style="font-size:11px;">' + esc(d.actual || d.actualValue || '-') + '</td>' +
          '<td>' + statusBadge(d.severity || d.riskLevel || 'medium') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  }

  function renderPermissionAudit(data) {
    var findings = data.findings || data.permissions || [];
    var html = '<div class="panel">' +
      '<h3 class="panel-title">\uD83D\uDC64 Permission Audit</h3>' +
      '<div style="margin-bottom:12px;"><strong>Findings:</strong> ' + findings.length + '</div>';

    if (!findings.length) {
      html += '<div class="empty-state" style="padding:24px;"><span class="empty-state-emoji">\u2705</span><h3>No permission issues found</h3></div>';
    } else {
      html += '<div style="overflow-x:auto;"><table class="data-table" style="width:100%; font-size:12px;"><thead><tr><th>Resource</th><th>User/Role</th><th>Permission</th><th>Status</th><th>Risk</th></tr></thead><tbody>';
      findings.forEach(function (f) {
        html += '<tr>' +
          '<td>' + esc(f.resource || f.scope || '-') + '</td>' +
          '<td>' + esc(f.user || f.role || f.actor || '-') + '</td>' +
          '<td style="font-family:var(--font-mono); font-size:11px;">' + esc(f.permission || f.action || '-') + '</td>' +
          '<td>' + statusBadge(f.status || f.decision || 'unknown') + '</td>' +
          '<td>' + statusBadge(f.riskLevel || f.severity || 'info') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  }

  function renderCapabilityAudit(data) {
    var risks = data.risks || data.capabilities || [];
    var html = '<div class="panel">' +
      '<h3 class="panel-title">\u26A0\uFE0F Capability Risk Audit</h3>' +
      '<div style="margin-bottom:12px;"><strong>Risks identified:</strong> ' + risks.length + '</div>';

    if (!risks.length) {
      html += '<div class="empty-state" style="padding:24px;"><span class="empty-state-emoji">\u2705</span><h3>No risks found</h3></div>';
    } else {
      html += '<div style="overflow-x:auto;"><table class="data-table" style="width:100%; font-size:12px;"><thead><tr><th>Capability</th><th>Module</th><th>Risk Level</th><th>Status</th><th>Description</th></tr></thead><tbody>';
      risks.forEach(function (r) {
        html += '<tr>' +
          '<td>' + esc(r.capability || r.name || r.capabilityId || '-') + '</td>' +
          '<td>' + esc(r.module || '-') + '</td>' +
          '<td>' + statusBadge(r.riskLevel || r.severity || 'unknown') + '</td>' +
          '<td>' + statusBadge(r.status || 'active') + '</td>' +
          '<td style="font-size:11px;">' + esc(r.description || r.message || '') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  }

  function renderBypassAudit(data) {
    var paths = data.paths || data.bypasses || [];
    var status = data.status || data.overall || (paths.length ? 'partial' : 'secure');

    var html = '<div class="panel">' +
      '<h3 class="panel-title">\uD83D\uDEE1\uFE0F Bypass Audit</h3>' +
      '<div style="text-align:center; padding:12px 0;">' +
        '<div style="font-size:32px; margin-bottom:8px;">' + (status === 'secure' || status === 'pass' ? '\u2705' : '\u26A0\uFE0F') + '</div>' +
        '<div>' + statusBadge(status) + '</div>' +
      '</div>';

    if (paths.length) {
      html += '<div style="overflow-x:auto;"><table class="data-table" style="width:100%; font-size:12px;"><thead><tr><th>Path</th><th>Status</th><th>Risk</th><th>Description</th></tr></thead><tbody>';
      paths.forEach(function (p) {
        html += '<tr>' +
          '<td style="font-family:var(--font-mono); font-size:11px;">' + esc(p.path || p.name || p.id || '-') + '</td>' +
          '<td>' + statusBadge(p.status || 'unknown') + '</td>' +
          '<td>' + statusBadge(p.riskLevel || p.severity || 'info') + '</td>' +
          '<td style="font-size:11px;">' + esc(p.description || p.message || '') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="empty-state" style="padding:24px;"><span class="empty-state-emoji">\u2705</span><h3>No bypass paths found</h3></div>';
    }

    html += '</div>';
    return html;
  }

  function renderRedteam(data) {
    var results = data.results || data.tests || [];
    var passed = data.passed || 0;
    var failed = data.failed || 0;
    var overall = data.overall || data.result || (failed > 0 ? 'Fail' : 'Pass');

    var html = '<div class="panel">' +
      '<h3 class="panel-title">\uD83D\uDD34 Red-Team Results</h3>' +
      '<div style="display:flex; gap:24px; justify-content:center; padding:16px 0;">' +
        '<div style="text-align:center;"><div style="font-size:28px; font-weight:700; color:var(--color-success);">' + passed + '</div><div style="font-size:12px; color:var(--text-secondary);">Passed</div></div>' +
        '<div style="text-align:center;"><div style="font-size:28px; font-weight:700; color:var(--color-danger);">' + failed + '</div><div style="font-size:12px; color:var(--text-secondary);">Failed</div></div>' +
        '<div style="text-align:center;"><div style="font-size:28px; font-weight:700;">' + (results.length || 0) + '</div><div style="font-size:12px; color:var(--text-secondary);">Total Tests</div></div>' +
      '</div>' +
      '<div style="text-align:center; margin-bottom:12px;">' + statusBadge(overall) + '</div>';

    if (results.length) {
      html += '<div style="overflow-x:auto;"><table class="data-table" style="width:100%; font-size:12px;"><thead><tr><th>Test</th><th>Category</th><th>Result</th><th>Risk</th><th>Details</th></tr></thead><tbody>';
      results.forEach(function (r) {
        var resultClean = String(r.result || r.status || 'unknown').toLowerCase();
        html += '<tr>' +
          '<td>' + esc(r.name || r.test || r.id || '-') + '</td>' +
          '<td>' + esc(r.category || r.type || '-') + '</td>' +
          '<td>' + statusBadge(resultClean) + '</td>' +
          '<td>' + statusBadge(r.riskLevel || r.severity || 'info') + '</td>' +
          '<td style="font-size:11px; max-width:200px;">' + esc(r.details || r.description || r.message || '') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  }

  function renderGenericResult(data) {
    var html = '<div class="panel">' +
      '<h3 class="panel-title">\uD83D\uDCCA Results</h3>' +
      '<pre style="max-height:400px; overflow:auto; background:var(--bg-primary); padding:12px; border-radius:8px; font-size:12px; white-space:pre-wrap;">' +
        esc(JSON.stringify(data, null, 2)) +
      '</pre>' +
    '</div>';
    return html;
  }

  function renderAuditLog() {
    var historyEl = document.getElementById('security-history');
    if (!historyEl) return;
    if (!auditHistory.length) { historyEl.innerHTML = ''; return; }

    historyEl.innerHTML = '<div class="panel">' +
      '<h3 class="panel-title">\uD83D\uDCCB Recent Audit Runs</h3>' +
      '<div class="table-responsive">' +
        '<table class="data-table" style="width:100%; font-size:12px;">' +
          '<thead><tr><th>Type</th><th>Summary</th><th>Time</th></tr></thead>' +
          '<tbody>' +
            auditHistory.slice(0, 20).map(function (entry) {
              return '<tr>' +
                '<td>' + statusBadge(entry.label) + '</td>' +
                '<td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(entry.summary) + '</td>' +
                '<td style="white-space:nowrap;">' + (Utils.formatDate ? Utils.formatDate(entry.timestamp) : new Date(entry.timestamp).toLocaleString()) + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  if (window.UI) {
    UI.renderSecurity = window.renderSecurity;
  }
})();
