'use strict';

/* Project Knowledge Graph + Long-Term Memory Governance Dashboard */

const KNOWLEDGE = {
  async getOverview(workspaceId) {
    const q = workspaceId ? '?workspaceId=' + encodeURIComponent(workspaceId) : '';
    return Api.apiGet('/knowledge' + q);
  },
  async search(query) {
    return Api.apiGet('/knowledge/search?q=' + encodeURIComponent(query || ''));
  },
  async listNodes(filters = {}) {
    const q = '?' + new URLSearchParams(filters).toString();
    return Api.apiGet('/knowledge/nodes' + q);
  },
  async getNode(id) {
    return Api.apiGet('/knowledge/nodes/' + encodeURIComponent(id));
  },
  async getNodeGraph(id, depth) {
    return Api.apiGet('/knowledge/nodes/' + encodeURIComponent(id) + '/graph?depth=' + (depth || 1));
  },
  async getDecisions(query) {
    const q = query ? '?q=' + encodeURIComponent(query) : '';
    return Api.apiGet('/knowledge/decisions' + q);
  },
  async ingest(payload) {
    return Api.apiPost('/knowledge/ingest', payload);
  },
  async contextPack(query) {
    return Api.apiPost('/knowledge/context-pack', { query: query || '' });
  },
  async safetyCheck(candidate) {
    return Api.apiPost('/knowledge/safety-check', { candidate });
  },
  async duplicates(candidate) {
    const q = '?candidate=' + encodeURIComponent(JSON.stringify(candidate || {}));
    return Api.apiGet('/knowledge/duplicates' + q);
  },
  async stale() {
    return Api.apiGet('/knowledge/stale');
  },
  async archive(ids) {
    return Api.apiPost('/knowledge/archive', { ids });
  },
  async docsStatus() {
    return Api.apiGet('/knowledge/docs-status');
  },
  async report() {
    return Api.apiGet('/knowledge/report');
  }
};

