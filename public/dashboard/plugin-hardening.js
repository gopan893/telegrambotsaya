/* Plugin Hardening Dashboard Renderer */

(function() {
  const API = '/api/dashboard/plugin-hardening';

  UI.renderPluginHardening = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading Plugin Hardening...');
    try {
      const res = await Api.fetch(API);
      let data = null;
      if (res.ok && res.data) data = res.data;

      let html = '';
      html += '<div class="section-header"><h2>Plugin Hardening</h2></div>';
      html += buildPluginCompatibilitySection(data);
      html += buildPermissionVersioningSection(data);
      html += buildSandboxPolicySection(data);
      html += buildPluginLifecycleSection(data);
      html += buildPluginHealthSection(data);
      html += buildPluginCertificationSection(data);
      html += buildConnectorHealthSection(data);
      html += buildConnectorTestResultsSection(data);

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-outline" onclick="UI.renderPluginHardening(document.getElementById(\'tab-content\'))">Refresh</button>';
      html += '<button class="btn btn-outline" onclick="certifyAllPlugins()">Certify All</button>';
      html += '<button class="btn btn-outline" onclick="runConnectorTests()">Run Connector Tests</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('Plugin Hardening Error', err.message);
    }
  };

  function buildPluginCompatibilitySection(data) {
    if (!data || !data.compatibility) return UI.renderEmptyState('', 'Plugin Compatibility', 'No compatibility data available.');
    const compat = data.compatibility;
    let html = '<div class="section-header" style="margin-top:16px;"><h3>Plugin Compatibility</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (compat.compatible || 0) + '</div>';
    html += '<div class="stat-label">Compatible</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (compat.warning || 0) + '</div>';
    html += '<div class="stat-label">Warnings</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (compat.blocked || 0) + '</div>';
    html += '<div class="stat-label">Blocked</div>';
    html += '</div></div>';
    if (compat.status) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="font-size:14px;">' + Utils.escapeHtml(compat.status) + '</div>';
      html += '<div class="stat-label">Overall Status</div>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function buildPermissionVersioningSection(data) {
    if (!data || !data.permissionVersioning) return '';
    const pv = data.permissionVersioning;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Permission Versioning</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + (pv.escalationAlerts > 0 ? 'var(--color-danger)' : 'var(--color-success)') + ';">' + (pv.escalationAlerts || 0) + '</div>';
    html += '<div class="stat-label">Escalation Alerts</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + (pv.reapprovalNeeded > 0 ? 'var(--color-warning)' : 'var(--color-success)') + ';">' + (pv.reapprovalNeeded || 0) + '</div>';
    html += '<div class="stat-label">Reapproval Needed</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildSandboxPolicySection(data) {
    if (!data || !data.sandboxPolicy) return '';
    const sp = data.sandboxPolicy;
    const enforced = sp.enforced;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Sandbox Policy</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + (enforced ? 'var(--color-success)' : 'var(--color-danger)') + ';">' + (enforced ? 'ENFORCED' : 'NOT ENFORCED') + '</div>';
    html += '<div class="stat-label">Sandbox Status</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + (sp.violations > 0 ? 'var(--color-danger)' : 'var(--color-success)') + ';">' + (sp.violations || 0) + '</div>';
    html += '<div class="stat-label">Violations</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildPluginLifecycleSection(data) {
    if (!data || !data.lifecycle) return '';
    const lc = data.lifecycle;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Plugin Lifecycle</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (lc.enabled || 0) + '</div>';
    html += '<div class="stat-label">Enabled</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-info);">' + (lc.disabled || 0) + '</div>';
    html += '<div class="stat-label">Disabled</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (lc.degraded || 0) + '</div>';
    html += '<div class="stat-label">Degraded</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (lc.blocked || 0) + '</div>';
    html += '<div class="stat-label">Blocked</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildPluginHealthSection(data) {
    if (!data || !data.health) return '';
    const h = data.health;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Plugin Health</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (h.healthy || 0) + '</div>';
    html += '<div class="stat-label">Healthy</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (h.degraded || 0) + '</div>';
    html += '<div class="stat-label">Degraded</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (h.critical || 0) + '</div>';
    html += '<div class="stat-label">Critical</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildPluginCertificationSection(data) {
    if (!data || !data.certification) return '';
    const cert = data.certification;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Plugin Certification</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (cert.certified || 0) + '</div>';
    html += '<div class="stat-label">Certified</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (cert.blocked || 0) + '</div>';
    html += '<div class="stat-label">Blocked</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (cert.needsReview || 0) + '</div>';
    html += '<div class="stat-label">Needs Review</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildConnectorHealthSection(data) {
    if (!data || !data.connectorHealth) return '';
    const ch = data.connectorHealth;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Connector Health</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (ch.connected || 0) + '</div>';
    html += '<div class="stat-label">Connected</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (ch.degraded || 0) + '</div>';
    html += '<div class="stat-label">Degraded</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (ch.disconnected || 0) + '</div>';
    html += '<div class="stat-label">Disconnected</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildConnectorTestResultsSection(data) {
    if (!data || !data.connectorTests) return '';
    const ct = data.connectorTests;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Connector Test Results</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (ct.readOnly && ct.readOnly.length > 0) {
      html += '<div class="stat-value" style="font-size:14px;">' + ct.readOnly.length + ' read-only test(s)</div>';
      ct.readOnly.forEach(function(t) {
        const color = t.passed ? 'var(--color-success)' : 'var(--color-danger)';
        html += '<p style="font-size:12px;margin-top:4px;color:' + color + ';">' + Utils.escapeHtml(t.name || t.connector) + ': ' + Utils.escapeHtml(t.passed ? 'PASS' : 'FAIL') + '</p>';
      });
    }
    if (ct.writeProposalSimulations && ct.writeProposalSimulations.length > 0) {
      html += '<div class="stat-value" style="font-size:14px;margin-top:12px;">' + ct.writeProposalSimulations.length + ' write proposal simulation(s)</div>';
      ct.writeProposalSimulations.forEach(function(s) {
        html += '<p style="font-size:12px;margin-top:4px;">' + Utils.escapeHtml(s.name || s.connector) + ': ' + Utils.escapeHtml(s.result || 'simulated') + '</p>';
      });
    }
    if (!ct.readOnly && !ct.writeProposalSimulations) {
      html += '<div class="stat-value" style="font-size:14px;">No tests run</div>';
    }
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:8px;">PROPOSAL ONLY — No direct write actions.</p>';
    html += '</div></div>';
    return html;
  }

  window.certifyAllPlugins = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Certifying all plugins...');
    try {
      const res = await Api.fetch(API + '/certify-all', { method: 'POST' });
      if (res.ok) {
        UI.renderPluginHardening(container);
        Utils.showToast('Plugin certification complete', 'success');
      } else {
        Utils.showToast('Certification failed', 'error');
        UI.renderPluginHardening(container);
      }
    } catch (err) {
      Utils.showToast('Error: ' + err.message, 'error');
      UI.renderPluginHardening(container);
    }
  };

  window.runConnectorTests = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Running connector tests...');
    try {
      const res = await Api.fetch(API + '/connector-tests', { method: 'POST' });
      if (res.ok) {
        UI.renderPluginHardening(container);
        Utils.showToast('Connector tests complete', 'success');
      } else {
        Utils.showToast('Connector tests failed', 'error');
        UI.renderPluginHardening(container);
      }
    } catch (err) {
      Utils.showToast('Error: ' + err.message, 'error');
      UI.renderPluginHardening(container);
    }
  };
})();
