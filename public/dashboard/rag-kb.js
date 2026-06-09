'use strict';

(function registerRagKbDashboard() {
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
    const cls = clean.includes('disabled') || clean === 'false' ? 'danger' : clean.includes('warning') || clean === '0' ? 'warning' : 'success';
    return `<span class="badge badge-${cls}">${esc(value || 'unknown')}</span>`;
  }

  async function loadRagKb() {
    const [docs, stats] = await Promise.all([
      Api.apiGet('/rag-kb/documents'),
      Api.apiGet('/rag-kb/stats')
    ]);
    return { documents: docs.data, stats: stats.data };
  }

  async function renderRagKb(targetEl) {
    targetEl.innerHTML = '<div class="tab-header"><h2>Personal Knowledge Search & RAG</h2><p>Document store, vector search, hybrid search, query analysis, and relevance feedback.</p></div><div id="rag-kb-content">' + window.UI.renderLoading('Loading knowledge base...') + '</div>';
    const res = await loadRagKb();
    const content = document.getElementById('rag-kb-content');
    if (!content) return;
    content.innerHTML = `
      <div class="dashboard-card">
        <div class="card-header"><h3>Documents <span class="badge badge-info">${res.documents?.count || 0}</span></h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Source</th><th>Tags</th><th>Created</th></tr></thead>
          <tbody>${(res.documents?.documents || []).map(d => `<tr><td>${esc(d.id)}</td><td>${esc(d.title)}</td><td>${badge(d.type)}</td><td>${esc(d.source)}</td><td>${esc((d.tags || []).join(', '))}</td><td>${esc((d.createdAt || '').slice(0, 10))}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No documents. Add one below.</td></tr>'}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Search</h3></div>
        <div class="form-group"><label>Query</label><input id="rag-search-query" class="dashboard-input" placeholder="Search query..."></div>
        <div class="form-group"><label>Mode</label><select id="rag-search-mode" class="dashboard-select"><option value="vector">Vector (Semantic)</option><option value="hybrid">Hybrid (Vector + Keyword)</option></select></div>
        <button class="btn btn-outline" id="btn-rag-search">Search</button>
        <div id="rag-search-result" style="margin-top:12px;"></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Add Document</h3></div>
        <div class="form-group"><label>Title</label><input id="rag-doc-title" class="dashboard-input" placeholder="Document title"></div>
        <div class="form-group"><label>Content</label><textarea id="rag-doc-content" class="dashboard-input" rows="4" placeholder="Document content..."></textarea></div>
        <div class="form-group"><label>Type</label><input id="rag-doc-type" class="dashboard-input" placeholder="text" value="text"></div>
        <div class="form-group"><label>Tags (comma separated)</label><input id="rag-doc-tags" class="dashboard-input" placeholder="tag1, tag2"></div>
        <button class="btn btn-outline" id="btn-rag-add-doc">Add Document</button>
        <div id="rag-add-result" style="margin-top:12px;"></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Stats</h3></div>
        <p>Documents: <strong>${res.stats?.documentCount || 0}</strong> | Vectors: <strong>${res.stats?.vectorCount || 0}</strong> | Cache: <strong>${res.stats?.cacheStats?.activeEntries || 0}/${res.stats?.cacheStats?.totalEntries || 0}</strong> | Feedback: <strong>${res.stats?.feedbackStats?.total || 0}</strong> (${(res.stats?.feedbackStats?.positiveRate * 100 || 0).toFixed(0)}% positive)</p>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Actions</h3></div>
        <button class="btn btn-outline" id="btn-rag-reindex">Reindex All</button>
        <button class="btn btn-outline" id="btn-rag-analyze">Analyze Query</button>
        <div id="rag-result" style="margin-top:12px;"></div>
      </div>`;
    document.getElementById('btn-rag-search')?.addEventListener('click', async () => {
      const query = document.getElementById('rag-search-query')?.value || '';
      const mode = document.getElementById('rag-search-mode')?.value || 'vector';
      const result = document.getElementById('rag-search-result');
      if (result) result.innerHTML = window.UI.renderLoading('Searching...');
      const res = await Api.apiPost('/rag-kb/search', payload({ query, mode, topK: 10 }));
      if (result) result.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify({ results: res.data?.results, context: res.data?.context, analysis: res.data?.analysis }, null, 2)) + '</pre>';
    });
    document.getElementById('btn-rag-add-doc')?.addEventListener('click', async () => {
      const title = document.getElementById('rag-doc-title')?.value || 'Untitled';
      const content = document.getElementById('rag-doc-content')?.value || '';
      const type = document.getElementById('rag-doc-type')?.value || 'text';
      const tags = (document.getElementById('rag-doc-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
      const result = document.getElementById('rag-add-result');
      if (result) result.innerHTML = window.UI.renderLoading('Adding document...');
      const res = await Api.apiPost('/rag-kb/documents', payload({ title, content, type, tags }));
      if (result) result.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-rag-reindex')?.addEventListener('click', async () => {
      const result = document.getElementById('rag-result');
      if (result) result.innerHTML = window.UI.renderLoading('Reindexing...');
      const res = await Api.apiPost('/rag-kb/reindex', payload());
      if (result) result.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-rag-analyze')?.addEventListener('click', async () => {
      const query = document.getElementById('rag-search-query')?.value || '';
      const result = document.getElementById('rag-result');
      if (result) result.innerHTML = window.UI.renderLoading('Analyzing...');
      const res = await Api.apiPost('/rag-kb/analyze', payload({ query }));
      if (result) result.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
  }

  window.RAG_KB_DASHBOARD = { renderRagKb };
  if (window.UI) window.UI.renderRagKb = renderRagKb;
})();