function esc(value) {
  if (window.Utils?.escapeHtml) return Utils.escapeHtml(value);
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function badge(text, type) {
  const cls = ['active', 'resolved', 'closed', 'safe'].includes(String(type)) ? 'success'
    : ['archived', 'stale', 'blocked'].includes(String(type)) ? 'warning'
    : ['high', 'critical', 'danger', 'incident'].includes(String(type)) ? 'danger'
    : 'info';
  return `<span class="badge badge-${cls}">${esc(text || '-')}</span>`;
}

function renderSummaryCards(summary, stats) {
  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${summary?.totalNodes ?? 0}</div>
        <div class="stat-label">Total Nodes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary?.activeNodes ?? 0}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary?.totalEdges ?? 0}</div>
        <div class="stat-label">Edges</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary?.counts?.decisions ?? 0}</div>
        <div class="stat-label">Decisions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary?.counts?.risks ?? 0}</div>
        <div class="stat-label">Risks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary?.counts?.incidents ?? 0}</div>
        <div class="stat-label">Incidents</div>
      </div>
    </div>
  `;
}

function renderNodeRows(nodes = []) {
  if (!nodes.length) {
    return '<tr><td colspan="6" class="text-center text-muted" style="padding:24px;">Belum ada knowledge node.</td></tr>';
  }
  return nodes.map(n => `
    <tr>
      <td><code>${esc(n.id)}</code></td>
      <td>${badge(n.type)}</td>
      <td>${esc(n.title)}</td>
      <td>${badge(n.sensitivity)}</td>
      <td>${badge(n.status)}</td>
      <td>${esc((n.confidence * 100).toFixed(0))}%</td>
    </tr>
  `).join('');
}

function renderDecisionRows(decisions = []) {
  if (!decisions.length) {
    return '<tr><td colspan="4" class="text-center text-muted" style="padding:24px;">Belum ada decision memory.</td></tr>';
  }
  return decisions.map(d => `
    <tr>
      <td><code>${esc(d.id)}</code></td>
      <td>${esc(d.title)}</td>
      <td>${esc(String(d.summary || '').slice(0, 140))}</td>
      <td>${badge(d.sensitivity)}</td>
    </tr>
  `).join('');
}

function renderDocsFindings(suggestion) {
  if (!suggestion || !suggestion.findings || !suggestion.findings.length) {
    return '<p class="text-muted">Tidak ada documentation gap terdeteksi.</p>';
  }
  return `
    <ul class="finding-list">
      ${suggestion.findings.slice(0, 30).map(f => `
        <li class="finding finding-${esc(f.severity || 'info')}">
          <strong>${esc(f.file || f.section || 'file')}</strong> · ${esc(f.issue || 'gap')}
          ${f.keys ? ` <small>(${esc(f.keys.slice(0, 5).join(', '))})</small>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

function renderStalenessPlan(plan) {
  if (!plan || !plan.plan || !plan.plan.length) {
    return '<p class="text-muted">Tidak ada memory yang perlu diarsipkan saat ini.</p>';
  }
  return `
    <table class="data-table">
      <thead>
        <tr><th>ID</th><th>Title</th><th>Reason</th><th>Age (days)</th></tr>
      </thead>
      <tbody>
        ${plan.plan.slice(0, 30).map(p => `
          <tr>
            <td><code>${esc(p.id)}</code></td>
            <td>${esc(p.title || '-')}</td>
            <td>${esc(p.reason || '-')}</td>
            <td>${Math.round((p.ageMs || 0) / 86400000)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <button class="btn btn-outline btn-sm" id="kg-archive-stale">🗄️ Archive All Stale</button>
  `;
}

function renderContextPack(pack) {
  if (!pack) return '<p class="text-muted">Context pack kosong.</p>';
  return `
    <div class="card-grid">
      <div class="panel">
        <div class="panel-title">Selected Nodes (${(pack.selectedNodes || []).length})</div>
        <ul>${(pack.selectedNodes || []).slice(0, 12).map(n => `
          <li>${badge(n.type)} <strong>${esc(n.title)}</strong><br><small>${esc(String(n.summary || '').slice(0, 160))}</small></li>
        `).join('') || '<li class="text-muted">No nodes</li>'}</ul>
      </div>
      <div class="panel">
        <div class="panel-title">Decisions (${(pack.decisions || []).length})</div>
        <ul>${(pack.decisions || []).slice(0, 8).map(d => `<li>${esc(d.title)}</li>`).join('') || '<li class="text-muted">No decisions</li>'}</ul>
      </div>
      <div class="panel">
        <div class="panel-title">Risks (${(pack.risks || []).length})</div>
        <ul>${(pack.risks || []).slice(0, 8).map(r => `<li>${esc(r.title)}</li>`).join('') || '<li class="text-muted">No risks</li>'}</ul>
      </div>
      <div class="panel">
        <div class="panel-title">Constraints (${(pack.constraints || []).length})</div>
        <ul>${(pack.constraints || []).slice(0, 8).map(c => `<li>${esc(c)}</li>`).join('') || '<li class="text-muted">No constraints</li>'}</ul>
      </div>
      <div class="panel">
        <div class="panel-title">Missing Context (${(pack.missingContext || []).length})</div>
        <ul>${(pack.missingContext || []).map(m => `<li>${esc(m)}</li>`).join('') || '<li class="text-muted">None</li>'}</ul>
      </div>
    </div>
    <p class="text-muted">Confidence: <strong>${esc(pack.confidence || 0)}%</strong></p>
  `;
}

function renderSafetyReport(report) {
  if (!report) return '<p class="text-muted">Belum ada safety check.</p>';
  const safe = report.safeToStore !== false;
  return `
    <div class="panel">
      <div class="panel-title">${safe ? '✅ Safe to store' : '🚫 Blocked'}</div>
      <p>Detected: <strong>${report.detected ? 'YES' : 'NO'}</strong></p>
      <p>Redacted: <strong>${report.redacted ? 'YES' : 'NO'}</strong></p>
      <p>Sources: <code>${esc((report.sources || []).join(', ') || '-')}</code></p>
      <p>Matches: <strong>${report.matchCount || 0}</strong></p>
      ${report.safeSummary ? `<p>Safe summary: <em>${esc(report.safeSummary)}</em></p>` : ''}
    </div>
  `;
}

function renderKnowledgeTab(targetEl) {
  let html = '<div class="tab-header"><h2>🕸️ Knowledge Graph & Memory</h2></div>';
  html += '<p style="color:var(--muted); margin-bottom:16px;">Long-term project knowledge, decision memory, and governance.</p>';
  html += '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">';
  html += '<button class="btn btn-primary btn-sm" id="kg-refresh">🔄 Refresh</button>';
  html += '<button class="btn btn-outline btn-sm" id="kg-show-ingest">➕ Ingest Memory</button>';
  html += '<button class="btn btn-outline btn-sm" id="kg-show-context">📦 Build Context Pack</button>';
  html += '<button class="btn btn-outline btn-sm" id="kg-show-safety">🔒 Safety Check</button>';
  html += '<button class="btn btn-outline btn-sm" id="kg-show-stale">🗄️ Stale Review</button>';
  html += '<button class="btn btn-outline btn-sm" id="kg-show-docs">📚 Docs Status</button>';
  html += '<button class="btn btn-outline btn-sm" id="kg-show-report">📊 Full Report</button>';
  html += '</div>';

  html += '<div id="kg-sections" class="kg-grid">';
  html += '<div class="panel"><h3>Search</h3>';
  html += '<div style="display:flex; gap:8px;"><input class="input" id="kg-search-input" placeholder="Search project knowledge..." style="flex:1;">';
  html += '<button class="btn btn-primary btn-sm" id="kg-search-btn">Search</button></div>';
  html += '<div id="kg-search-results" class="kg-search-results"></div></div>';
  html += '<div class="panel" id="kg-overview-panel"><h3>Graph Overview</h3><div id="kg-overview">Loading...</div></div>';
  html += '</div>';

  html += '<div class="panel"><h3>Knowledge Nodes</h3>';
  html += '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">';
  html += '<input class="input" id="kg-nodes-type" placeholder="type filter (decision/phase/...)" style="max-width:180px;">';
  html += '<input class="input" id="kg-nodes-source" placeholder="source filter" style="max-width:180px;">';
  html += '<button class="btn btn-outline btn-sm" id="kg-nodes-refresh">Filter</button>';
  html += '</div>';
  html += '<div id="kg-nodes-table">Loading...</div></div>';

  html += '<div class="panel"><h3>Decision Memory</h3><div id="kg-decisions-table">Loading...</div></div>';
  html += '<div class="panel"><h3>Context Pack Preview</h3><div id="kg-context-pack">Klik "Build Context Pack" untuk menghasilkan.</div></div>';
  html += '<div class="panel"><h3>Memory Safety Check</h3><div id="kg-safety">Belum ada safety check.</div></div>';
  html += '<div class="panel"><h3>Stale / Duplicate Review</h3><div id="kg-stale">Loading...</div></div>';
  html += '<div class="panel"><h3>Documentation Intelligence</h3><div id="kg-docs">Loading...</div></div>';

  html += '<div class="hidden" id="kg-ingest-form" style="margin-top:16px;">';
  html += '<div class="panel"><h3>➕ Ingest New Memory</h3>';
  html += '<div class="form-group"><label>Type</label><input class="input" id="kg-ingest-type" placeholder="decision | phase | risk | ..."></div>';
  html += '<div class="form-group"><label>Title</label><input class="input" id="kg-ingest-title" placeholder="Title"></div>';
  html += '<div class="form-group"><label>Summary</label><textarea class="input" id="kg-ingest-summary" rows="3" placeholder="Summary (will be sanitized)"></textarea></div>';
  html += '<div class="form-group"><label>Tags (comma separated)</label><input class="input" id="kg-ingest-tags" placeholder="core, approval"></div>';
  html += '<div class="form-group"><label>Sensitivity</label><select class="input" id="kg-ingest-sensitivity"><option value="internal">internal</option><option value="public">public</option><option value="confidential">confidential</option></select></div>';
  html += '<button class="btn btn-primary btn-sm" id="kg-ingest-submit">Save (will run safety gate)</button>';
  html += '<div id="kg-ingest-result" class="kg-result"></div></div></div>';

  html += '<div class="hidden" id="kg-context-form" style="margin-top:16px;">';
  html += '<div class="panel"><h3>📦 Build Context Pack</h3>';
  html += '<div class="form-group"><label>Query</label><input class="input" id="kg-context-query" placeholder="phase 42 | React decision | render deploy"></div>';
  html += '<button class="btn btn-primary btn-sm" id="kg-context-submit">Build</button></div></div>';

  html += '<div class="hidden" id="kg-safety-form" style="margin-top:16px;">';
  html += '<div class="panel"><h3>🔒 Safety Check</h3>';
  html += '<div class="form-group"><label>Title</label><input class="input" id="kg-safety-title"></div>';
  html += '<div class="form-group"><label>Summary</label><textarea class="input" id="kg-safety-summary" rows="3" placeholder="Try a secret like postgresql://user:pass@host"></textarea></div>';
  html += '<button class="btn btn-primary btn-sm" id="kg-safety-submit">Check</button></div></div>';

  targetEl.innerHTML = html;
  bindKnowledgeEvents(targetEl);
  loadKnowledgeData();
}

function loadKnowledgeData() {
  KNOWLEDGE.getOverview().then(data => {
    const overviewEl = document.getElementById('kg-overview');
    if (!overviewEl) return;
    if (!data?.ok) { overviewEl.innerHTML = '<p class="text-muted">Knowledge module unavailable.</p>'; return; }
    overviewEl.innerHTML = renderSummaryCards(data.summary, data.stats) +
      `<p class="text-muted">Workspace: <code>${esc(data.summary.workspaceId || 'default')}</code></p>`;
  }).catch(() => {
    const overviewEl = document.getElementById('kg-overview');
    if (overviewEl) overviewEl.innerHTML = '<p class="text-muted">Gagal memuat overview.</p>';
  });
  KNOWLEDGE.listNodes({ limit: 50 }).then(data => {
    const el = document.getElementById('kg-nodes-table');
    if (!el) return;
    if (!data?.ok) { el.innerHTML = '<p class="text-muted">Tidak ada node.</p>'; return; }
    el.innerHTML = `<table class="data-table"><thead><tr><th>ID</th><th>Type</th><th>Title</th><th>Sens.</th><th>Status</th><th>Conf.</th></tr></thead><tbody>${renderNodeRows(data.nodes)}</tbody></table>`;
  }).catch(() => {});
  KNOWLEDGE.getDecisions().then(data => {
    const el = document.getElementById('kg-decisions-table');
    if (!el) return;
    if (!data?.ok) { el.innerHTML = '<p class="text-muted">Tidak ada decision.</p>'; return; }
    el.innerHTML = `<table class="data-table"><thead><tr><th>ID</th><th>Title</th><th>Summary</th><th>Sens.</th></tr></thead><tbody>${renderDecisionRows(data.decisions)}</tbody></table>`;
  }).catch(() => {});
  KNOWLEDGE.stale().then(data => {
    const el = document.getElementById('kg-stale');
    if (!el) return;
    if (!data?.ok) { el.innerHTML = '<p class="text-muted">Tidak ada info staleness.</p>'; return; }
    el.innerHTML = renderStalenessPlan(data.plan);
  }).catch(() => {});
  KNOWLEDGE.docsStatus().then(data => {
    const el = document.getElementById('kg-docs');
    if (!el) return;
    if (!data?.ok) { el.innerHTML = '<p class="text-muted">Tidak ada info docs.</p>'; return; }
    el.innerHTML = renderDocsFindings(data);
  }).catch(() => {});
}

function bindKnowledgeEvents(targetEl) {
  function on(id, fn) { const el = targetEl.querySelector('#' + id) || document.getElementById(id); if (el) el.addEventListener('click', fn); }

  on('kg-refresh', loadKnowledgeData);

  on('kg-search-btn', () => {
    const q = document.getElementById('kg-search-input')?.value || '';
    KNOWLEDGE.search(q).then(data => {
      const out = document.getElementById('kg-search-results');
      if (!out) return;
      if (!data?.ok) { out.innerHTML = '<p class="text-muted">Tidak ada hasil.</p>'; return; }
      const nodes = data.nodes || [];
      out.innerHTML = nodes.length
        ? `<table class="data-table"><thead><tr><th>ID</th><th>Type</th><th>Title</th><th>Status</th></tr></thead><tbody>${nodes.slice(0, 30).map(n => `<tr><td><code>${esc(n.id)}</code></td><td>${esc(n.type)}</td><td>${esc(n.title)}</td><td>${esc(n.status)}</td></tr>`).join('')}</tbody></table>`
        : '<p class="text-muted">Tidak ada hasil.</p>';
    });
  });

  on('kg-nodes-refresh', () => {
    const type = document.getElementById('kg-nodes-type')?.value || '';
    const source = document.getElementById('kg-nodes-source')?.value || '';
    KNOWLEDGE.listNodes({ type, source, limit: 100 }).then(data => {
      const el = document.getElementById('kg-nodes-table');
      if (!el) return;
      el.innerHTML = `<table class="data-table"><thead><tr><th>ID</th><th>Type</th><th>Title</th><th>Sens.</th><th>Status</th><th>Conf.</th></tr></thead><tbody>${renderNodeRows(data?.nodes || [])}</tbody></table>`;
    });
  });

  on('kg-show-ingest', () => {
    document.getElementById('kg-ingest-form')?.classList.toggle('hidden');
  });
  on('kg-show-context', () => {
    document.getElementById('kg-context-form')?.classList.toggle('hidden');
  });
  on('kg-show-safety', () => {
    document.getElementById('kg-safety-form')?.classList.toggle('hidden');
  });
  on('kg-show-stale', () => loadKnowledgeData());
  on('kg-show-docs', () => loadKnowledgeData());

  on('kg-ingest-submit', () => {
    const payload = {
      type: document.getElementById('kg-ingest-type')?.value || 'memory',
      title: document.getElementById('kg-ingest-title')?.value || '',
      summary: document.getElementById('kg-ingest-summary')?.value || '',
      tags: (document.getElementById('kg-ingest-tags')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
      sensitivity: document.getElementById('kg-ingest-sensitivity')?.value || 'internal'
    };
    KNOWLEDGE.ingest(payload).then(data => {
      const out = document.getElementById('kg-ingest-result');
      if (out) out.innerHTML = data?.ok
        ? `<p class="text-success">✅ Tersimpan (${esc(data.node?.id || 'merged')})</p>`
        : `<p class="text-danger">🚫 Diblokir: ${esc(data?.safeSummary || data?.error || 'unknown')}</p>`;
      loadKnowledgeData();
    });
  });

  on('kg-context-submit', () => {
    const q = document.getElementById('kg-context-query')?.value || '';
    KNOWLEDGE.contextPack(q).then(data => {
      const out = document.getElementById('kg-context-pack');
      if (out) out.innerHTML = renderContextPack(data?.pack);
    });
  });

  on('kg-safety-submit', () => {
    const candidate = {
      title: document.getElementById('kg-safety-title')?.value || '',
      summary: document.getElementById('kg-safety-summary')?.value || ''
    };
    KNOWLEDGE.safetyCheck(candidate).then(data => {
      const out = document.getElementById('kg-safety');
      if (out) out.innerHTML = renderSafetyReport(data?.report);
    });
  });

  on('kg-archive-stale', () => {
    KNOWLEDGE.stale().then(data => {
      const ids = (data?.plan?.plan || []).map(p => p.id);
      if (!ids.length) return;
      KNOWLEDGE.archive(ids).then(() => loadKnowledgeData());
    });
  });

  on('kg-show-report', () => {
    KNOWLEDGE.report().then(data => {
      const out = document.getElementById('kg-context-pack');
      if (out) out.innerHTML = `<pre style="white-space:pre-wrap; max-height:480px; overflow:auto;">${esc(JSON.stringify(data?.report || {}, null, 2))}</pre>`;
    });
  });
}

if (window.UI) {
  UI.renderKnowledge = renderKnowledgeTab;
}
