/* Registry v3 Dashboard Renderer - Phase 76 */

(function() {
  const REG_API = '/api/dashboard/registry-v3';

  UI.renderRegistryV3 = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading registry v3...');
    try {
      const res = await Api.fetch(REG_API);
      if (!res.ok) {
        container.innerHTML = UI.renderEmptyState('\u{1F4CB}', 'Registry v3', 'Registry v3 module is not available. Run /registryv3freeze or /registryv3validate first.');
        return;
      }
      const data = res.data || {};
      const registryStatus = data.registryStatus || {};
      const freezeStatus = data.freezeStatus || {};
      const version = data.version || {};
      const validation = data.validation || {};
      const conflicts = data.conflicts || {};
      const compat = data.compatibility || {};
      const blockers = data.migrationBlockers || {};

      const freezeClass = registryStatus.isFrozen ? 'color:var(--color-success)' : 'color:var(--color-warning)';
      const freezeLabel = registryStatus.isFrozen ? 'Frozen' : 'Not Frozen';
      const conflictCount = (conflicts.conflicts || conflicts.items || []).length;
      const blockerCount = (blockers.blockers || blockers.items || []).length;

      let html = '<div class="section-header"><h2>\u{1F4CB} Registry v3</h2></div>';
      html += '<div class="card-grid">';
      html += '<div class="card"><div class="card-body"><div class="stat-value" style="' + freezeClass + '">' + freezeLabel + '</div><div class="stat-label">Contract State</div></div></div>';
      html += '<div class="card"><div class="card-body"><div class="stat-value">' + (version.contractVersion || registryStatus.currentVersion || '-') + '</div><div class="stat-label">Version</div></div></div>';
      html += '<div class="card"><div class="card-body"><div class="stat-value" style="color:' + (conflictCount > 0 ? 'var(--color-danger)' : 'var(--color-success)') + '">' + conflictCount + '</div><div class="stat-label">Conflicts</div></div></div>';
      html += '<div class="card"><div class="card-body"><div class="stat-value" style="color:' + (blockerCount > 0 ? 'var(--color-danger)' : 'var(--color-success)') + '">' + blockerCount + '</div><div class="stat-label">Blockers</div></div></div>';
      html += '</div>';

      html += '<div class="section-header" style="margin-top:24px;"><h3>Actions</h3></div>';
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">';

      if (!registryStatus.isFrozen) {
        html += '<button class="btn btn-outline" onclick="rv3CreateDraft()">Create Draft</button>';
        html += '<button class="btn btn-primary" onclick="rv3Freeze()">Freeze Contract</button>';
      }
      html += '<button class="btn btn-outline" onclick="rv3Validate()">Validate</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'conflicts\')">Conflicts</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'compatibility\')">Compatibility</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'blockers\')">Blockers</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'route-plan\')">Route Plan</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'report\')">Full Report</button>';
      html += '</div>';

      html += '<div class="section-header" style="margin-top:16px;"><h3>Contracts</h3></div>';
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'tabs\')">Tab Contracts</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'apis\')">API Contracts</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'renderers\')">Renderer Contracts</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'commands\')">Command Contracts</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'capabilities\')">Capability Contracts</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'aliases\')">Alias Contracts</button>';
      html += '</div>';

      html += '<div class="section-header" style="margin-top:16px;"><h3>Previews</h3></div>';
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'route-preview\')">Route Preview</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'sidebar-preview\')">Sidebar Preview</button>';
      html += '<button class="btn btn-outline" onclick="rv3LoadSection(\'mobile-preview\')">Mobile Preview</button>';
      html += '</div>';

      html += '<div id="rv3-detail-area" style="margin-top:16px;"></div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('Registry v3 Error', err.message);
    }
  };

  function rv3RenderJsonSection(title, data) {
    const area = document.getElementById('rv3-detail-area');
    if (!area) return;
    let html = '<div class="section-header"><h3>' + title + '</h3></div>';
    html += '<div class="card"><div class="card-body"><pre style="white-space:pre-wrap;font-size:13px;max-height:600px;overflow:auto;">' + Utils.escapeHtml(JSON.stringify(data, null, 2)) + '</pre></div></div>';
    area.innerHTML = html;
  }

  window.rv3LoadSection = async function(section) {
    const area = document.getElementById('rv3-detail-area');
    if (!area) return;
    area.innerHTML = UI.renderLoading('Loading ' + section + '...');

    const sectionMap = {
      'conflicts': '/conflicts',
      'compatibility': '/compatibility',
      'blockers': '/blockers',
      'tabs': '/dashboard-tabs',
      'apis': '/apis',
      'renderers': '/renderers',
      'commands': '/commands',
      'capabilities': '/capabilities',
      'aliases': '/aliases',
      'route-plan': '/route-plan',
      'route-preview': '/route-preview',
      'sidebar-preview': '/sidebar-preview',
      'mobile-preview': '/mobile-preview',
      'report': '/report'
    };

    const method = section === 'route-plan' ? 'POST' : 'GET';
    const endpoint = sectionMap[section];

    if (!endpoint) {
      area.innerHTML = UI.renderError('Section Error', 'Unknown section: ' + section);
      return;
    }

    try {
      const res = await Api.fetch(REG_API + endpoint, { method });
      if (!res.ok) {
        area.innerHTML = UI.renderError(section + ' Error', 'Failed to load section');
        return;
      }
      rv3RenderJsonSection(section.replace(/-/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); }), res.data || {});
    } catch (err) {
      area.innerHTML = UI.renderError(section + ' Error', err.message);
    }
  };

  window.rv3CreateDraft = async function() {
    const area = document.getElementById('rv3-detail-area');
    if (area) area.innerHTML = UI.renderLoading('Creating draft...');
    try {
      const res = await Api.fetch(REG_API + '/draft', { method: 'POST' });
      if (res.ok) {
        Utils.showToast('Draft created', 'success');
      } else {
        Utils.showToast('Draft creation failed', 'error');
      }
      const container = document.getElementById('tab-content');
      if (container) UI.renderRegistryV3(container);
    } catch (err) {
      Utils.showToast('Error: ' + err.message, 'error');
    }
  };

  window.rv3Freeze = async function() {
    const area = document.getElementById('rv3-detail-area');
    if (area) area.innerHTML = UI.renderLoading('Freezing contract...');
    try {
      const res = await Api.fetch(REG_API + '/freeze', { method: 'POST' });
      if (res.ok) {
        Utils.showToast('Registry v3 contract frozen', 'success');
      } else {
        Utils.showToast('Freeze failed: ' + ((res.data && res.data.error) || 'unknown'), 'error');
      }
      const container = document.getElementById('tab-content');
      if (container) UI.renderRegistryV3(container);
    } catch (err) {
      Utils.showToast('Error: ' + err.message, 'error');
    }
  };

  window.rv3Validate = async function() {
    const area = document.getElementById('rv3-detail-area');
    if (area) area.innerHTML = UI.renderLoading('Validating registry...');
    try {
      const res = await Api.fetch(REG_API + '/validate', { method: 'POST' });
      if (!res.ok) {
        area.innerHTML = UI.renderError('Validation Error', 'Failed to validate');
        return;
      }
      rv3RenderJsonSection('Validation Results', res.data || {});
    } catch (err) {
      if (area) area.innerHTML = UI.renderError('Validation Error', err.message);
    }
  };

})();