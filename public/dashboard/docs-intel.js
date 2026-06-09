'use strict';

(function registerDocsIntelDashboard() {
  function esc(value) {
    return window.Utils?.escapeHtml ? Utils.escapeHtml(String(value ?? '')) : String(value ?? '');
  }
  function actorId() {
    return localStorage.getItem('dashboard_actor_id') || localStorage.getItem('last_user_id') || 'dashboard-admin';
  }
  function workspaceId() {
    return localStorage.getItem('dashboard_workspace_id') || 'default';
  }
  function payload(extra = {}) {
    return { actorId: actorId(), userId: actorId(), workspaceId: workspaceId(), ...extra };
  }
  function badge(value) {
    const clean = String(value || 'unknown').toLowerCase();
    const cls = clean.includes('high') || clean.includes('missing') ? 'danger' : clean.includes('medium') || clean.includes('warning') ? 'warning' : 'success';
    return `<span class="badge badge-${cls}">${esc(value || 'unknown')}</span>`;
  }

  async function loadDocsIntel() {
    const query = new URLSearchParams(payload()).toString();
    const [inventory, gaps, freshness, commands] = await Promise.all([
      Api.apiGet(`/docs-intel/inventory?${query}`),
      Api.apiGet(`/docs-intel/gaps?${query}`),
      Api.apiGet(`/docs-intel/freshness?${query}`),
      Api.apiGet(`/docs-intel/scan?${query}`)
    ]);
    return { inventory: inventory.data, gaps: gaps.data, freshness: freshness.data, commands: commands.data };
  }

  async function renderDocsIntel(targetEl) {
    targetEl.innerHTML = '<div class="tab-header"><h2>Documentation Intelligence</h2><p>Docs inventory, gap detection, freshness review, and update planning.</p></div><div id="docs-intel-content">' + window.UI.renderLoading('Scanning docs...') + '</div>';
    const res = await loadDocsIntel();
    const content = document.getElementById('docs-intel-content');
    if (!content) return;
    content.innerHTML = `
      <div class="dashboard-card">
        <div class="card-header"><h3>Docs Inventory</h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Path</th><th>Exists</th><th>Lines</th></tr></thead>
          <tbody>${(res.inventory?.inventory?.details || []).map(d => `<tr><td>${esc(d.path)}</td><td>${d.exists ? badge('Yes') : badge('Missing')}</td><td>${d.lines}</td></tr>`).join('')}</tbody>
        </table></div>
        <p class="muted">${esc(res.inventory?.inventory?.summary || '')}</p>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Docs Gaps</h3><span class="muted">${res.gaps?.gaps?.totalGaps || 0} total</span></div>
        ${(res.gaps?.gaps?.gaps || []).map(g => `<div class="gap-item"><strong>[${esc(g.severity)}]</strong> ${esc(g.detail)} <span class="muted">(${esc(g.type)})</span></div>`).join('') || '<p>Tidak ada gap terdeteksi.</p>'}
        <p class="muted">${esc(res.gaps?.gaps?.summary || '')}</p>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Freshness Warnings</h3></div>
        ${(res.freshness?.warnings || []).map(w => `<div class="gap-item"><strong>${esc(w.doc)}</strong>: ${esc(w.detail)}</div>`).join('') || '<p>Tidak ada warning freshness.</p>'}
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Actions</h3></div>
        <button class="btn btn-outline" id="btn-docs-update-plan">Generate Update Plan</button>
        <button class="btn btn-outline" id="btn-docs-prompt">Generate Docs Prompt</button>
        <div id="docs-intel-result" style="margin-top:12px;"></div>
      </div>`;
    document.getElementById('btn-docs-update-plan')?.addEventListener('click', async () => {
      const result = document.getElementById('docs-intel-result');
      if (result) result.innerHTML = window.UI.renderLoading('Generating plan...');
      const res = await Api.apiPost('/docs-intel/update-plan', payload());
      if (result) result.innerHTML = `<pre class="pre-wrap">${esc(JSON.stringify(res.data, null, 2))}</pre>`;
    });
    document.getElementById('btn-docs-prompt')?.addEventListener('click', async () => {
      const result = document.getElementById('docs-intel-result');
      if (result) result.innerHTML = window.UI.renderLoading('Generating prompt...');
      const res = await Api.apiPost('/docs-intel/prompt', payload());
      if (result) result.innerHTML = `<pre class="pre-wrap">${esc(JSON.stringify(res.data, null, 2))}</pre>`;
    });
  }

  window.DOCS_INTEL_DASHBOARD = { renderDocsIntel };
  if (window.UI) window.UI.renderDocsIntel = renderDocsIntel;
})();
