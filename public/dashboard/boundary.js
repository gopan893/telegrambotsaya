/* Boundary Dashboard Renderer */

(function() {
  const BOUNDARY_API = '/api/dashboard/boundary';

  UI.renderBoundary = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading boundary data...');
    try {
      const res = await Api.fetch(BOUNDARY_API);
      if (!res.ok) {
        container.innerHTML = UI.renderEmptyState('🧱', 'Boundaries', 'Boundary module not available.');
        return;
      }
      const data = res.data || {};
      const storage = data.storage || {};
      const moduleB = data.moduleBoundary || {};
      const env = data.env || {};

      let html = `
        <div class="section-header"><h2>🧱 Storage & Module Boundary Cleanup</h2></div>
        <div class="card-grid">
          <div class="card"><div class="card-body">
            <div class="stat-value">${storage.totalAccessItems ?? '-'}</div>
            <div class="stat-label">Storage Access Items</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${moduleB.totalManifests ?? '-'}</div>
            <div class="stat-label">Module Manifests</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value">${env.totalEnvNames ?? '-'}</div>
            <div class="stat-label">Env Contracts</div>
          </div></div>
          <div class="card"><div class="card-body">
            <div class="stat-value" style="color:${env.dangerousCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">${env.dangerousCount ?? 0}</div>
            <div class="stat-label">Dangerous Flags</div>
          </div></div>
        </div>
      `;

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-outline" onclick="loadBoundarySection(\'storage-access\',\'Storage Access\')">Storage Access</button>';
      html += '<button class="btn btn-outline" onclick="loadBoundarySection(\'storage-health\',\'Storage Health\')">Storage Health</button>';
      html += '<button class="btn btn-outline" onclick="loadBoundarySection(\'storage-contracts\',\'Storage Contracts\')">Adapter Contracts</button>';
      html += '<button class="btn btn-outline" onclick="loadBoundarySection(\'modules\',\'Module Manifests\')">Modules</button>';
      html += '<button class="btn btn-outline" onclick="loadBoundarySection(\'dependencies\',\'Dependencies\')">Dependency Map</button>';
      html += '<button class="btn btn-outline" onclick="loadBoundarySection(\'env-contracts\',\'Env Contracts\')">Env Contracts</button>';
      html += '<button class="btn btn-outline" onclick="loadBoundarySection(\'import-guard\',\'Import Guard\')">Import Guard</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('Boundary Error', err.message);
    }
  };

  window.loadBoundarySection = async function(endpoint, title) {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading ' + title + '...');
    try {
      const res = await Api.fetch(BOUNDARY_API + '/' + endpoint);
      if (res.ok) {
        const data = res.data || {};
        let html = '<div class="section-header"><h2>' + Utils.escapeHtml(title) + '</h2></div>';
        const items = data.items || data.manifests || data.report || data.contracts || data.accessList || data.results || data;
        const arr = Array.isArray(items) ? items : (Array.isArray(data.data) ? data.data : []);
        if (arr.length) {
          html += '<table class="data-table"><thead><tr>';
          const keys = Object.keys(arr[0]).slice(0, 8);
          keys.forEach(k => { html += '<th>' + Utils.escapeHtml(k) + '</th>'; });
          html += '</tr></thead><tbody>';
          arr.slice(0, 50).forEach(item => {
            html += '<tr>';
            keys.forEach(k => {
              const v = item[k];
              html += '<td>' + Utils.escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')) + '</td>';
            });
            html += '</tr>';
          });
          if (arr.length > 50) html += '<tr><td colspan="' + keys.length + '">... and ' + (arr.length - 50) + ' more</td></tr>';
          html += '</tbody></table>';
        } else { html += UI.renderEmptyState('📋', 'No data', ''); }
        html += '<div style="margin-top:16px;"><button class="btn btn-outline" onclick="UI.renderBoundary(document.getElementById(\'tab-content\'))">Back</button></div>';
        container.innerHTML = html;
      }
    } catch (err) { container.innerHTML = UI.renderError(title + ' Error', err.message); }
  };
})();
