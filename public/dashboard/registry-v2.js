/* Registry v2 Dashboard Renderer */

(function() {
  const REG_API = '/api/dashboard/registry-v2';

  UI.renderRegistryV2 = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading registry v2...');
    try {
      const res = await Api.fetch(REG_API);
      if (!res.ok) {
        container.innerHTML = UI.renderEmptyState('📋', 'Registry v2', 'Registry v2 module is not available.');
        return;
      }
      const data = res.data || {};
      const validation = data.validation || data.validations || {};
      const conflicts = data.conflicts || data.conflictReport || {};
      const conflictCount = conflicts.total || (Array.isArray(conflicts.items) ? conflicts.items.length : 0);

      let html = `
        <div class="section-header"><h2>📋 Registry v2</h2></div>
        <div class="card-grid">
          <div class="card"><div class="card-body">
            <div class="stat-value">${data.tabCount ?? '-'}</div>
            <div class="stat-label">Dashboard Tabs</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${data.apiCount ?? '-'}</div>
            <div class="stat-label">API Endpoints</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${data.commandCount ?? '-'}</div>
            <div class="stat-label">Commands</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value" style="color:${conflictCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">${conflictCount}</div>
            <div class="stat-label">Conflicts</div>
          </div></div>
        </div>
      `;

      html += '<div class="section-header" style="margin-top:24px;"><h3>Registry Sections</h3></div>';
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">';
      html += '<button class="btn btn-outline" onclick="loadRegistryTabs()">Tabs</button>';
      html += '<button class="btn btn-outline" onclick="loadRegistryApis()">APIs</button>';
      html += '<button class="btn btn-outline" onclick="loadRegistryCommands()">Commands</button>';
      html += '<button class="btn btn-outline" onclick="loadRegistryCapabilities()">Capabilities</button>';
      html += '<button class="btn btn-outline" onclick="loadRegistryAliases()">Aliases</button>';
      html += '<button class="btn btn-outline" onclick="loadRegistryConflicts()">Conflicts</button>';
      html += '<button class="btn btn-outline" onclick="loadRegistryCompatibility()">Compatibility</button>';
      html += '</div>';

      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-primary" onclick="runRegistryNormalize()">Normalize</button>';
      html += '<button class="btn btn-outline" onclick="runRegistryValidate()">Validate</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('Registry v2 Error', err.message);
    }
  };

  window.runRegistryNormalize = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Normalizing registries...');
    try {
      const res = await Api.fetch(REG_API + '/normalize', { method: 'POST' });
      if (res.ok) { UI.renderRegistryV2(container); Utils.showToast('Registries normalized', 'success'); }
      else { Utils.showToast('Normalize failed', 'error'); }
    } catch (err) { Utils.showToast('Normalize error: ' + err.message, 'error'); }
  };

  window.runRegistryValidate = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Validating registries...');
    try {
      const res = await Api.fetch(REG_API + '/validate', { method: 'POST' });
      if (res.ok) {
        const data = res.data || {};
        let html = '<div class="section-header"><h2>Validation Results</h2></div>';
        const issues = data.issues || data.errors || [];
        if (Array.isArray(issues) && issues.length) {
          html += '<table class="data-table"><thead><tr><th>Severity</th><th>Description</th></tr></thead><tbody>';
          issues.forEach(i => { html += `<tr><td>${Utils.escapeHtml(i.severity || 'error')}</td><td>${Utils.escapeHtml(i.message || i.description || '')}</td></tr>`; });
          html += '</tbody></table>';
        } else { html += UI.renderEmptyState('✅', 'No issues', 'All registries pass validation.'); }
        html += '<div style="margin-top:16px;"><button class="btn btn-outline" onclick="UI.renderRegistryV2(document.getElementById(\'tab-content\'))">Back</button></div>';
        container.innerHTML = html;
      }
    } catch (err) { container.innerHTML = UI.renderError('Validation Error', err.message); }
  };

  async function loadRegistrySection(endpoint, title) {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading(`Loading ${title}...`);
    try {
      const res = await Api.fetch(REG_API + '/' + endpoint);
      if (res.ok) {
        const data = res.data || {};
        const items = data.registry || data.items || data.report || [];
        const arr = Array.isArray(items) ? items : (Array.isArray(data.registry) ? data.registry : []);
        let html = `<div class="section-header"><h2>${title}</h2></div>`;
        if (arr.length) {
          html += '<table class="data-table"><thead><tr>';
          const keys = Object.keys(arr[0]).slice(0, 6);
          keys.forEach(k => { html += `<th>${Utils.escapeHtml(k)}</th>`; });
          html += '</tr></thead><tbody>';
          arr.forEach(item => {
            html += '<tr>';
            keys.forEach(k => {
              const v = item[k];
              html += `<td>${Utils.escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''))}</td>`;
            });
            html += '</tr>';
          });
          html += '</tbody></table>';
        } else { html += UI.renderEmptyState('📋', `No ${title.toLowerCase()} defined`, ''); }
        html += '<div style="margin-top:16px;"><button class="btn btn-outline" onclick="UI.renderRegistryV2(document.getElementById(\'tab-content\'))">Back</button></div>';
        container.innerHTML = html;
      }
    } catch (err) { container.innerHTML = UI.renderError(`${title} Error`, err.message); }
  }

  window.loadRegistryTabs = function() { loadRegistrySection('tabs', 'Dashboard Tab Registry'); };
  window.loadRegistryApis = function() { loadRegistrySection('apis', 'API Registry'); };
  window.loadRegistryCommands = function() { loadRegistrySection('commands', 'Command Registry'); };
  window.loadRegistryCapabilities = function() { loadRegistrySection('capabilities', 'Capability Registry'); };
  window.loadRegistryAliases = function() { loadRegistrySection('aliases', 'Alias Registry'); };
  window.loadRegistryConflicts = function() { loadRegistrySection('conflicts', 'Conflict Report'); };
  window.loadRegistryCompatibility = function() { loadRegistrySection('compatibility', 'Compatibility Bridge'); };
})();
