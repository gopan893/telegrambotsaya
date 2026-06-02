/* 
   =========================================
   Telegram AI OS Dashboard - UI Engine
   =========================================
*/

const UI = {
  // --- Standard Component Renderers ---
  renderBadge(status) {
    const clean = String(status || 'unknown').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    return `<span class="badge badge-${clean}">${Utils.escapeHtml(status || 'unknown')}</span>`;
  },

  formatScore(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0%';
    return `${Math.round(n <= 1 ? n * 100 : n)}%`;
  },

  storageStatusLabel(status) {
    const labels = {
      connected: 'Connected',
      missing_env: 'Missing env',
      pg_missing: 'pg missing',
      ioredis_missing: 'ioredis missing',
      connection_failed: 'Connection failed',
      migration_required: 'Migration required',
      timeout: 'Timeout',
      tls_issue: 'TLS issue',
      unavailable: 'Unavailable',
      disabled: 'Disabled'
    };
    return labels[String(status || 'unavailable')] || String(status || 'unavailable');
  },

  getActiveWorkspaceId() {
    return localStorage.getItem('active_workspace_id') || '';
  },

  setActiveWorkspaceId(workspaceId = '') {
    localStorage.setItem('active_workspace_id', workspaceId);
  },

  renderWorkspaceInput(idPrefix = 'workspace') {
    return `
      <div class="filter-group">
        <label for="${idPrefix}-workspace-id">Workspace ID</label>
        <input type="text" id="${idPrefix}-workspace-id" value="${Utils.escapeHtml(UI.getActiveWorkspaceId())}" placeholder="kosong = personal default">
      </div>
    `;
  },

  renderStorageCards(storage = {}) {
    const warning = storage.postgresAvailable && storage.postgresTableReady && (storage.activeDriver || storage.storageDriver) === 'json'
      ? `<div class="alert alert-warning" style="margin-top:12px;">PostgreSQL connected, but storage is using JSON fallback. Reason: ${Utils.escapeHtml(storage.fallbackReason || 'unknown')}</div>`
      : '';
    return `
      <div class="card-grid">
        ${UI.renderMetric('Storage Driver', storage.activeDriver || storage.storageDriver || 'unknown', `Configured: ${storage.configuredStorageDriver || 'auto'} | Fallback: ${storage.fallbackActive ? 'yes' : 'no'}`)}
        ${UI.renderMetric('PostgreSQL', UI.storageStatusLabel(storage.postgresStatus), `Available: ${storage.postgresAvailable ? 'yes' : 'no'} | Table: ${storage.postgresTableReady ? 'ready' : 'not ready'} | ${storage.postgresLatencyMs ?? '-'}ms`)}
        ${UI.renderMetric('Redis', UI.storageStatusLabel(storage.redisStatus), `Available: ${storage.redisAvailable ? 'yes' : 'no'} | ${storage.redisLatencyMs ?? '-'}ms`)}
      </div>
      ${warning}
    `;
  },

  renderCard(title, body, footer = '') {
    return `
      <div class="card">
        <div class="card-title">${Utils.escapeHtml(title)}</div>
        <div>${body}</div>
        ${footer ? `<div class="card-subtitle">${footer}</div>` : ''}
      </div>
    `;
  },

  renderMetric(label, value, subtitle = '') {
    return UI.renderCard(label, `<div class="card-value">${Utils.escapeHtml(String(value ?? '-'))}</div>`, Utils.escapeHtml(subtitle || ''));
  },

  renderTable(headers = [], rows = []) {
    return `
      <div class="table-responsive">
        <table>
          <thead><tr>${headers.map(header => `<th>${Utils.escapeHtml(header)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length || 1}" class="text-center text-muted">Tidak ada data.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  },

  renderKeyValueList(items = []) {
    return `
      <div class="kv-list">
        ${items.map(item => `
          <div class="kv-item">
            <span class="kv-key">${Utils.escapeHtml(item.key || item.label || '')}</span>
            <span class="kv-value">${item.html || Utils.escapeHtml(String(item.value ?? '-'))}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderToast(message, type = 'info') {
    return Utils.showToast(message, type);
  },

  confirmAction(title, message, onConfirm) {
    return Utils.confirmAction(title, message, onConfirm);
  },

  renderProgressBar(percentage) {
    const pct = Math.min(100, Math.max(0, Number(percentage || 0)));
    return `
      <div style="display:flex; align-items:center; gap:8px; width:100%;">
        <div class="progress-container" style="flex:1;">
          <div class="progress-bar" style="width: ${pct}%;"></div>
        </div>
        <span style="font-family:var(--font-mono); font-size:12px; font-weight:600; min-width:32px; text-align:right;">${Math.round(pct)}%</span>
      </div>
    `;
  },

  renderLoading(message = 'Memuat data...') {
    return `
      <div class="loading-skeleton">
        <span class="spinner"></span>
        <p>${Utils.escapeHtml(message)}</p>
      </div>
    `;
  },

  renderEmptyState(emoji = '📁', title = 'Data Kosong', message = 'Tidak ada data yang ditemukan.') {
    return `
      <div class="empty-state">
        <span class="empty-state-emoji">${emoji}</span>
        <h3>${Utils.escapeHtml(title)}</h3>
        <p>${Utils.escapeHtml(message)}</p>
      </div>
    `;
  },

  renderError(title = 'Gagal Memuat', message = 'Terjadi kesalahan sistem.') {
    return `
      <div class="error-state">
        <span style="font-size:32px; display:block; margin-bottom:12px;">⚠️</span>
        <h3>${Utils.escapeHtml(title)}</h3>
        <p>${Utils.escapeHtml(message)}</p>
      </div>
    `;
  },

  renderSectionHeader(title, actionsHtml = '') {
    return `
      <div class="section-header">
        <h2>${Utils.escapeHtml(title)}</h2>
        <div class="section-actions">${actionsHtml}</div>
      </div>
    `;
  },

  // --- Dynamic Tab Renderers ---
  
  async renderOverview(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat ringkasan sistem...');
    
    const healthRes = await Api.getHealth();
    const summaryRes = await Api.getSummary();

    if (!healthRes.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Overview', 'Server mengembalikan kesalahan atau jaringan terputus.');
      return;
    }

    const health = healthRes.data;
    const summary = summaryRes.ok ? summaryRes.data : null;
    const storage = health.storage || health;

    let html = UI.renderSectionHeader('System Overview', `
      <button class="btn btn-outline" id="btn-refresh-overview">🔄 Refresh</button>
      <button class="btn btn-primary" id="btn-diagnostics-overview">🩺 Run Diagnostics</button>
      <button class="btn btn-outline" id="btn-export-health">Export Health</button>
    `);

    // Public Health Cards Grid
    html += `
      <h3 style="margin-bottom:16px; font-size:16px; font-weight:600; color:var(--text-secondary);">PUBLIC HEALTH STATUS</h3>
      <div class="card-grid">
        <div class="card">
          <div class="card-title">Bot Health</div>
          <div class="card-value" style="color: ${health.ok ? 'var(--color-success)' : 'var(--color-danger)'}">
            ${health.ok ? 'HEALTHY' : 'DEGRADED'}
          </div>
          <div class="card-subtitle">Version: ${Utils.escapeHtml(health.version)}</div>
        </div>
        <div class="card">
          <div class="card-title">Uptime</div>
          <div class="card-value" style="font-size: 20px; word-break: break-word;">
            ${Utils.formatDuration(health.uptime)}
          </div>
          <div class="card-subtitle">Started: ${Utils.formatDate(health.timestamp)}</div>
        </div>
        <div class="card">
          <div class="card-title">Storage Driver</div>
          <div class="card-value">${Utils.escapeHtml(health.storageDriver)}</div>
          <div class="card-subtitle">Fallback: ${health.fallbackActive ? 'Active' : 'Inactive'}</div>
        </div>
      </div>
      ${UI.renderStorageCards(storage)}
    `;

    // Protected Summary (Only if login/token is valid)
    if (summary) {
      const opsStatus = summary.opsStatus || {};
      const reliability = opsStatus.reliability || { score: 0, status: 'unknown' };
      
      html += `
        <h3 style="margin-bottom:16px; font-size:16px; font-weight:600; color:var(--text-secondary);">PROTECTED ADMIN DATA</h3>
        <div class="card-grid">
          <div class="card">
            <div class="card-title">Reliability Score</div>
            <div class="card-value" id="overview-reliability-val">${UI.formatScore(reliability.score)}</div>
            <div class="card-subtitle">Status: ${UI.renderBadge(reliability.status)}</div>
          </div>
          <div class="card">
            <div class="card-title">Ops Health</div>
            <div class="card-value">${UI.renderBadge(opsStatus.health || 'unknown')}</div>
            <div class="card-subtitle">Incidents tracked: ${Array.isArray(opsStatus.incidents) ? opsStatus.incidents.length : 0}</div>
          </div>
          <div class="card">
            <div class="card-title">AI OS Data Entities</div>
            <div class="kv-list" style="margin-top:12px; gap:8px;">
              <div class="kv-item" style="border:none; padding:0;">
                <span class="text-secondary" style="font-size:12px;">Memory Records</span>
                <span style="font-family:var(--font-mono); font-weight:bold; font-size:12px;">${summary.memoryCount}</span>
              </div>
              <div class="kv-item" style="border:none; padding:0;">
                <span class="text-secondary" style="font-size:12px;">Goals / Workflows</span>
                <span style="font-family:var(--font-mono); font-weight:bold; font-size:12px;">${summary.goalCount} / ${summary.workflowCount}</span>
              </div>
              <div class="kv-item" style="border:none; padding:0;">
                <span class="text-secondary" style="font-size:12px;">Graph Nodes / Edges</span>
                <span style="font-family:var(--font-mono); font-weight:bold; font-size:12px;">${summary.graphNodeCount} / ${summary.graphEdgeCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3 class="panel-title">⚡ Quick Actions</h3>
          <div style="display:flex; gap:16px; flex-wrap:wrap;">
            <button class="btn btn-outline" id="btn-quick-benchmark">⚡ Run Light Benchmark</button>
            <button class="btn btn-outline" id="btn-quick-prune" style="border-color:rgba(240,60,60,0.4); color:var(--color-danger);">🧹 Prune Telemetry</button>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="alert alert-warning" style="margin-top:20px;">
          🔒 <strong>Protected Data Lock:</strong> Beberapa data admin sensitif terkunci. Hubungkan token Anda di tab <strong>Settings</strong> atau login untuk membukanya.
        </div>
      `;
    }

    targetEl.innerHTML = html;

    // Register quick actions listeners
    const refreshBtn = document.getElementById('btn-refresh-overview');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.renderOverview(targetEl));

    const diagBtn = document.getElementById('btn-diagnostics-overview');
    if (diagBtn) {
      diagBtn.addEventListener('click', () => {
        Utils.confirmAction('Run Diagnostics', 'Menjalankan engine diagnosa sistem untuk mengaudit issues produksi.', async () => {
          Utils.showToast('Menjalankan diagnosa...', 'info');
          const res = await Api.runDiagnostics();
          if (res.ok && res.data.ok) {
            Utils.showToast('Diagnosa selesai!', 'success');
            // Shift to Ops tab or show post-run alert
            UI.renderOps(targetEl);
          } else {
            Utils.showToast('Gagal menjalankan diagnosa.', 'danger');
          }
        });
      });
    }

    const exportBtn = document.getElementById('btn-export-health');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          await window.DashboardExport.exportHealthReport();
          Utils.showToast('Health report diunduh.', 'success');
        } catch (_) {
          Utils.showToast('Gagal export health report.', 'danger');
        }
      });
    }

    const benchBtn = document.getElementById('btn-quick-benchmark');
    if (benchBtn) {
      benchBtn.addEventListener('click', () => {
        Utils.confirmAction('Run Light Benchmark', 'Ini akan mengevaluasi fungsionalitas core AI OS melalui simulator in-memory ringan.', async () => {
          Utils.showToast('Menjalankan benchmark...', 'info');
          const res = await Api.runBenchmarkLight();
          if (res.ok && res.data.ok) {
            Utils.showToast(`Benchmark selesai! Score: ${UI.formatScore(res.data.result.score)}`, 'success');
            this.renderOverview(targetEl);
          } else {
            Utils.showToast('Gagal menjalankan benchmark.', 'danger');
          }
        });
      });
    }

    const pruneBtn = document.getElementById('btn-quick-prune');
    if (pruneBtn) {
      pruneBtn.addEventListener('click', () => {
        Utils.confirmAction('Prune Telemetry', 'Prune telemetry lama? Ini tidak menghapus memory user, melainkan hanya membersihkan event logs transient untuk menghemat RAM.', async () => {
          Utils.showToast('Membersihkan telemetry...', 'info');
          const res = await Api.pruneTelemetry();
          if (res.ok && res.data.ok) {
            Utils.showToast('Telemetry berhasil dibersihkan!', 'success');
            this.renderOverview(targetEl);
          } else {
            Utils.showToast('Gagal membersihkan telemetry.', 'danger');
          }
        });
      });
    }
  },

  async renderOps(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat telemetry & diagnostics...');
    
    const [opsRes, storageRes] = await Promise.all([
      Api.getOps(),
      Api.getStorage ? Api.getStorage() : Promise.resolve({ ok: false, data: null })
    ]);
    if (!opsRes.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Ops Viewer', 'Pastikan token admin Anda benar.');
      return;
    }

    const ops = opsRes.data;
    const health = ops.health || {};
    const telemetry = ops.telemetry || {};
    const reliability = ops.reliability || {};
    const storage = storageRes.ok ? storageRes.data : {};

    let html = UI.renderSectionHeader('Ops Viewer', `
      <button class="btn btn-outline" id="btn-refresh-ops">🔄 Refresh</button>
      <button class="btn btn-primary" id="btn-run-diagnostics">🩺 Run Diagnostics</button>
      <button class="btn btn-outline" id="btn-prune-ops">🧹 Prune Telemetry</button>
    `);

    // Top Stats grid
    html += `
      <div class="card-grid">
        <div class="card">
          <div class="card-title">Ops Health Status</div>
          <div class="card-value">${UI.renderBadge(health.status || 'unknown')}</div>
          <div class="card-subtitle">Issues detected: ${(health.issues || []).length}</div>
        </div>
        <div class="card">
          <div class="card-title">Recent Errors (15m)</div>
          <div class="card-value">${telemetry.recentErrorCount ?? 0}</div>
          <div class="card-subtitle">Anomaly score: ${(telemetry.anomalyScore * 100).toFixed(0)}%</div>
        </div>
        <div class="card">
          <div class="card-title">Reliability Score</div>
          <div class="card-value">${UI.formatScore(reliability.score)}</div>
          <div class="card-subtitle">Status: ${UI.renderBadge(reliability.status)}</div>
        </div>
      </div>
    `;

    // Detailed panels
    html += `
      <div class="card-grid-wide">
        <!-- Infrastructure -->
        <div class="panel" style="margin:0;">
          <h3 class="panel-title">💻 Infrastructure & Runtime</h3>
          <div class="kv-list">
            <div class="kv-item">
              <span class="kv-key">Memory RSS</span>
              <span class="kv-value">${health.memory?.rssMb ? health.memory.rssMb + ' MB' : '-'}</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">Memory Heap Total / Used</span>
              <span class="kv-value">${health.memory?.heapUsedMb ? `${health.memory.heapUsedMb}/${health.memory.heapTotalMb} MB` : '-'}</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">Redis</span>
              <span class="kv-value">${UI.storageStatusLabel(storage.redisStatus)} (${storage.redisAvailable ? 'OK' : 'fallback'})</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">PostgreSQL</span>
              <span class="kv-value">${UI.storageStatusLabel(storage.postgresStatus)} (${storage.postgresAvailable ? 'OK' : 'fallback'})</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">Storage Driver</span>
              <span class="kv-value">${Utils.escapeHtml(storage.storageDriver || 'unknown')}</span>
            </div>
          </div>
        </div>

        <!-- Latency & Tokens -->
        <div class="panel" style="margin:0;">
          <h3 class="panel-title">⚡ Latency & Token Usage</h3>
          <div class="kv-list">
            <div class="kv-item">
              <span class="kv-key">API Requests (P50 / P90)</span>
              <span class="kv-value">${telemetry.latency?.p50 !== undefined ? `${telemetry.latency.p50}ms / ${telemetry.latency.p90}ms` : '-'}</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">Max Latency</span>
              <span class="kv-value">${telemetry.latency?.max ? telemetry.latency.max + 'ms' : '-'}</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">Total Input Tokens</span>
              <span class="kv-value">${telemetry.token?.inputTokens ?? 0}</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">Total Output Tokens</span>
              <span class="kv-value">${telemetry.token?.outputTokens ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Recommendations & Actions
    if ((health.issues || []).length > 0) {
      html += `
        <div class="panel" style="margin-top:24px; border-color:var(--color-warning);">
          <h3 class="panel-title text-warning">⚠️ Masalah Terdeteksi</h3>
          <ul style="padding-left: 20px; line-height:1.7;">
            ${health.issues.map(issue => `<li><code>${Utils.escapeHtml(issue)}</code></li>`).join('')}
          </ul>
        </div>
      `;
    }

    targetEl.innerHTML = html;

    // Listeners
    document.getElementById('btn-refresh-ops').addEventListener('click', () => this.renderOps(targetEl));
    document.getElementById('btn-run-diagnostics').addEventListener('click', () => {
      Utils.confirmAction('Run Diagnostics', 'Lakukan diagnosa penuh pada module telemetry dan system checks?', async () => {
        Utils.showToast('Menjalankan audit...', 'info');
        const res = await Api.runDiagnostics();
        if (res.ok && res.data.ok) {
          Utils.showToast('Diagnosa berhasil dijalankan!', 'success');
          this.renderOps(targetEl);
        } else {
          Utils.showToast('Gagal memicu diagnosa.', 'danger');
        }
      });
    });
    document.getElementById('btn-prune-ops').addEventListener('click', () => {
      Utils.confirmAction('Prune Telemetry', 'Prune telemetry lama? Ini tidak menghapus memory user.', async () => {
        Utils.showToast('Membersihkan telemetry...', 'info');
        const res = await Api.pruneTelemetry();
        if (res.ok && res.data.ok) {
          Utils.showToast('Telemetry dipangkas.', 'success');
          this.renderOps(targetEl);
        } else {
          Utils.showToast('Gagal prune telemetry.', 'danger');
        }
      });
    });
  },

  async renderWorkspacesAdmin(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat workspaces...');
    const actorId = localStorage.getItem('workspace_actor_id') || '';

    const loadData = async () => {
      const actor = document.getElementById('workspace-actor-id')?.value.trim() || '';
      localStorage.setItem('workspace_actor_id', actor);
      const res = await Api.getWorkspaces({ actorId: actor, all: true, includeArchived: true });
      const container = document.getElementById('workspace-list-container');
      if (!res.ok) {
        container.innerHTML = UI.renderError('Gagal Memuat Workspaces', 'Pastikan token dashboard valid.');
        return;
      }
      const items = res.data.items || [];
      if (!items.length) {
        container.innerHTML = UI.renderEmptyState('🏢', 'Belum Ada Workspace', 'Buat workspace project pertama dari dashboard.');
        return;
      }
      container.innerHTML = `
        <div class="card-grid-wide">
          ${items.map(item => `
            <div class="card">
              <div style="display:flex; justify-content:space-between; gap:12px;">
                <div>
                  <h3 style="font-size:16px;">${Utils.escapeHtml(item.name)}</h3>
                  <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${Utils.escapeHtml(item.id)}</span>
                </div>
                <div>${UI.renderBadge(item.type)} ${item.archivedAt ? UI.renderBadge('archived') : ''}</div>
              </div>
              <p style="font-size:13px; color:var(--text-secondary); margin-top:10px;">${Utils.escapeHtml(item.description || '-')}</p>
              <div style="font-size:12px; margin-top:10px; color:var(--text-secondary);">Owner: <code>${Utils.escapeHtml(item.ownerId || '-')}</code> · Members: ${(item.members || []).filter(m => m.status === 'active').length}</div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;">
                ${(item.members || []).filter(m => m.status === 'active').slice(0, 8).map(member => `<span class="badge">${Utils.escapeHtml(member.userId)}:${Utils.escapeHtml(member.role)}</span>`).join('') || '<span class="badge">no members</span>'}
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:14px;">
                <button class="btn btn-outline" data-ws-action="select" data-id="${Utils.escapeHtml(item.id)}">Select</button>
                <button class="btn btn-outline" data-ws-action="members" data-id="${Utils.escapeHtml(item.id)}">Members</button>
                <button class="btn btn-outline" data-ws-action="archive" data-id="${Utils.escapeHtml(item.id)}" style="color:var(--color-danger);">Archive</button>
              </div>
            </div>
          `).join('')}
        </div>`;
      container.querySelectorAll('[data-ws-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-ws-action');
          const workspaceId = btn.getAttribute('data-id');
          if (action === 'select') {
            UI.setActiveWorkspaceId(workspaceId);
            Utils.showToast('Workspace aktif disimpan.', 'success');
            return;
          }
          if (action === 'members') {
            const members = await Api.getWorkspaceMembers(workspaceId, actor);
            const activeMembers = members.data?.items || [];
            const command = prompt(`Members aktif:\\n${activeMembers.map(m => `${m.userId} (${m.role})`).join('\\n')}\\n\\nKetik: add <userId> <role>, role <userId> <role>, atau remove <userId>`);
            if (!command) return;
            const [verb, userId, role] = command.trim().split(/\s+/);
            let res;
            if (verb === 'add') res = await Api.addWorkspaceMember(workspaceId, { actorId: actor, userId, role: role || 'viewer' });
            if (verb === 'role') res = await Api.updateWorkspaceMemberRole(workspaceId, { actorId: actor, userId, role: role || 'viewer' });
            if (verb === 'remove') res = await Api.removeWorkspaceMember(workspaceId, { actorId: actor, userId });
            Utils.showToast(res?.ok && res.data?.ok ? 'Member action sukses.' : 'Member action gagal.', res?.ok && res.data?.ok ? 'success' : 'danger');
            await loadData();
            return;
          }
          if (action === 'archive') {
            const confirmationText = prompt('Ketik ARCHIVE untuk archive workspace ini:');
            if (confirmationText !== 'ARCHIVE') return;
            const res = await Api.archiveWorkspace(workspaceId, { actorId: actor, confirmationText, reason: prompt('Alasan archive (opsional):') || '' });
            Utils.showToast(res.ok && res.data?.ok ? 'Workspace archived.' : 'Gagal archive workspace.', res.ok && res.data?.ok ? 'success' : 'danger');
            await loadData();
          }
        });
      });
    };

    targetEl.innerHTML = `
      ${UI.renderSectionHeader('Workspaces', '<button class="btn btn-primary" id="btn-create-workspace">Create Workspace</button>')}
      <div class="filter-bar">
        <div class="filter-group">
          <label for="workspace-actor-id">Actor ID</label>
          <input type="text" id="workspace-actor-id" value="${Utils.escapeHtml(actorId)}" placeholder="default OWNER_CHAT_ID">
        </div>
        <button class="btn btn-outline" id="btn-load-workspaces">Load</button>
      </div>
      <div id="workspace-list-container">${UI.renderLoading('Memuat workspaces...')}</div>
    `;
    document.getElementById('btn-load-workspaces').addEventListener('click', loadData);
    document.getElementById('btn-create-workspace').addEventListener('click', async () => {
      const actor = document.getElementById('workspace-actor-id').value.trim();
      const name = prompt('Nama workspace:');
      if (!name) return;
      const res = await Api.createWorkspace({ actorId: actor, name, type: prompt('Type personal/project/team/admin:', 'project') || 'project', description: prompt('Deskripsi:', '') || '' });
      Utils.showToast(res.ok && res.data?.ok ? 'Workspace dibuat.' : 'Gagal membuat workspace.', res.ok && res.data?.ok ? 'success' : 'danger');
      await loadData();
    });
    await loadData();
  },

  async renderUsers(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat users...');
    const res = await Api.getUsers();
    if (!res.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Users');
      return;
    }
    const items = res.data.items || [];
    const workspaceId = UI.getActiveWorkspaceId();
    targetEl.innerHTML = `
      ${UI.renderSectionHeader('Users')}
      <div class="filter-bar">
        ${UI.renderWorkspaceInput('users')}
        <button class="btn btn-primary" id="btn-load-users-overview" style="height:40px;">Load Selected Workspace</button>
      </div>
      ${items.length ? UI.renderTable(
        ['User ID', 'Workspace', 'Owner WS', 'Active Mode', 'Last Seen', 'Action'],
        items.map(item => [
          `<code>${Utils.escapeHtml(item.userId)}</code>`,
          String(item.workspaceCount || 0),
          String(item.ownerWorkspaceCount || 0),
          Utils.escapeHtml(item.activeMode || '-'),
          Utils.escapeHtml(item.lastSeenAt ? Utils.formatDate(item.lastSeenAt) : '-'),
          `<button class="btn btn-outline btn-sm" data-user-overview="${Utils.escapeHtml(item.userId)}">Overview</button>`
        ])
      ) : UI.renderEmptyState('👥', 'Belum Ada Users', 'User akan muncul setelah punya state atau membership.')}
      <div id="user-overview-container" style="margin-top:16px;"></div>
    `;
    document.getElementById('users-workspace-id').value = workspaceId;
    document.getElementById('btn-load-users-overview').addEventListener('click', () => {
      UI.setActiveWorkspaceId(document.getElementById('users-workspace-id').value.trim());
      UI.renderUsers(targetEl);
    });
    document.querySelectorAll('[data-user-overview]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-user-overview');
        const selectedWorkspaceId = document.getElementById('users-workspace-id').value.trim();
        UI.setActiveWorkspaceId(selectedWorkspaceId);
        const overview = await Api.getUserWorkspaceOverview(userId, selectedWorkspaceId);
        const container = document.getElementById('user-overview-container');
        if (!overview.ok) {
          container.innerHTML = UI.renderError('Overview Ditolak', overview.data?.error || overview.error || 'Permission tidak cukup.');
          return;
        }
        const data = overview.data || {};
        container.innerHTML = `
          <div class="card">
            <h3>Overview User</h3>
            <div class="kv-list">
              <div class="kv-item"><span class="kv-key">User</span><span>${Utils.escapeHtml(data.userId || userId)}</span></div>
              <div class="kv-item"><span class="kv-key">Workspace</span><span>${Utils.escapeHtml(data.workspaceId || '-')}</span></div>
              <div class="kv-item"><span class="kv-key">Accessible WS</span><span>${String((data.workspaces || []).length)}</span></div>
            </div>
          </div>
        `;
      });
    });
  },

  async renderPermissions(targetEl) {
    const actorId = localStorage.getItem('workspace_actor_id') || '';
    const workspaceId = UI.getActiveWorkspaceId();
    const res = await Api.getMyPermissions(workspaceId, actorId);
    const summary = res.data || {};
    targetEl.innerHTML = `
      ${UI.renderSectionHeader('Permissions')}
      <div class="filter-bar">
        <div class="filter-group"><label>Actor ID</label><input id="perm-actor-id" value="${Utils.escapeHtml(actorId)}"></div>
        ${UI.renderWorkspaceInput('perm')}
        <button class="btn btn-primary" id="btn-load-permissions">Load</button>
      </div>
      <div class="card">
        <h3>Current Permission</h3>
        <div class="kv-list">
          <div class="kv-item"><span class="kv-key">User</span><span>${Utils.escapeHtml(summary.userId || '-')}</span></div>
          <div class="kv-item"><span class="kv-key">Workspace</span><span>${Utils.escapeHtml(summary.workspaceId || '-')}</span></div>
          <div class="kv-item"><span class="kv-key">Role</span><span>${UI.renderBadge(summary.role || 'none')}</span></div>
          <div class="kv-item"><span class="kv-key">Permissions</span><span>${Utils.escapeHtml((summary.permissions || []).join(', ') || '-')}</span></div>
        </div>
      </div>
      ${UI.renderTable(['Role', 'Allowed'], [
        ['owner', 'read, write, danger, ops, manage_members'],
        ['admin', 'read, write, ops, manage_members limited'],
        ['editor', 'read, write'],
        ['viewer', 'read'],
        ['guest', 'limited_read']
      ])}
    `;
    document.getElementById('btn-load-permissions').addEventListener('click', () => {
      localStorage.setItem('workspace_actor_id', document.getElementById('perm-actor-id').value.trim());
      UI.setActiveWorkspaceId(document.getElementById('perm-workspace-id').value.trim());
      UI.renderPermissions(targetEl);
    });
  },

  async renderMemory(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const loadData = async () => {
      const q = document.getElementById('search-memory-q').value.trim();
      const type = document.getElementById('filter-memory-type').value;
      const limit = document.getElementById('filter-memory-limit').value;
      const userId = document.getElementById('memory-user-id').value.trim();
      const workspaceId = document.getElementById('memory-workspace-id').value.trim();

      if (!userId) {
        Utils.showToast('Masukkan User ID terlebih dahulu', 'warning');
        return;
      }

      localStorage.setItem('last_user_id', userId);
      UI.setActiveWorkspaceId(workspaceId);
      const contentListEl = document.getElementById('memory-list-container');
      contentListEl.innerHTML = UI.renderLoading('Memuat memory user...');

      const res = await Api.getUserMemories(userId, { q, type, limit, workspaceId });
      if (!res.ok) {
        contentListEl.innerHTML = UI.renderError('Gagal Memuat Memory', 'Terjadi kesalahan saat memproses data memory user.');
        return;
      }

      const memories = res.data.items || [];
      if (memories.length === 0) {
        contentListEl.innerHTML = UI.renderEmptyState('🧠', 'Tidak Ada Memory', 'Gunakan command /remember di Telegram untuk menyimpan ingatan AI bot.');
        return;
      }

      let mHtml = `
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${memories.map(item => `
            <div class="card">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                  <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); display:block;">ID: ${item.id}</span>
                  <div style="margin-top:4px;">
                    ${UI.renderBadge(item.type)}
                    <span class="badge badge-none" style="font-size:10px;">Conf: ${(item.confidence * 100).toFixed(0)}%</span>
                    <span class="badge badge-none" style="font-size:10px;">Imp: ${(item.importance * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <span class="text-muted" style="font-size:12px;">${Utils.formatDate(item.createdAt)}</span>
              </div>
              <p style="font-size:14px; line-height:1.6; margin-bottom:12px; color:var(--text-primary); white-space:pre-wrap;">${Utils.escapeHtml(item.content)}</p>
              ${item.tags && item.tags.length > 0 ? `
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
                  ${item.tags.map(tag => `<span style="font-size:11px; background:var(--bg-tertiary); padding:2px 8px; border-radius:4px; color:var(--text-secondary);">#${Utils.escapeHtml(tag)}</span>`).join('')}
                </div>
              ` : ''}
              <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:12px; margin-top:8px;">
                <span style="font-size:11px; color:var(--text-muted)">Source: ${Utils.escapeHtml(item.source || 'telegram')}</span>
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-outline" data-memory-action="copy" data-id="${Utils.escapeHtml(item.id)}" style="padding:4px 10px; font-size:11px;">Copy ID</button>
                  <button class="btn btn-outline" data-memory-action="edit" data-id="${Utils.escapeHtml(item.id)}" data-content="${Utils.escapeHtml(item.content || '')}" style="padding:4px 10px; font-size:11px;">Edit</button>
                  <button class="btn btn-outline" data-memory-action="archive" data-id="${Utils.escapeHtml(item.id)}" style="padding:4px 10px; font-size:11px; color:var(--color-danger);">Archive</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      contentListEl.innerHTML = mHtml;
      contentListEl.querySelectorAll('[data-memory-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-memory-action');
          const memoryId = btn.getAttribute('data-id');
          if (action === 'copy') {
            await navigator.clipboard?.writeText(memoryId);
            Utils.showToast('Memory ID disalin.', 'success');
            return;
          }
          if (action === 'edit') {
            const content = prompt('Update content memory:', btn.getAttribute('data-content') || '');
            if (!content) return;
            const res = await Api.updateMemory({ userId, memoryId, content, workspaceId });
            Utils.showToast(res.ok && res.data?.ok ? 'Memory updated.' : 'Gagal update memory.', res.ok && res.data?.ok ? 'success' : 'danger');
            await loadData();
            return;
          }
          if (action === 'archive') {
            const confirmationText = prompt('Ketik ARCHIVE untuk archive memory ini:');
            if (confirmationText !== 'ARCHIVE') return;
            const reason = prompt('Alasan archive (opsional):') || '';
            const res = await Api.archiveMemory({ userId, memoryId, confirm: true, confirmationText, reason, workspaceId });
            Utils.showToast(res.ok && res.data?.ok ? 'Memory archived.' : 'Gagal archive memory.', res.ok && res.data?.ok ? 'success' : 'danger');
            await loadData();
          }
        });
      });
    };

    let html = UI.renderSectionHeader('Memory Records');

    // Filters Bar
    html += `
      <div class="filter-bar">
        <div class="filter-group">
          <label for="memory-user-id">User ID Telegram</label>
          <input type="text" id="memory-user-id" value="${Utils.escapeHtml(currentUserId)}">
        </div>
        ${UI.renderWorkspaceInput('memory')}
        <div class="filter-group">
          <label for="search-memory-q">Pencarian Kata Kunci</label>
          <input type="text" id="search-memory-q" placeholder="Cari isi memory...">
        </div>
        <div class="filter-group">
          <label for="filter-memory-type">Jenis Memory</label>
          <select id="filter-memory-type">
            <option value="">Semua Jenis</option>
            <option value="episodic">Episodic</option>
            <option value="semantic">Semantic</option>
            <option value="procedural">Procedural</option>
          </select>
        </div>
        <div class="filter-group" style="max-width: 100px;">
          <label for="filter-memory-limit">Limit</label>
          <select id="filter-memory-limit">
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        <button class="btn btn-primary" id="btn-load-memories" style="height:40px;">Load Data</button>
      </div>

      <div id="memory-list-container">
        ${UI.renderEmptyState('🧠', 'Masukkan User ID', 'Silakan klik "Load Data" untuk memuat memory dari ID user.')}
      </div>
    `;

    targetEl.innerHTML = html;

    document.getElementById('btn-load-memories').addEventListener('click', loadData);
  },

  async renderGoals(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const loadData = async () => {
      const userId = document.getElementById('goals-user-id').value.trim();
      const workspaceId = document.getElementById('goals-workspace-id').value.trim();
      if (!userId) return;

      localStorage.setItem('last_user_id', userId);
      UI.setActiveWorkspaceId(workspaceId);
      const container = document.getElementById('goals-list-container');
      container.innerHTML = UI.renderLoading('Memuat Goals...');

      const res = await Api.getUserGoals(userId, workspaceId);
      if (!res.ok) {
        container.innerHTML = UI.renderError('Gagal Memuat Goals');
        return;
      }

      const goals = res.data.items || [];
      if (goals.length === 0) {
        container.innerHTML = UI.renderEmptyState('🎯', 'Belum Ada Goals', 'User belum memiliki sasaran terencana.');
        return;
      }

      let gHtml = `
        <div class="card-grid-wide">
          ${goals.map(item => `
            <div class="card">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                  <h3 style="font-size:16px; font-weight:600; color:var(--text-primary);">${Utils.escapeHtml(item.title)}</h3>
                  <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);">ID: ${item.id}</span>
                </div>
                <div style="display:flex; gap:6px;">
                  ${UI.renderBadge(item.status || 'active')}
                  <span class="badge badge-none" style="text-transform:uppercase;">${Utils.escapeHtml(item.priority || 'medium')}</span>
                </div>
              </div>
              <p style="font-size:14px; color:var(--text-secondary); margin-bottom:16px;">${Utils.escapeHtml(item.description || 'Tidak ada deskripsi.')}</p>
              
              <div style="margin-bottom:16px;">
                <span style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">PROGRESS SASARAN</span>
                ${UI.renderProgressBar(item.progress)}
              </div>

              <div class="kv-list" style="border-top:1px solid var(--border-color); padding-top:12px; gap:8px;">
                <div class="kv-item" style="border:none; padding:0; font-size:12px;">
                  <span class="text-secondary">Target Date</span>
                  <span class="text-primary">${item.targetDate ? Utils.formatDate(item.targetDate) : 'Flexible'}</span>
                </div>
                <div class="kv-item" style="border:none; padding:0; font-size:12px;">
                  <span class="text-secondary">Created At</span>
                  <span class="text-primary">${Utils.formatDate(item.createdAt)}</span>
                </div>
              </div>
              <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
                <button class="btn btn-outline" data-goal-action="progress" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Update Progress</button>
                <button class="btn btn-outline" data-goal-action="status" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Update Status</button>
                <button class="btn btn-outline" data-goal-action="generate-plan" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Generate Plan</button>
                <button class="btn btn-outline" data-goal-action="archive" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px; color:var(--color-danger);">Archive</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      container.innerHTML = gHtml;
      container.querySelectorAll('[data-goal-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-goal-action');
          const goalId = btn.getAttribute('data-id');
          let res;
          if (action === 'progress') {
            const progress = prompt('Progress 0-100:');
            if (progress === null) return;
            res = await Api.updateGoal({ userId, goalId, progress: Number(progress), workspaceId });
          } else if (action === 'status') {
            const status = prompt('Status: active, paused, completed, archived, cancelled');
            if (!status) return;
            res = await Api.updateGoal({ userId, goalId, status, workspaceId });
          } else if (action === 'generate-plan') {
            res = await Api.generatePlanFromGoal({ userId, goalId, workspaceId });
          } else if (action === 'archive') {
            const confirmationText = prompt('Ketik ARCHIVE untuk archive goal ini:');
            if (confirmationText !== 'ARCHIVE') return;
            res = await Api.archiveGoal({ userId, goalId, confirm: true, confirmationText, workspaceId, reason: prompt('Alasan archive (opsional):') || '' });
          }
          Utils.showToast(res?.ok && res.data?.ok ? 'Goal action sukses.' : 'Goal action gagal.', res?.ok && res.data?.ok ? 'success' : 'danger');
          await loadData();
        });
      });
    };

    let html = UI.renderSectionHeader('Goals (Sasaran Terencana)');
    html += `
      <div class="filter-bar">
        <div class="filter-group">
          <label for="goals-user-id">User ID Telegram</label>
          <input type="text" id="goals-user-id" value="${Utils.escapeHtml(currentUserId)}">
        </div>
        ${UI.renderWorkspaceInput('goals')}
        <button class="btn btn-primary" id="btn-load-goals" style="height:40px;">Load Goals</button>
      </div>
      <div id="goals-list-container">
        ${UI.renderEmptyState('🎯', 'Masukkan User ID', 'Tekan tombol load untuk menampilkan daftar goals.')}
      </div>
    `;

    targetEl.innerHTML = html;
    document.getElementById('btn-load-goals').addEventListener('click', loadData);
  },

  async renderWorkflows(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const loadData = async () => {
      const userId = document.getElementById('workflows-user-id').value.trim();
      const workspaceId = document.getElementById('workflows-workspace-id').value.trim();
      if (!userId) return;

      localStorage.setItem('last_user_id', userId);
      UI.setActiveWorkspaceId(workspaceId);
      const container = document.getElementById('workflows-list-container');
      container.innerHTML = UI.renderLoading('Memuat Workflows...');

      const res = await Api.getUserWorkflows(userId, workspaceId);
      if (!res.ok) {
        container.innerHTML = UI.renderError('Gagal Memuat Workflows');
        return;
      }

      const workflows = res.data.items || [];
      if (workflows.length === 0) {
        container.innerHTML = UI.renderEmptyState('🔄', 'Belum Ada Alur Kerja', 'User tidak memiliki workflows aktif.');
        return;
      }

      let wHtml = `
        <div style="display:flex; flex-direction:column; gap:24px;">
          ${workflows.map(item => {
            const steps = item.steps || [];
            const doneSteps = steps.filter(s => s.status === 'done' || s.done).length;
            const progress = steps.length ? (doneSteps / steps.length) * 100 : 0;
            
            return `
              <div class="panel" style="margin:0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                  <div>
                    <h3 style="font-size:18px; font-weight:700; color:var(--text-primary);">${Utils.escapeHtml(item.title)}</h3>
                    <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">Workflow ID: ${item.id}</span>
                  </div>
                  <div style="display:flex; gap:6px;">
                    ${UI.renderBadge(item.status || 'active')}
                    <span class="badge badge-none" style="font-size:10px;">Steps: ${doneSteps}/${steps.length}</span>
                  </div>
                </div>

                <div style="margin-bottom:20px;">
                  ${UI.renderProgressBar(progress)}
                </div>

                <div style="background:var(--bg-primary); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:16px;">
                  <span style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:8px;">Goal Linked:</span>
                  <span style="font-family:var(--font-mono); font-size:13px;">${item.goalId ? item.goalId : 'None'}</span>
                  <div style="margin-top:8px; color:var(--text-secondary); font-size:12px;">Linked plan: <span style="font-family:var(--font-mono);">${Utils.escapeHtml(item.linkedPlanId || '-')}</span></div>
                  <div style="margin-top:4px; color:var(--text-secondary); font-size:12px;">Linked tasks: ${(item.linkedTaskIds || []).length}</div>
                </div>

                <!-- Workflow Steps List -->
                <h4 style="font-size:13px; font-weight:600; color:var(--text-secondary); margin-bottom:10px; text-transform:uppercase;">Steps Timeline</h4>
                <div class="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th style="width:60px;">No.</th>
                        <th>Rincian Langkah</th>
                        <th style="width:120px;">Status</th>
                        <th>Hasil Evaluasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${steps.map(step => `
                        <tr>
                          <td style="font-family:var(--font-mono); font-weight:bold;">#${step.stepNumber ?? step.id}</td>
                          <td>${Utils.escapeHtml(step.title)}</td>
                          <td>${UI.renderBadge(step.status)}</td>
                          <td style="font-size:12px; color:var(--text-secondary);">${Utils.escapeHtml(step.result || '-')}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
                <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
                  <button class="btn btn-outline" data-workflow-action="add-step" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Add Step</button>
                  <button class="btn btn-outline" data-workflow-action="done-step" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Mark Step Done</button>
                  <button class="btn btn-outline" data-workflow-action="archive" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px; color:var(--color-danger);">Archive</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      container.innerHTML = wHtml;
      container.querySelectorAll('[data-workflow-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-workflow-action');
          const workflowId = btn.getAttribute('data-id');
          let res;
          if (action === 'add-step') {
            const title = prompt('Step baru:');
            if (!title) return;
            res = await Api.addWorkflowStep({ userId, workflowId, title, workspaceId });
          } else if (action === 'done-step') {
            const stepNumber = prompt('Step number yang selesai:');
            if (!stepNumber) return;
            res = await Api.markWorkflowStepDone({ userId, workflowId, stepNumber: Number(stepNumber), workspaceId });
          } else if (action === 'archive') {
            const confirmationText = prompt('Ketik ARCHIVE untuk archive workflow ini:');
            if (confirmationText !== 'ARCHIVE') return;
            res = await Api.archiveWorkflow({ userId, workflowId, confirm: true, confirmationText, workspaceId, reason: prompt('Alasan archive (opsional):') || '' });
          }
          Utils.showToast(res?.ok && res.data?.ok ? 'Workflow action sukses.' : 'Workflow action gagal.', res?.ok && res.data?.ok ? 'success' : 'danger');
          await loadData();
        });
      });
    };

    let html = UI.renderSectionHeader('Workflows (Alur Rencana)');
    html += `
      <div class="filter-bar">
        <div class="filter-group">
          <label for="workflows-user-id">User ID Telegram</label>
          <input type="text" id="workflows-user-id" value="${Utils.escapeHtml(currentUserId)}">
        </div>
        ${UI.renderWorkspaceInput('workflows')}
        <button class="btn btn-primary" id="btn-load-workflows" style="height:40px;">Load Workflows</button>
      </div>
      <div id="workflows-list-container">
        ${UI.renderEmptyState('🔄', 'Masukkan User ID', 'Muat workflows dengan memasukkan ID Telegram.')}
      </div>
    `;

    targetEl.innerHTML = html;
    document.getElementById('btn-load-workflows').addEventListener('click', loadData);
  },

  async renderPlanner(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';
    let selectedPlanId = '';

    const renderTaskTable = (tasks, userId, workspaceId) => `
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Score</th>
              <th>Blocked</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${(tasks || []).map(task => `
              <tr>
                <td>
                  <strong>${Utils.escapeHtml(task.title)}</strong>
                  <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);">${Utils.escapeHtml(task.id)}</div>
                  <div style="font-size:12px; color:var(--text-secondary);">${Utils.escapeHtml(task.priorityExplanation || '')}</div>
                </td>
                <td>${UI.renderBadge(task.status || 'todo')}</td>
                <td><span class="badge badge-none">${Utils.escapeHtml(task.priority || 'medium')}</span></td>
                <td style="font-family:var(--font-mono);">${Number(task.priorityScore || 0)}</td>
                <td>${task.blockedReason ? Utils.escapeHtml(task.blockedReason) : '-'}</td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-outline" data-planner-task="done" data-id="${Utils.escapeHtml(task.id)}" style="padding:5px 8px; font-size:12px;">Done</button>
                    <button class="btn btn-outline" data-planner-task="blocked" data-id="${Utils.escapeHtml(task.id)}" style="padding:5px 8px; font-size:12px;">Block</button>
                    <button class="btn btn-outline" data-planner-task="propose" data-id="${Utils.escapeHtml(task.id)}" style="padding:5px 8px; font-size:12px;">Propose Exec</button>
                    <button class="btn btn-outline" data-planner-task="archive" data-id="${Utils.escapeHtml(task.id)}" style="padding:5px 8px; font-size:12px; color:var(--color-danger);">Archive</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const bindTaskButtons = (container, userId, workspaceId) => {
      container.querySelectorAll('[data-planner-task]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-planner-task');
          const taskId = btn.getAttribute('data-id');
          let res;
          if (action === 'done') {
            res = await Api.markTaskDone(taskId, { userId, workspaceId });
          } else if (action === 'blocked') {
            const reason = prompt('Alasan blocked:') || '';
            if (!reason) return;
            res = await Api.markTaskBlocked(taskId, { userId, workspaceId, reason });
          } else if (action === 'propose') {
            res = await Api.proposeExecutionFromTask({ userId, actorId: userId, workspaceId, taskId });
            Utils.showToast(res?.ok && res.data?.ok ? 'Proposal eksekusi dibuat. Buka tab Executor untuk approve/run.' : 'Gagal membuat proposal eksekusi.', res?.ok && res.data?.ok ? 'success' : 'danger');
            return;
          } else if (action === 'archive') {
            return Utils.confirmAction('Archive Task', 'Task akan disembunyikan dari daftar aktif, tetapi tidak dihapus permanen.', async () => {
              const res = await Api.archiveTask(taskId, { userId, workspaceId });
              Utils.showToast(res?.ok && res.data?.ok ? 'Task planner di-archive.' : 'Gagal archive task planner.', res?.ok && res.data?.ok ? 'success' : 'danger');
              if (selectedPlanId) await loadPlanDetail(selectedPlanId);
              await loadNextActions();
            });
          }
          Utils.showToast(res?.ok && res.data?.ok ? 'Task planner diperbarui.' : 'Gagal update task planner.', res?.ok && res.data?.ok ? 'success' : 'danger');
          if (selectedPlanId) await loadPlanDetail(selectedPlanId);
          await loadNextActions();
        });
      });
    };

    const loadPlans = async () => {
      const userId = document.getElementById('planner-user-id').value.trim();
      const workspaceId = document.getElementById('planner-workspace-id').value.trim();
      if (!userId) return;
      localStorage.setItem('last_user_id', userId);
      UI.setActiveWorkspaceId(workspaceId);
      const list = document.getElementById('planner-list-container');
      list.innerHTML = UI.renderLoading('Memuat plan...');
      const res = await Api.listPlans({ userId, workspaceId });
      if (!res.ok) {
        list.innerHTML = UI.renderError('Gagal memuat planner');
        return;
      }
      const plans = res.data.items || [];
      if (!plans.length) {
        list.innerHTML = UI.renderEmptyState('🗺️', 'Belum Ada Plan', 'Buat plan baru atau generate dari goal/text.');
        return;
      }
      list.innerHTML = `
        <div class="card-grid-wide">
          ${plans.map(plan => {
            const doneMilestones = (plan.milestones || []).filter(item => item.status === 'done').length;
            const progress = plan.milestones?.length ? (doneMilestones / plan.milestones.length) * 100 : 0;
            return `
              <div class="card">
                <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                  <div>
                    <h3 style="font-size:16px; font-weight:700;">${Utils.escapeHtml(plan.title)}</h3>
                    <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);">${Utils.escapeHtml(plan.id)}</span>
                  </div>
                  <div style="display:flex; gap:6px;">${UI.renderBadge(plan.status || 'draft')}<span class="badge badge-none">${Utils.escapeHtml(plan.horizon || 'weekly')}</span></div>
                </div>
                <p style="font-size:13px; color:var(--text-secondary); margin:12px 0;">${Utils.escapeHtml(plan.description || 'Tidak ada deskripsi.')}</p>
                ${UI.renderProgressBar(progress)}
                <div style="font-size:12px; color:var(--text-secondary); margin-top:8px;">Tasks: ${(plan.taskIds || []).length} · Milestone: ${(plan.milestones || []).length}</div>
                <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
                  <button class="btn btn-outline" data-plan-action="view" data-id="${Utils.escapeHtml(plan.id)}" style="padding:5px 10px; font-size:12px;">View</button>
                  <button class="btn btn-outline" data-plan-action="archive" data-id="${Utils.escapeHtml(plan.id)}" style="padding:5px 10px; font-size:12px; color:var(--color-danger);">Archive</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      list.querySelectorAll('[data-plan-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-plan-action');
          const planId = btn.getAttribute('data-id');
          if (action === 'view') {
            selectedPlanId = planId;
            await loadPlanDetail(planId);
          } else if (action === 'archive') {
            Utils.confirmAction('Archive Plan', 'Plan akan diarsipkan secara soft archive. Task tidak dihapus permanen.', async () => {
              const res = await Api.archivePlan(planId, { userId, workspaceId });
              Utils.showToast(res.ok && res.data?.ok ? 'Plan di-archive.' : 'Gagal archive plan.', res.ok && res.data?.ok ? 'success' : 'danger');
              await loadPlans();
            });
          }
        });
      });
    };

    const loadPlanDetail = async (planId) => {
      const userId = document.getElementById('planner-user-id').value.trim();
      const workspaceId = document.getElementById('planner-workspace-id').value.trim();
      const detail = document.getElementById('planner-detail-container');
      detail.innerHTML = UI.renderLoading('Memuat detail plan...');
      const res = await Api.getPlan(planId, { userId, workspaceId });
      if (!res.ok || !res.data?.ok) {
        detail.innerHTML = UI.renderError('Gagal memuat detail plan');
        return;
      }
      const plan = res.data.plan || {};
      const tasks = res.data.tasks || [];
      detail.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
            <div>
              <h3>${Utils.escapeHtml(plan.title)}</h3>
              <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${Utils.escapeHtml(plan.id)}</div>
            </div>
            <div>${UI.renderBadge(plan.status || 'draft')} <span class="badge badge-none">${Utils.escapeHtml(plan.horizon || 'weekly')}</span></div>
          </div>
          <p style="color:var(--text-secondary); margin-top:12px;">${Utils.escapeHtml(plan.description || '-')}</p>
          <h4 style="margin-top:18px;">Milestones</h4>
          ${(plan.milestones || []).length ? (plan.milestones || []).map(item => `
            <div style="margin-bottom:10px;">
              <div style="display:flex; justify-content:space-between; font-size:12px;"><span>${Utils.escapeHtml(item.title)}</span><span>${item.progress || 0}%</span></div>
              ${UI.renderProgressBar(item.progress || 0)}
            </div>
          `).join('') : '<p class="text-muted">Belum ada milestone.</p>'}
          <div style="display:flex; gap:8px; margin:16px 0; flex-wrap:wrap;">
            <button class="btn btn-primary" id="btn-planner-add-task">Add Task</button>
            <button class="btn btn-outline" id="btn-planner-load-next">Refresh Next Actions</button>
          </div>
          ${renderTaskTable(tasks, userId, workspaceId)}
        </div>
      `;
      document.getElementById('btn-planner-add-task').addEventListener('click', async () => {
        const title = prompt('Judul task:');
        if (!title) return;
        const res = await Api.createTask(plan.id, { userId, workspaceId, title });
        Utils.showToast(res.ok && res.data?.ok ? 'Task dibuat.' : 'Gagal membuat task.', res.ok && res.data?.ok ? 'success' : 'danger');
        await loadPlanDetail(plan.id);
        await loadNextActions();
      });
      document.getElementById('btn-planner-load-next').addEventListener('click', loadNextActions);
      bindTaskButtons(detail, userId, workspaceId);
    };

    const loadNextActions = async () => {
      const userId = document.getElementById('planner-user-id').value.trim();
      const workspaceId = document.getElementById('planner-workspace-id').value.trim();
      const panel = document.getElementById('planner-next-actions');
      if (!panel || !userId) return;
      const res = await Api.getNextActions({ userId, workspaceId });
      if (!res.ok) {
        panel.innerHTML = UI.renderError('Gagal memuat next actions');
        return;
      }
      const actions = res.data.actions || [];
      const blocked = res.data.blocked || [];
      panel.innerHTML = `
        <div class="card">
          <div class="card-title">Next Actions</div>
          ${actions.length ? actions.map((task, index) => `<div style="padding:8px 0; border-bottom:1px solid var(--border-color);"><strong>${index + 1}. ${Utils.escapeHtml(task.title)}</strong><div style="font-size:12px; color:var(--text-secondary);">Priority ${Utils.escapeHtml(task.priority)} · Score ${Number(task.priorityScore || 0)}</div></div>`).join('') : '<p class="text-muted">Belum ada next action.</p>'}
          ${blocked.length ? `<div style="margin-top:12px;"><strong>Blocked</strong>${blocked.map(task => `<div style="font-size:12px; color:var(--color-warning);">- ${Utils.escapeHtml(task.title)}</div>`).join('')}</div>` : ''}
        </div>
      `;
    };

    const createPlan = async () => {
      const userId = document.getElementById('planner-user-id').value.trim();
      const workspaceId = document.getElementById('planner-workspace-id').value.trim();
      const title = prompt('Judul plan:');
      if (!title) return;
      const description = prompt('Deskripsi plan (opsional):') || '';
      const res = await Api.createPlan({ userId, workspaceId, title, description, status: 'active' });
      Utils.showToast(res.ok && res.data?.ok ? 'Plan dibuat.' : 'Gagal membuat plan.', res.ok && res.data?.ok ? 'success' : 'danger');
      await loadPlans();
    };

    const generateFromText = async () => {
      const userId = document.getElementById('planner-user-id').value.trim();
      const workspaceId = document.getElementById('planner-workspace-id').value.trim();
      const text = prompt('Tulis goal/roadmap yang ingin dipecah menjadi plan:');
      if (!text) return;
      const res = await Api.generatePlanFromText({ userId, workspaceId, text });
      Utils.showToast(res.ok && res.data?.ok ? 'Plan dari teks dibuat.' : 'Gagal generate plan.', res.ok && res.data?.ok ? 'success' : 'danger');
      await loadPlans();
    };

    let html = UI.renderSectionHeader('Long-Term Planner');
    html += `
      <div class="filter-bar">
        <div class="filter-group">
          <label for="planner-user-id">User ID Telegram</label>
          <input type="text" id="planner-user-id" value="${Utils.escapeHtml(currentUserId)}">
        </div>
        ${UI.renderWorkspaceInput('planner')}
        <button class="btn btn-primary" id="btn-load-plans" style="height:40px;">Load Plans</button>
        <button class="btn btn-outline" id="btn-create-plan" style="height:40px;">Create Plan</button>
        <button class="btn btn-outline" id="btn-generate-plan-text" style="height:40px;">Generate From Text</button>
      </div>
      <div class="grid grid-2" style="gap:18px; align-items:start;">
        <div>
          <div id="planner-list-container">${UI.renderEmptyState('🗺️', 'Masukkan User ID', 'Load planner untuk melihat roadmap dan task.')}</div>
        </div>
        <div id="planner-next-actions">${UI.renderEmptyState('✅', 'Next Actions', 'Next action akan muncul setelah data dimuat.')}</div>
      </div>
      <div id="planner-detail-container" style="margin-top:24px;"></div>
    `;
    targetEl.innerHTML = html;
    document.getElementById('btn-load-plans').addEventListener('click', async () => {
      await loadPlans();
      await loadNextActions();
    });
    document.getElementById('btn-create-plan').addEventListener('click', createPlan);
    document.getElementById('btn-generate-plan-text').addEventListener('click', generateFromText);
  },

  async renderExecutor(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const renderActions = (actions = []) => {
      if (!actions.length) return '<p class="text-muted">Tidak ada action.</p>';
      return actions.map((action, index) => `
        <div style="border:1px solid var(--border-color); border-radius:6px; padding:10px; margin-top:8px;">
          <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <strong>${index + 1}. ${Utils.escapeHtml(action.type || '-')}</strong>
            <span class="badge badge-${Utils.escapeHtml(action.riskLevel || 'low')}">${Utils.escapeHtml(action.riskLevel || 'low')}</span>
          </div>
          <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${Utils.escapeHtml(action.description || '')}</div>
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted); margin-top:6px;">${Utils.escapeHtml(action.targetType || '-')}:${Utils.escapeHtml(action.targetId || '-')}</div>
        </div>
      `).join('');
    };

    const renderProposalCard = (proposal = {}) => `
      <div class="card">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
          <div>
            <h3 style="font-size:16px; font-weight:700;">${Utils.escapeHtml(proposal.title || '-')}</h3>
            <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);">${Utils.escapeHtml(proposal.id || '-')}</div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">${UI.renderBadge(proposal.status || 'unknown')}<span class="badge badge-none">${Utils.escapeHtml(proposal.riskLevel || 'low')}</span></div>
        </div>
        <p style="font-size:13px; color:var(--text-secondary); margin:12px 0;">${Utils.escapeHtml(proposal.description || 'Tidak ada deskripsi.')}</p>
        <div class="kv-list" style="margin-bottom:10px;">
          <div class="kv-item"><span class="kv-key">Source</span><span>${Utils.escapeHtml(proposal.sourceType || '-')} ${Utils.escapeHtml(proposal.sourceId || '')}</span></div>
          <div class="kv-item"><span class="kv-key">Approval</span><span>${proposal.requiresApproval ? 'required' : 'not required'}</span></div>
          <div class="kv-item"><span class="kv-key">Expires</span><span>${Utils.escapeHtml(proposal.expiresAt ? Utils.formatDate(proposal.expiresAt) : '-')}</span></div>
        </div>
        ${renderActions(proposal.proposedActions || [])}
        ${proposal.resultSummary ? `<div class="alert alert-success" style="margin-top:10px;">${Utils.escapeHtml(proposal.resultSummary)}</div>` : ''}
        ${proposal.errorSummary ? `<div class="alert alert-warning" style="margin-top:10px;">${Utils.escapeHtml(proposal.errorSummary)}</div>` : ''}
        <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
          <button class="btn btn-outline" data-exec-action="approve" data-id="${Utils.escapeHtml(proposal.id || '')}" style="padding:5px 10px; font-size:12px;">Approve</button>
          <button class="btn btn-primary" data-exec-action="run" data-id="${Utils.escapeHtml(proposal.id || '')}" style="padding:5px 10px; font-size:12px;">Run Approved</button>
          <button class="btn btn-outline" data-exec-action="reject" data-id="${Utils.escapeHtml(proposal.id || '')}" style="padding:5px 10px; font-size:12px;">Reject</button>
          <button class="btn btn-outline" data-exec-action="cancel" data-id="${Utils.escapeHtml(proposal.id || '')}" style="padding:5px 10px; font-size:12px; color:var(--color-danger);">Cancel</button>
        </div>
      </div>
    `;

    const getFilters = () => {
      const userId = document.getElementById('executor-user-id').value.trim();
      const workspaceId = document.getElementById('executor-workspace-id').value.trim();
      const status = document.getElementById('executor-status-filter').value;
      const riskLevel = document.getElementById('executor-risk-filter').value;
      if (userId) localStorage.setItem('last_user_id', userId);
      UI.setActiveWorkspaceId(workspaceId);
      return { userId, actorId: userId, workspaceId, status, riskLevel };
    };

    const bindProposalButtons = (container) => {
      container.querySelectorAll('[data-exec-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-exec-action');
          const proposalId = btn.getAttribute('data-id');
          const filters = getFilters();
          const run = async () => {
            let res;
            if (action === 'approve') res = await Api.approveExecution(proposalId, filters);
            if (action === 'run') res = await Api.runExecution(proposalId, filters);
            if (action === 'reject') res = await Api.rejectExecution(proposalId, { ...filters, reason: prompt('Alasan reject:', '') || 'Rejected from dashboard.' });
            if (action === 'cancel') res = await Api.cancelExecution(proposalId, filters);
            Utils.showToast(res?.ok && res.data?.ok ? `Executor ${action} sukses.` : `Executor ${action} gagal.`, res?.ok && res.data?.ok ? 'success' : 'danger');
            await loadExecutor();
          };
          const labels = {
            approve: 'Approve proposal ini? Approval belum menjalankan aksi.',
            run: 'Run proposal yang sudah approved? Action akan dieksekusi sesuai registry aman.',
            reject: 'Reject proposal ini?',
            cancel: 'Cancel proposal ini?'
          };
          return Utils.confirmAction(`Executor ${action}`, labels[action] || 'Lanjutkan action?', run);
        });
      });
    };

    const loadExecutor = async () => {
      const filters = getFilters();
      const panel = document.getElementById('executor-list');
      const runsPanel = document.getElementById('executor-runs');
      if (!filters.userId) return;
      panel.innerHTML = UI.renderLoading('Memuat proposal executor...');
      const res = await Api.listExecutionProposals(filters);
      if (!res.ok || !res.data?.ok) {
        panel.innerHTML = UI.renderError('Gagal memuat proposal executor');
      } else {
        const items = res.data.items || [];
        panel.innerHTML = items.length
          ? `<div class="card-grid-wide">${items.map(renderProposalCard).join('')}</div>`
          : UI.renderEmptyState('✅', 'Belum Ada Proposal', 'Buat proposal dari task planner atau manual.');
        bindProposalButtons(panel);
      }
      const runs = await Api.listExecutionRuns({ userId: filters.userId, actorId: filters.actorId, workspaceId: filters.workspaceId, limit: 10 });
      const runItems = runs.data?.items || [];
      runsPanel.innerHTML = `
        <div class="card">
          <div class="card-title">Recent Executions</div>
          ${runItems.length ? runItems.map(run => `
            <div style="padding:8px 0; border-bottom:1px solid var(--border-color);">
              <strong>${Utils.escapeHtml(run.id)}</strong> ${UI.renderBadge(run.status || 'unknown')}
              <div style="font-size:12px; color:var(--text-secondary);">${Utils.escapeHtml(run.resultSummary || run.errorSummary || '-')}</div>
            </div>
          `).join('') : '<p class="text-muted">Belum ada execution run.</p>'}
        </div>
      `;
    };

    const createManualProposal = async () => {
      const filters = getFilters();
      const title = prompt('Judul proposal eksekusi:');
      if (!title) return;
      const description = prompt('Deskripsi:', '') || '';
      const actionType = prompt('Action type aman:', 'report.health.export') || 'report.health.export';
      const res = await Api.createExecutionProposal({
        ...filters,
        title,
        description,
        sourceType: 'dashboard',
        proposedActions: [{
          type: actionType,
          targetType: 'dashboard',
          description: description || title,
          payload: {},
          riskLevel: actionType.includes('benchmark') ? 'medium' : 'low'
        }]
      });
      Utils.showToast(res?.ok && res.data?.ok ? 'Proposal manual dibuat.' : 'Gagal membuat proposal manual.', res?.ok && res.data?.ok ? 'success' : 'danger');
      await loadExecutor();
    };

    const proposeTask = async () => {
      const filters = getFilters();
      const taskId = prompt('Planner task ID:');
      if (!taskId) return;
      const res = await Api.proposeExecutionFromTask({ ...filters, taskId });
      Utils.showToast(res?.ok && res.data?.ok ? 'Proposal dari task dibuat.' : 'Gagal membuat proposal dari task.', res?.ok && res.data?.ok ? 'success' : 'danger');
      await loadExecutor();
    };

    let html = UI.renderSectionHeader('Human-Approved Executor');
    html += `
      <div class="alert alert-warning" style="margin-bottom:16px;">No action runs without approval. Proposal creation only prepares a preview; use Approve, then Run Approved.</div>
      <div class="filter-bar">
        <div class="filter-group">
          <label for="executor-user-id">User ID Telegram</label>
          <input type="text" id="executor-user-id" value="${Utils.escapeHtml(currentUserId)}">
        </div>
        ${UI.renderWorkspaceInput('executor')}
        <div class="filter-group">
          <label>Status</label>
          <select id="executor-status-filter">
            <option value="">all</option>
            <option value="pending_approval">pending_approval</option>
            <option value="approved">approved</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="rejected">rejected</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Risk</label>
          <select id="executor-risk-filter">
            <option value="">all</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="danger">danger</option>
          </select>
        </div>
        <button class="btn btn-primary" id="btn-load-executor" style="height:40px;">Load</button>
        <button class="btn btn-outline" id="btn-executor-propose-task" style="height:40px;">Propose From Task</button>
        <button class="btn btn-outline" id="btn-executor-create" style="height:40px;">Create Manual Proposal</button>
      </div>
      <div class="grid grid-2" style="gap:18px; align-items:start;">
        <div id="executor-list">${UI.renderEmptyState('✅', 'Load Executor', 'Masukkan User ID untuk melihat proposal.')}</div>
        <div id="executor-runs">${UI.renderEmptyState('📋', 'Recent Runs', 'Run executor akan muncul di sini.')}</div>
      </div>
    `;
    targetEl.innerHTML = html;
    document.getElementById('btn-load-executor').addEventListener('click', loadExecutor);
    document.getElementById('btn-executor-create').addEventListener('click', createManualProposal);
    document.getElementById('btn-executor-propose-task').addEventListener('click', proposeTask);
  },

  async renderAgents(targetEl) {
    targetEl.innerHTML = `
      <div class="page-header">
        <h2>🤝 Agents / Multi-Bot</h2>
        <p>Status multi-bot, agent registry, dan natural smart router. Token dan webhook secret tidak pernah ditampilkan.</p>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h3>Bot Status</h3>
          <button id="agents-load-bots" class="btn btn-primary">Load Bots</button>
          <div id="agents-bots" style="margin-top:16px;">${UI.renderEmptyState('🤖', 'Belum Dimuat', 'Klik Load Bots untuk melihat konfigurasi aman.')}</div>
        </section>
        <section class="panel">
          <h3>Agent Roles</h3>
          <button id="agents-load-agents" class="btn btn-primary">Load Agents</button>
          <div id="agents-list" style="margin-top:16px;">${UI.renderEmptyState('🤝', 'Belum Dimuat', 'Klik Load Agents untuk melihat role agent.')}</div>
        </section>
      </div>
      <section class="panel">
        <h3>Natural Smart Router Test</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Sample Message</label>
            <textarea id="agent-router-message" rows="4" placeholder="Contoh: Bot saya error setelah deploy di Render"></textarea>
          </div>
          <div class="form-group">
            <label>Mode</label>
            <select id="agent-router-mode">
              <option value="natural_smart">natural_smart</option>
              <option value="quiet">quiet</option>
              <option value="council">council</option>
              <option value="debate">debate</option>
              <option value="allagents">allagents</option>
              <option value="risk_review">risk_review</option>
            </select>
          </div>
        </div>
        <button id="agent-router-test" class="btn btn-primary">Test Router</button>
        <button id="agent-router-test-memory" class="btn btn-outline">Test With Memory</button>
        <div id="agent-router-result" style="margin-top:16px;">${UI.renderEmptyState('🧭', 'Router Ready', 'Masukkan pesan untuk melihat topic, risk, dan selected agents.')}</div>
      </section>
      <section class="panel">
        <h3>Agent Personality & Memory</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Agent ID</label>
            <select id="agent-memory-agent">
              <option value="orchestrator">orchestrator</option>
              <option value="planner">planner</option>
              <option value="coder">coder</option>
              <option value="critic">critic</option>
              <option value="research">research</option>
              <option value="ops">ops</option>
              <option value="security">security</option>
              <option value="memory">memory</option>
              <option value="executor">executor</option>
              <option value="reflection">reflection</option>
            </select>
          </div>
          <div class="form-group">
            <label>Workspace ID</label>
            <input id="agent-memory-workspace" placeholder="default">
          </div>
          <div class="form-group">
            <label>User ID</label>
            <input id="agent-memory-user" placeholder="optional">
          </div>
        </div>
        <div class="form-group">
          <label>Memory / Learning Note</label>
          <textarea id="agent-memory-text" rows="3" placeholder="Contoh: Coder Agent harus menjaga CommonJS dan Render compatibility."></textarea>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="agent-profile-load" class="btn btn-outline">Load Profile</button>
          <button id="agent-memory-load" class="btn btn-outline">Load Memory</button>
          <button id="agent-memory-create" class="btn btn-primary">Save Agent Memory</button>
          <button id="agent-note-create" class="btn btn-outline">Save Learning Note</button>
          <button id="agent-shared-load" class="btn btn-outline">Shared Memory</button>
        </div>
        <div id="agent-memory-result" style="margin-top:16px;">${UI.renderEmptyState('🧠', 'Agent Memory Ready', 'Kelola profile dan memory per agent di sini.')}</div>
      </section>
      <div class="grid-2">
        <section class="panel">
          <h3>Group Mode Settings</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Chat ID</label>
              <input id="agent-group-chat-id" placeholder="default">
            </div>
            <div class="form-group">
              <label>Mode</label>
              <select id="agent-group-mode">
                <option value="natural_smart">natural_smart</option>
                <option value="quiet">quiet</option>
                <option value="manual">manual</option>
                <option value="council">council</option>
              </select>
            </div>
            <div class="form-group">
              <label>Max Auto Agents</label>
              <input id="agent-group-max" type="number" min="1" max="5" value="3">
            </div>
          </div>
          <button id="agent-group-load" class="btn btn-outline">Load Settings</button>
          <button id="agent-group-save" class="btn btn-primary">Save Settings</button>
          <div id="agent-group-result" style="margin-top:16px;"></div>
        </section>
        <section class="panel">
          <h3>Recent Agent Activity</h3>
          <button id="agents-load-activity" class="btn btn-primary">Load Activity</button>
          <div id="agents-activity" style="margin-top:16px;">${UI.renderEmptyState('📋', 'Belum Ada Activity', 'Routing natural chat akan muncul di sini.')}</div>
        </section>
      </div>
      <section class="panel">
        <h3>BotFather / Privacy Mode Note</h3>
        <p class="text-muted">Gunakan BotFather untuk membuat token tiap bot. Orchestrator bisa membaca pesan sesuai privacy mode grup; specialist bot sebaiknya tetap command/mention-based. Jangan paste token ke chat.</p>
      </section>
    `;

    const renderBotItems = (items = []) => items.length ? `
      <div class="card-grid">
        ${items.map(bot => UI.renderCard(
          `${bot.id} → ${bot.agentId}`,
          `<div>${UI.renderBadge(bot.enabled ? 'enabled' : 'disabled')} ${UI.renderBadge(bot.tokenConfigured ? 'token set' : 'token missing')}</div>
           <div class="kv-item"><span class="kv-key">Webhook Secret</span><span>${bot.webhookSecretConfigured ? 'set' : 'missing'}</span></div>
           <div class="kv-item"><span class="kv-key">Path</span><span><code>${Utils.escapeHtml(bot.webhookPath || '-')}</code></span></div>`,
          `Username: ${Utils.escapeHtml(bot.username || '-')}`
        )).join('')}
      </div>
    ` : UI.renderEmptyState('🤖', 'Tidak Ada Bot', 'Set TELEGRAM_TOKEN atau TELEGRAM_TOKEN_ORCHESTRATOR.');

    const renderAgentItems = (items = []) => items.length ? `
      <div class="card-grid">
        ${items.map(agent => UI.renderCard(
          agent.displayName,
          `<div>${UI.renderBadge(agent.role)} ${agent.defaultSilent ? UI.renderBadge('silent default') : UI.renderBadge('orchestrator')}</div>
           <p>${Utils.escapeHtml(agent.description || '')}</p>
           <div class="text-muted">${(agent.specialties || []).slice(0, 6).map(Utils.escapeHtml).join(', ')}</div>`,
          `Bot: ${Utils.escapeHtml(agent.botId || '-')}`
        )).join('')}
      </div>
    ` : UI.renderEmptyState('🤝', 'Tidak Ada Agent', 'Default agents belum termuat.');

    const renderRoute = (data = {}) => `
      <div class="card">
        <div class="card-title">Routing Result</div>
        <div class="kv-item"><span class="kv-key">Topics</span><span>${(data.topics || []).map(UI.renderBadge).join(' ') || '-'}</span></div>
        <div class="kv-item"><span class="kv-key">Risk</span><span>${UI.renderBadge(data.risk?.level || 'low')}</span></div>
        <div class="kv-item"><span class="kv-key">Selected</span><span>${(data.selectedAgents || []).map(UI.renderBadge).join(' ') || '-'}</span></div>
        <div class="kv-item"><span class="kv-key">Internal</span><span>${(data.internalOnlyAgents || []).map(UI.renderBadge).join(' ') || '-'}</span></div>
        <div class="kv-item"><span class="kv-key">Muted</span><span>${(data.mutedAgents || []).slice(0, 10).map(UI.renderBadge).join(' ') || '-'}</span></div>
        <div class="kv-item"><span class="kv-key">Approval</span><span>${data.approvalRequired ? 'required' : 'not required'}</span></div>
        <p class="text-muted">${Utils.escapeHtml(data.reason || data.policy?.reason || '')}</p>
      </div>
    `;

    const renderMemoryItems = (items = []) => items.length ? `
      <div class="card-grid">
        ${items.map(memory => UI.renderCard(
          `${memory.title || memory.id}`,
          `<div>${UI.renderBadge(memory.type || 'memory')} ${memory.archivedAt ? UI.renderBadge('archived') : UI.renderBadge('active')}</div>
           <p>${Utils.escapeHtml(memory.content || '')}</p>
           <div class="text-muted">${(memory.tags || []).map(Utils.escapeHtml).join(', ') || '-'}</div>`,
          `Agent: ${Utils.escapeHtml(memory.agentId || '-')} | Score: ${Math.round(Number(memory.relevanceScore || 0) * 100)}%`
        )).join('')}
      </div>
    ` : UI.renderEmptyState('🧠', 'Belum Ada Memory', 'Simpan memory agent atau shared memory terlebih dahulu.');

    const renderProfile = (profile = {}) => `
      <div class="card">
        <div class="card-title">${Utils.escapeHtml(profile.displayName || profile.agentId || 'Agent Profile')}</div>
        <p>${Utils.escapeHtml(profile.personality || '')}</p>
        <div class="kv-item"><span class="kv-key">Role</span><span>${Utils.escapeHtml(profile.role || '-')}</span></div>
        <div class="kv-item"><span class="kv-key">Tone</span><span>${Utils.escapeHtml(profile.responseStyle?.tone || '-')}</span></div>
        <div class="kv-item"><span class="kv-key">Memory</span><span>${profile.agentMemoryEnabled ? 'enabled' : 'disabled'} / shared ${profile.sharedMemoryEnabled ? 'enabled' : 'disabled'}</span></div>
        <div class="text-muted">Scope: ${(profile.knowledgeScope || []).slice(0, 10).map(Utils.escapeHtml).join(', ')}</div>
      </div>
    `;

    const getAgentMemoryFilters = () => ({
      agentId: document.getElementById('agent-memory-agent').value || 'orchestrator',
      workspaceId: document.getElementById('agent-memory-workspace').value || 'default',
      userId: document.getElementById('agent-memory-user').value || ''
    });

    document.getElementById('agents-load-bots').addEventListener('click', async () => {
      const res = await Api.getBots();
      document.getElementById('agents-bots').innerHTML = res.ok ? renderBotItems(res.data.items || []) : UI.renderEmptyState('⚠️', 'Gagal Load', res.error || 'API error');
    });

    document.getElementById('agents-load-agents').addEventListener('click', async () => {
      const res = await Api.getAgents();
      document.getElementById('agents-list').innerHTML = res.ok ? renderAgentItems(res.data.items || []) : UI.renderEmptyState('⚠️', 'Gagal Load', res.error || 'API error');
    });

    document.getElementById('agent-router-test').addEventListener('click', async () => {
      const message = document.getElementById('agent-router-message').value;
      const mode = document.getElementById('agent-router-mode').value;
      const res = await Api.testAgentRouter({ message, mode });
      document.getElementById('agent-router-result').innerHTML = res.ok ? renderRoute(res.data) : UI.renderEmptyState('⚠️', 'Router Error', res.error || 'API error');
    });

    document.getElementById('agent-router-test-memory').addEventListener('click', async () => {
      const filters = getAgentMemoryFilters();
      const message = document.getElementById('agent-router-message').value;
      const mode = document.getElementById('agent-router-mode').value;
      const res = await Api.testAgentRouterWithMemory({ message, mode, workspaceId: filters.workspaceId, userId: filters.userId });
      const agentsWithMemory = res.data?.agents || [];
      document.getElementById('agent-router-result').innerHTML = res.ok
        ? `${renderRoute(res.data.route || {})}<div class="card"><div class="card-title">Memory Context</div>${agentsWithMemory.map(item => `<p><strong>${Utils.escapeHtml(item.agentId)}</strong>: ${item.selectedMemoryCount + item.sharedMemoryCount} memory<br><span class="text-muted">${Utils.escapeHtml(item.memoryExplanation || '')}</span></p>`).join('') || '<p class="text-muted">Tidak ada memory relevan.</p>'}</div>`
        : UI.renderEmptyState('⚠️', 'Router Memory Error', res.error || 'API error');
    });

    document.getElementById('agent-profile-load').addEventListener('click', async () => {
      const filters = getAgentMemoryFilters();
      const res = await Api.getAgentProfile(filters.agentId, { workspaceId: filters.workspaceId });
      document.getElementById('agent-memory-result').innerHTML = res.ok ? renderProfile(res.data) : UI.renderEmptyState('⚠️', 'Gagal Load Profile', res.error || 'API error');
    });

    document.getElementById('agent-memory-load').addEventListener('click', async () => {
      const filters = getAgentMemoryFilters();
      const res = await Api.listAgentMemory(filters.agentId, { workspaceId: filters.workspaceId, userId: filters.userId, limit: 20 });
      document.getElementById('agent-memory-result').innerHTML = res.ok ? renderMemoryItems(res.data.items || []) : UI.renderEmptyState('⚠️', 'Gagal Load Memory', res.error || 'API error');
    });

    document.getElementById('agent-memory-create').addEventListener('click', async () => {
      const filters = getAgentMemoryFilters();
      const content = document.getElementById('agent-memory-text').value;
      const res = await Api.createAgentMemory(filters.agentId, {
        workspaceId: filters.workspaceId,
        userId: filters.userId,
        type: 'project_context',
        content,
        tags: ['dashboard', 'manual']
      });
      document.getElementById('agent-memory-result').innerHTML = res.ok
        ? `<div class="alert alert-success">Agent memory saved: ${Utils.escapeHtml(res.data.title || res.data.id)}</div>`
        : UI.renderEmptyState('⚠️', 'Memory Ditolak', res.error || 'API error');
    });

    document.getElementById('agent-note-create').addEventListener('click', async () => {
      const filters = getAgentMemoryFilters();
      const content = document.getElementById('agent-memory-text').value;
      const res = await Api.createAgentLearningNote(filters.agentId, {
        workspaceId: filters.workspaceId,
        userId: filters.userId,
        content,
        tags: ['dashboard', 'learning']
      });
      document.getElementById('agent-memory-result').innerHTML = res.ok
        ? `<div class="alert alert-success">Learning note saved: ${Utils.escapeHtml(res.data.title || res.data.id)}</div>`
        : UI.renderEmptyState('⚠️', 'Learning Note Ditolak', res.error || 'API error');
    });

    document.getElementById('agent-shared-load').addEventListener('click', async () => {
      const filters = getAgentMemoryFilters();
      const res = await Api.listSharedAgentMemory({ workspaceId: filters.workspaceId, limit: 20 });
      document.getElementById('agent-memory-result').innerHTML = res.ok ? renderMemoryItems(res.data.items || []) : UI.renderEmptyState('⚠️', 'Gagal Load Shared Memory', res.error || 'API error');
    });

    document.getElementById('agent-group-load').addEventListener('click', async () => {
      const chatId = document.getElementById('agent-group-chat-id').value || 'default';
      const res = await Api.getAgentGroupSettings(chatId);
      if (res.ok) {
        document.getElementById('agent-group-mode').value = res.data.mode || 'natural_smart';
        document.getElementById('agent-group-max').value = res.data.maxAutoAgents || 3;
        document.getElementById('agent-group-result').innerHTML = `<div class="alert alert-info">Loaded: ${Utils.escapeHtml(res.data.mode || '-')}</div>`;
      }
    });

    document.getElementById('agent-group-save').addEventListener('click', async () => {
      const payload = {
        chatId: document.getElementById('agent-group-chat-id').value || 'default',
        mode: document.getElementById('agent-group-mode').value,
        maxAutoAgents: Number(document.getElementById('agent-group-max').value || 3)
      };
      const res = await Api.updateAgentGroupSettings(payload);
      document.getElementById('agent-group-result').innerHTML = `<div class="alert ${res.ok ? 'alert-success' : 'alert-danger'}">${res.ok ? 'Settings saved.' : (res.error || 'Failed')}</div>`;
    });

    document.getElementById('agents-load-activity').addEventListener('click', async () => {
      const res = await Api.getAgentActivity({ limit: 20 });
      const items = res.data?.items || [];
      document.getElementById('agents-activity').innerHTML = res.ok && items.length
        ? items.map(item => `<div class="card"><strong>${Utils.escapeHtml(item.mode || 'natural_smart')}</strong> ${UI.renderBadge(item.riskLevel || 'low')}<div>${(item.selectedAgents || []).map(UI.renderBadge).join(' ')}</div><p class="text-muted">${Utils.escapeHtml(item.messagePreview || '-')}</p></div>`).join('')
        : UI.renderEmptyState('📋', 'Belum Ada Activity', 'Belum ada routing yang tercatat.');
    });
  },

  async renderTools(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const getFilters = () => {
      const userId = document.getElementById('tools-user-id').value.trim();
      const workspaceId = document.getElementById('tools-workspace-id').value.trim();
      const category = document.getElementById('tools-category-filter').value;
      const riskLevel = document.getElementById('tools-risk-filter').value;
      const enabled = document.getElementById('tools-enabled-filter').value;
      if (userId) localStorage.setItem('last_user_id', userId);
      UI.setActiveWorkspaceId(workspaceId);
      return { userId, actorId: userId, workspaceId, category, riskLevel, enabled };
    };

    const parseInputPrompt = () => {
      const text = prompt('Input tool (JSON atau teks):', '{}') || '{}';
      try {
        return JSON.parse(text);
      } catch (_) {
        return { text, query: text, city: text };
      }
    };

    const renderToolCard = (tool = {}) => `
      <div class="card">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
          <div>
            <h3 style="font-size:16px; font-weight:700;">${Utils.escapeHtml(tool.name || tool.id)}</h3>
            <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);">${Utils.escapeHtml(tool.id || '-')}</div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${UI.renderBadge(tool.enabled ? 'enabled' : 'disabled')}
            <span class="badge badge-none">${Utils.escapeHtml(tool.riskLevel || 'low')}</span>
          </div>
        </div>
        <p style="font-size:13px; color:var(--text-secondary); margin:12px 0;">${Utils.escapeHtml(tool.description || '-')}</p>
        <div class="kv-list">
          <div class="kv-item"><span class="kv-key">Category</span><span>${Utils.escapeHtml(tool.category || '-')}</span></div>
          <div class="kv-item"><span class="kv-key">Action</span><span>${Utils.escapeHtml(tool.actionType || '-')}</span></div>
          <div class="kv-item"><span class="kv-key">Approval</span><span>${tool.requiresApproval ? 'required' : 'direct if permitted'}</span></div>
          <div class="kv-item"><span class="kv-key">Permissions</span><span>${Utils.escapeHtml((tool.permissionsRequired || []).join(', ') || 'read')}</span></div>
          ${tool.unavailableReason ? `<div class="kv-item"><span class="kv-key">Unavailable</span><span>${Utils.escapeHtml(tool.unavailableReason)}</span></div>` : ''}
        </div>
        <details style="margin-top:10px;">
          <summary>Input schema</summary>
          <pre style="white-space:pre-wrap; font-size:11px;">${Utils.escapeHtml(JSON.stringify(tool.inputSchema || {}, null, 2))}</pre>
        </details>
        <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
          <button class="btn btn-outline" data-tool-action="preview" data-id="${Utils.escapeHtml(tool.id)}" style="padding:5px 10px; font-size:12px;">Preview</button>
          <button class="btn btn-primary" data-tool-action="run" data-id="${Utils.escapeHtml(tool.id)}" style="padding:5px 10px; font-size:12px;">Run Safe</button>
          <button class="btn btn-outline" data-tool-action="propose" data-id="${Utils.escapeHtml(tool.id)}" style="padding:5px 10px; font-size:12px;">Propose</button>
          <button class="btn btn-outline" data-tool-action="${tool.enabled ? 'disable' : 'enable'}" data-id="${Utils.escapeHtml(tool.id)}" style="padding:5px 10px; font-size:12px; color:${tool.enabled ? 'var(--color-danger)' : 'var(--color-success)'};">${tool.enabled ? 'Disable' : 'Enable'}</button>
        </div>
      </div>
    `;

    const bindToolButtons = (container) => {
      container.querySelectorAll('[data-tool-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-tool-action');
          const toolId = btn.getAttribute('data-id');
          const filters = getFilters();
          let res;
          const payload = { userId: filters.userId, actorId: filters.actorId, workspaceId: filters.workspaceId };
          if (action === 'preview') res = await Api.previewTool(toolId, { ...payload, input: parseInputPrompt() });
          if (action === 'run') res = await Api.runTool(toolId, { ...payload, input: parseInputPrompt() });
          if (action === 'propose') res = await Api.proposeTool(toolId, { ...payload, input: parseInputPrompt() });
          if (action === 'enable' || action === 'disable') {
            return Utils.confirmAction(`${action} tool`, `Lanjutkan ${action} untuk ${toolId}?`, async () => {
              const r = action === 'enable' ? await Api.enableTool(toolId, payload) : await Api.disableTool(toolId, payload);
              Utils.showToast(r?.ok && r.data?.ok ? `Tool ${action} sukses.` : `Tool ${action} gagal.`, r?.ok && r.data?.ok ? 'success' : 'danger');
              await loadTools();
            });
          }
          const ok = res?.ok && res.data?.ok;
          if (ok && action === 'preview') {
            document.getElementById('tools-result').innerHTML = `<pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(res.data.preview, null, 2))}</pre>`;
          } else if (ok && action === 'run') {
            document.getElementById('tools-result').innerHTML = `<pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(res.data.result, null, 2))}</pre>`;
          } else if (ok && action === 'propose') {
            document.getElementById('tools-result').innerHTML = `<div class="alert alert-success">Proposal dibuat: <code>${Utils.escapeHtml(res.data.proposal.id)}</code>. Approve/run dari tab Executor.</div>`;
          }
          Utils.showToast(ok ? `Tool ${action} sukses.` : `Tool ${action} gagal.`, ok ? 'success' : 'danger');
          await loadRuns();
        });
      });
    };

    const loadRuns = async () => {
      const filters = getFilters();
      const [runs, audit] = await Promise.all([
        Api.listToolRuns({ workspaceId: filters.workspaceId, limit: 10 }),
        Api.listToolAudit({ workspaceId: filters.workspaceId, limit: 10 })
      ]);
      const runItems = runs.data?.items || [];
      const auditItems = audit.data?.items || [];
      document.getElementById('tools-runs').innerHTML = `
        <div class="card">
          <div class="card-title">Recent Tool Runs</div>
          ${runItems.length ? runItems.map(item => `<div style="padding:8px 0; border-bottom:1px solid var(--border-color);"><strong>${Utils.escapeHtml(item.toolId)}</strong> ${UI.renderBadge(item.status || 'unknown')}<div style="font-size:12px; color:var(--text-secondary);">${Number(item.latencyMs || 0)}ms · ${Utils.escapeHtml(item.error || item.resultSummary || '-')}</div></div>`).join('') : '<p class="text-muted">Belum ada run.</p>'}
        </div>
        <div class="card" style="margin-top:12px;">
          <div class="card-title">Tool Audit</div>
          ${auditItems.length ? auditItems.map(item => `<div style="padding:8px 0; border-bottom:1px solid var(--border-color);"><code>${Utils.escapeHtml(item.action)}</code><div style="font-size:12px; color:var(--text-secondary);">${Utils.escapeHtml(item.toolId || '-')} · ${Utils.escapeHtml(item.reason || item.status || '-')}</div></div>`).join('') : '<p class="text-muted">Belum ada audit.</p>'}
        </div>
      `;
    };

    const loadTools = async () => {
      const filters = getFilters();
      const panel = document.getElementById('tools-list');
      panel.innerHTML = UI.renderLoading('Memuat tool registry...');
      const res = await Api.listTools(filters);
      if (!res.ok || !res.data?.ok) {
        panel.innerHTML = UI.renderError('Gagal memuat tool registry');
        return;
      }
      const items = res.data.items || [];
      panel.innerHTML = items.length
        ? `<div class="card-grid-wide">${items.map(renderToolCard).join('')}</div>`
        : UI.renderEmptyState('🧰', 'Belum Ada Tool', 'Built-in tools akan terdaftar saat API dipanggil.');
      bindToolButtons(panel);
      await loadRuns();
    };

    let html = UI.renderSectionHeader('Tool Registry');
    html += `
      <div class="alert alert-warning" style="margin-bottom:16px;">Write, external, dan danger tools harus lewat proposal executor. Tidak ada shell atau dynamic plugin execution.</div>
      <div class="filter-bar">
        <div class="filter-group"><label>User ID Telegram</label><input id="tools-user-id" value="${Utils.escapeHtml(currentUserId)}"></div>
        ${UI.renderWorkspaceInput('tools')}
        <div class="filter-group"><label>Category</label><select id="tools-category-filter"><option value="">all</option><option>weather</option><option>search</option><option>ops</option><option>report</option><option>planner</option><option>workflow</option><option>goal</option><option>memory</option><option>graph</option><option>utility</option><option>dashboard</option></select></div>
        <div class="filter-group"><label>Risk</label><select id="tools-risk-filter"><option value="">all</option><option>low</option><option>medium</option><option>high</option><option>danger</option></select></div>
        <div class="filter-group"><label>Enabled</label><select id="tools-enabled-filter"><option value="">all</option><option value="true">true</option><option value="false">false</option></select></div>
        <button class="btn btn-primary" id="btn-load-tools" style="height:40px;">Load Tools</button>
      </div>
      <div class="grid grid-2" style="gap:18px; align-items:start;">
        <div>
          <div id="tools-list">${UI.renderEmptyState('🧰', 'Load Tools', 'Klik Load Tools untuk melihat registry.')}</div>
          <div class="card" style="margin-top:12px;"><div class="card-title">Tool Result</div><div id="tools-result"><p class="text-muted">Preview/run output akan muncul di sini.</p></div></div>
        </div>
        <div id="tools-runs">${UI.renderEmptyState('📋', 'Tool Runs', 'Riwayat tool akan muncul di sini.')}</div>
      </div>
    `;
    targetEl.innerHTML = html;
    document.getElementById('btn-load-tools').addEventListener('click', loadTools);
  },

  async renderBackupRecovery(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const getFilters = () => {
      const userId = document.getElementById('backup-user-id').value.trim();
      const workspaceId = document.getElementById('backup-workspace-id').value.trim();
      if (userId) localStorage.setItem('last_user_id', userId);
      UI.setActiveWorkspaceId(workspaceId);
      return { userId, actorId: userId, workspaceId };
    };

    const renderBackupRow = (item = {}) => {
      const total = Object.values(item.itemCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      return `
        <div class="card" style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div>
              <strong>${Utils.escapeHtml(item.id || '-')}</strong>
              <div class="text-muted" style="font-size:12px;">${Utils.escapeHtml(item.type || '-')} · ${Utils.escapeHtml(item.createdAt || '-')}</div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${UI.renderBadge(item.status || 'created')}
              <span class="badge badge-none">${total} items</span>
            </div>
          </div>
          <div class="kv-list" style="margin-top:10px;">
            <div class="kv-item"><span class="kv-key">Workspace</span><span>${Utils.escapeHtml(item.workspaceId || '-')}</span></div>
            <div class="kv-item"><span class="kv-key">Checksum</span><span style="font-family:var(--font-mono);">${Utils.escapeHtml(item.checksum || '-')}</span></div>
          </div>
          <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
            <button class="btn btn-outline" data-backup-action="validate" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Validate</button>
            <button class="btn btn-primary" data-backup-action="export" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Export JSON</button>
            <button class="btn btn-outline" data-backup-action="plan" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Restore Plan</button>
            <button class="btn btn-outline" data-backup-action="archive" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px; color:var(--color-danger);">Archive</button>
          </div>
        </div>
      `;
    };

    const bindBackupButtons = () => {
      document.querySelectorAll('[data-backup-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-backup-action');
          const id = btn.getAttribute('data-id');
          const filters = getFilters();
          let res;
          if (action === 'validate') res = await Api.validateBackup(id, filters);
          if (action === 'plan') res = await Api.createRestorePlan({ ...filters, backupId: id });
          if (action === 'export') {
            res = await Api.exportBackup(id);
            if (res?.ok) {
              const blob = new Blob([JSON.stringify(res.data || {}, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `backup_${id}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }
          }
          if (action === 'archive') {
            return Utils.confirmAction('Archive backup', `Archive backup ${id}?`, async () => {
              const r = await Api.archiveBackup(id, filters);
              Utils.showToast(r?.ok && r.data?.ok ? 'Backup archived.' : 'Archive gagal.', r?.ok && r.data?.ok ? 'success' : 'danger');
              await loadBackups();
            });
          }
          const ok = res?.ok && res.data?.ok;
          document.getElementById('backup-result').innerHTML = `<pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(res?.data || res, null, 2))}</pre>`;
          Utils.showToast(ok ? `Backup ${action} sukses.` : `Backup ${action} gagal.`, ok ? 'success' : 'danger');
          if (action === 'validate') await loadBackups();
        });
      });
    };

    const loadBackups = async () => {
      const filters = getFilters();
      const listEl = document.getElementById('backup-list');
      listEl.innerHTML = UI.renderLoading('Memuat backup...');
      const res = await Api.listBackups({ ...filters, limit: 30, includeArchived: true });
      const items = res.data?.items || [];
      listEl.innerHTML = items.length ? items.map(renderBackupRow).join('') : UI.renderEmptyState('💾', 'Belum Ada Backup', 'Buat backup workspace atau safe system backup.');
      bindBackupButtons();
      const recovery = res.data?.recovery || {};
      document.getElementById('backup-cards').innerHTML = `
        <div class="metric-card"><span class="metric-label">Recovery</span><span class="metric-value">${Utils.escapeHtml(recovery.status || '-')}</span></div>
        <div class="metric-card"><span class="metric-label">Backup Count</span><span class="metric-value">${Number(recovery.backup?.backupCount || items.length)}</span></div>
        <div class="metric-card"><span class="metric-label">Storage</span><span class="metric-value">${Utils.escapeHtml(recovery.storage?.activeDriver || '-')}</span></div>
        <div class="metric-card"><span class="metric-label">Fallback</span><span class="metric-value">${recovery.storage?.fallbackActive ? 'yes' : 'no'}</span></div>
      `;
    };

    const runRecovery = async () => {
      const res = await Api.runRecoveryCheck(getFilters());
      document.getElementById('backup-result').innerHTML = `<pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(res.data || res, null, 2))}</pre>`;
    };

    const runIntegrity = async () => {
      const res = await Api.runIntegrityCheck(getFilters());
      document.getElementById('backup-result').innerHTML = `<pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(res.data || res, null, 2))}</pre>`;
    };

    const createBackup = async (type) => {
      const res = await Api.createBackup({ ...getFilters(), type });
      Utils.showToast(res?.ok && res.data?.ok ? 'Backup dibuat.' : 'Backup gagal.', res?.ok && res.data?.ok ? 'success' : 'danger');
      document.getElementById('backup-result').innerHTML = `<pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(res.data || res, null, 2))}</pre>`;
      await loadBackups();
    };

    let html = UI.renderSectionHeader('Backup & Recovery');
    html += `
      <div class="alert alert-warning" style="margin-bottom:16px;">Restore/import tidak berjalan otomatis. Restore membutuhkan role owner/admin dan confirmation text <code>RESTORE</code>. Backup tidak mengekspor secret/env/API key.</div>
      <div class="filter-bar">
        <div class="filter-group"><label>User ID Telegram</label><input id="backup-user-id" value="${Utils.escapeHtml(currentUserId)}"></div>
        ${UI.renderWorkspaceInput('backup')}
        <button class="btn btn-primary" id="btn-backup-load" style="height:40px;">Load</button>
        <button class="btn btn-outline" id="btn-backup-workspace" style="height:40px;">Create Workspace Backup</button>
        <button class="btn btn-outline" id="btn-backup-user" style="height:40px;">Create User Backup</button>
        <button class="btn btn-outline" id="btn-backup-system" style="height:40px;">Create Safe System Backup</button>
      </div>
      <div class="metrics-grid" id="backup-cards"></div>
      <div class="grid grid-2" style="gap:18px; align-items:start;">
        <div>
          <div id="backup-list">${UI.renderEmptyState('💾', 'Load Backups', 'Klik Load untuk melihat backup.')}</div>
        </div>
        <div>
          <div class="card">
            <div class="card-title">Recovery & Integrity</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
              <button class="btn btn-outline" id="btn-recovery-check">Run Recovery Check</button>
              <button class="btn btn-outline" id="btn-integrity-check">Run Integrity Check</button>
            </div>
            <textarea id="import-json" rows="8" style="width:100%; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:6px; padding:10px;" placeholder="Paste sanitized backup JSON untuk validate/preview"></textarea>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
              <button class="btn btn-outline" id="btn-import-validate">Validate Import</button>
              <button class="btn btn-outline" id="btn-import-preview">Preview Import</button>
            </div>
          </div>
          <div class="card" style="margin-top:12px;"><div class="card-title">Result</div><div id="backup-result"><p class="text-muted">Output backup/recovery akan muncul di sini.</p></div></div>
        </div>
      </div>
    `;
    targetEl.innerHTML = html;
    document.getElementById('btn-backup-load').addEventListener('click', loadBackups);
    document.getElementById('btn-backup-workspace').addEventListener('click', () => createBackup('workspace'));
    document.getElementById('btn-backup-user').addEventListener('click', () => createBackup('user'));
    document.getElementById('btn-backup-system').addEventListener('click', () => createBackup('full_safe'));
    document.getElementById('btn-recovery-check').addEventListener('click', runRecovery);
    document.getElementById('btn-integrity-check').addEventListener('click', runIntegrity);
    document.getElementById('btn-import-validate').addEventListener('click', async () => {
      let payload;
      try { payload = JSON.parse(document.getElementById('import-json').value || '{}'); } catch (_) { return Utils.showToast('JSON tidak valid.', 'danger'); }
      const res = await Api.validateImport(payload);
      document.getElementById('backup-result').innerHTML = `<pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(res.data || res, null, 2))}</pre>`;
    });
    document.getElementById('btn-import-preview').addEventListener('click', async () => {
      let payload;
      try { payload = JSON.parse(document.getElementById('import-json').value || '{}'); } catch (_) { return Utils.showToast('JSON tidak valid.', 'danger'); }
      const res = await Api.previewImport(payload);
      document.getElementById('backup-result').innerHTML = `<pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(res.data || res, null, 2))}</pre>`;
    });
    await loadBackups();
  },

  async renderBackupRecovery(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const getFilters = () => {
      const userId = document.getElementById('backup-user-id').value.trim();
      const workspaceId = document.getElementById('backup-workspace-id').value.trim();
      if (userId) localStorage.setItem('last_user_id', userId);
      UI.setActiveWorkspaceId(workspaceId);
      return { userId, actorId: userId, workspaceId };
    };

    const writeResult = (value) => {
      document.getElementById('backup-result').innerHTML = `<pre style="white-space:pre-wrap;">${Utils.escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
    };

    const renderBackupRow = (item = {}) => {
      const total = Object.values(item.itemCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      return `
        <div class="card" style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div>
              <strong>${Utils.escapeHtml(item.id || '-')}</strong>
              <div class="text-muted" style="font-size:12px;">${Utils.escapeHtml(item.type || '-')} · ${Utils.escapeHtml(item.createdAt || '-')}</div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${UI.renderBadge(item.status || 'created')}
              <span class="badge badge-none">${total} items</span>
            </div>
          </div>
          <div class="kv-list" style="margin-top:10px;">
            <div class="kv-item"><span class="kv-key">Workspace</span><span>${Utils.escapeHtml(item.workspaceId || '-')}</span></div>
            <div class="kv-item"><span class="kv-key">Includes</span><span>${(item.includes || []).slice(0, 4).map(Utils.escapeHtml).join(', ') || '-'}</span></div>
            <div class="kv-item"><span class="kv-key">Checksum</span><span style="font-family:var(--font-mono);">${Utils.escapeHtml(item.checksum || '-')}</span></div>
          </div>
          <div class="backup-action-row" style="margin-top:12px;">
            <button class="btn btn-outline" data-backup-action="validate" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Validate</button>
            <button class="btn btn-primary" data-backup-action="export" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Export JSON</button>
            <button class="btn btn-outline" data-backup-action="plan" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Restore Plan</button>
            <button class="btn btn-outline" data-backup-action="archive" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px; color:var(--color-danger);">Archive</button>
          </div>
        </div>
      `;
    };

    const renderScheduleRow = (item = {}) => `
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <strong>${Utils.escapeHtml(item.name || item.id || '-')}</strong>
            <div class="text-muted" style="font-size:12px;">${Utils.escapeHtml(item.id || '-')} · ${Utils.escapeHtml(item.frequency || 'manual')} · ${Utils.escapeHtml(item.scope || 'workspace')}</div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${UI.renderBadge(item.enabled ? 'enabled' : 'disabled')}
            ${item.due ? UI.renderBadge('due') : UI.renderBadge('not due')}
          </div>
        </div>
        <div class="kv-list" style="margin-top:10px;">
          <div class="kv-item"><span class="kv-key">Next run</span><span>${Utils.escapeHtml(item.nextRunAt || '-')}</span></div>
          <div class="kv-item"><span class="kv-key">Last run</span><span>${Utils.escapeHtml(item.lastRunAt || '-')}</span></div>
          <div class="kv-item"><span class="kv-key">Status</span><span>${Utils.escapeHtml(item.lastStatus || '-')}</span></div>
        </div>
        <div class="backup-action-row" style="margin-top:12px;">
          <button class="btn btn-outline" data-schedule-action="preview" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Preview</button>
          <button class="btn btn-outline" data-schedule-action="request" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Request Approval</button>
          <button class="btn btn-outline" data-schedule-action="archive" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px; color:var(--color-danger);">Archive</button>
        </div>
      </div>
    `;

    const renderRunRow = (item = {}) => `
      <div style="padding:10px 0; border-bottom:1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
          <strong>${Utils.escapeHtml(item.id || '-')}</strong>
          ${UI.renderBadge(item.status || 'pending_approval')}
        </div>
        <div class="text-muted" style="font-size:12px;">Schedule: ${Utils.escapeHtml(item.scheduleId || '-')} · Backup: ${Utils.escapeHtml(item.backupId || '-')}</div>
        <div class="backup-action-row" style="margin-top:8px;">
          <button class="btn btn-outline" data-run-action="approve" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Approve</button>
          <button class="btn btn-primary" data-run-action="run" data-id="${Utils.escapeHtml(item.id)}" style="padding:5px 10px; font-size:12px;">Run Approved</button>
        </div>
      </div>
    `;

    const bindBackupButtons = () => {
      document.querySelectorAll('[data-backup-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-backup-action');
          const id = btn.getAttribute('data-id');
          const filters = getFilters();
          let res;
          if (action === 'validate') res = await Api.validateBackup(id, filters);
          if (action === 'plan') res = await Api.createRestorePlan({ ...filters, backupId: id });
          if (action === 'export') {
            BackupDownloads.showDownloadProgress('backup-result');
            res = await Api.exportBackup(id);
            if (res?.ok && res.data) {
              const payload = res.data || {};
              const manifest = payload.manifest || {};
              const filename = BackupDownloads.buildSafeFilename('telegram-aios', `${manifest.type || 'workspace'}-backup`, manifest.createdAt || new Date());
              const download = BackupDownloads.downloadJsonFile(filename, payload);
              BackupDownloads.showDownloadResult('backup-result', download, manifest);
              Utils.showToast('Backup JSON diunduh. Secrets dikecualikan.', 'success');
              return;
            }
          }
          if (action === 'archive') {
            return Utils.confirmAction('Archive backup', `Archive backup ${id}?`, async () => {
              const r = await Api.archiveBackup(id, filters);
              Utils.showToast(r?.ok && r.data?.ok ? 'Backup archived.' : 'Archive gagal.', r?.ok && r.data?.ok ? 'success' : 'danger');
              await loadBackups();
            });
          }
          const ok = res?.ok && res.data?.ok;
          writeResult(res?.data || res);
          Utils.showToast(ok ? `Backup ${action} sukses.` : `Backup ${action} gagal.`, ok ? 'success' : 'danger');
          if (action === 'validate') await loadBackups();
        });
      });
    };

    const bindScheduleButtons = () => {
      document.querySelectorAll('[data-schedule-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-schedule-action');
          const id = btn.getAttribute('data-id');
          let res;
          if (action === 'preview') res = await Api.previewBackupSchedule(id, getFilters());
          if (action === 'request') res = await Api.requestBackupScheduleRun(id, getFilters());
          if (action === 'archive') {
            return Utils.confirmAction('Archive schedule', `Archive schedule ${id}?`, async () => {
              const r = await Api.archiveBackupSchedule(id, getFilters());
              Utils.showToast(r?.ok && r.data?.ok ? 'Schedule diarsipkan.' : 'Archive schedule gagal.', r?.ok && r.data?.ok ? 'success' : 'danger');
              await loadSchedules();
            });
          }
          writeResult(res?.data || res);
          Utils.showToast(res?.ok && res.data?.ok ? `Schedule ${action} sukses.` : `Schedule ${action} gagal.`, res?.ok && res.data?.ok ? 'success' : 'danger');
          await loadSchedules();
        });
      });
    };

    const bindRunButtons = () => {
      document.querySelectorAll('[data-run-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-run-action');
          const id = btn.getAttribute('data-id');
          const run = async () => {
            const res = action === 'approve'
              ? await Api.approveBackupScheduleRun(id, getFilters())
              : await Api.runApprovedBackupSchedule(id, getFilters());
            writeResult(res?.data || res);
            Utils.showToast(res?.ok && res.data?.ok ? `Schedule run ${action} sukses.` : `Schedule run ${action} gagal.`, res?.ok && res.data?.ok ? 'success' : 'danger');
            await loadBackups();
          };
          if (action === 'run') return Utils.confirmAction('Run approved backup', 'Backup schedule yang sudah approved akan membuat snapshot baru. Lanjutkan?', run);
          return run();
        });
      });
    };

    const loadSchedules = async () => {
      const filters = getFilters();
      const scheduleRes = await Api.listBackupSchedules({ ...filters, limit: 30, includeArchived: false, requestDue: true });
      const schedules = scheduleRes.data?.items || [];
      document.getElementById('backup-schedule-list').innerHTML = schedules.length
        ? schedules.map(renderScheduleRow).join('')
        : UI.renderEmptyState('⏱️', 'Belum Ada Schedule', 'Buat schedule manual/daily/weekly/monthly yang tetap butuh approval.');

      const runRes = await Api.listBackupScheduleRuns({ ...filters, limit: 20 });
      const runs = runRes.data?.items || [];
      document.getElementById('backup-schedule-runs').innerHTML = runs.length ? runs.map(renderRunRow).join('') : '<p class="text-muted">Belum ada pending run.</p>';
      bindScheduleButtons();
      bindRunButtons();
    };

    const loadBackups = async () => {
      const filters = getFilters();
      const listEl = document.getElementById('backup-list');
      listEl.innerHTML = UI.renderLoading('Memuat backup...');
      const res = await Api.listBackups({ ...filters, limit: 30, includeArchived: true });
      const items = res.data?.items || [];
      listEl.innerHTML = items.length ? items.map(renderBackupRow).join('') : UI.renderEmptyState('💾', 'Belum Ada Backup', 'Buat backup workspace atau safe system backup.');
      bindBackupButtons();
      const recovery = res.data?.recovery || {};
      document.getElementById('backup-cards').innerHTML = `
        <div class="metric-card"><span class="metric-label">Recovery</span><span class="metric-value">${Utils.escapeHtml(recovery.status || '-')}</span></div>
        <div class="metric-card"><span class="metric-label">Backup Count</span><span class="metric-value">${Number(recovery.backup?.backupCount || items.length)}</span></div>
        <div class="metric-card"><span class="metric-label">Storage</span><span class="metric-value">${Utils.escapeHtml(recovery.storage?.activeDriver || '-')}</span></div>
        <div class="metric-card"><span class="metric-label">Fallback</span><span class="metric-value">${recovery.storage?.fallbackActive ? 'yes' : 'no'}</span></div>
      `;
      await loadSchedules();
    };

    const createBackup = async (type) => {
      const res = await Api.createBackup({ ...getFilters(), type });
      Utils.showToast(res?.ok && res.data?.ok ? 'Backup dibuat.' : 'Backup gagal.', res?.ok && res.data?.ok ? 'success' : 'danger');
      writeResult(res.data || res);
      await loadBackups();
    };

    const createSchedule = async () => {
      const payload = {
        ...getFilters(),
        name: document.getElementById('schedule-name').value.trim() || 'Workspace backup schedule',
        scope: document.getElementById('schedule-scope').value,
        frequency: document.getElementById('schedule-frequency').value,
        enabled: document.getElementById('schedule-enabled').checked
      };
      const res = await Api.createBackupSchedule(payload);
      writeResult(res.data || res);
      Utils.showToast(res?.ok && res.data?.ok ? 'Schedule dibuat.' : 'Schedule gagal dibuat.', res?.ok && res.data?.ok ? 'success' : 'danger');
      await loadSchedules();
    };

    let html = UI.renderSectionHeader('Backup & Recovery');
    html += `
      <div class="alert alert-warning" style="margin-bottom:16px;">Restore/import tidak berjalan otomatis. Restore membutuhkan role owner/admin dan confirmation text <code>RESTORE</code>. Backup tidak mengekspor secret/env/API key.</div>
      <div class="filter-bar">
        <div class="filter-group"><label>User ID Telegram</label><input id="backup-user-id" value="${Utils.escapeHtml(currentUserId)}"></div>
        ${UI.renderWorkspaceInput('backup')}
        <button class="btn btn-primary" id="btn-backup-load" style="height:40px;">Load</button>
        <button class="btn btn-outline" id="btn-backup-workspace" style="height:40px;">Create Workspace Backup</button>
        <button class="btn btn-outline" id="btn-backup-user" style="height:40px;">Create User Backup</button>
        <button class="btn btn-outline" id="btn-backup-system" style="height:40px;">Create Safe System Backup</button>
      </div>
      <div class="metrics-grid" id="backup-cards"></div>
      <div class="backup-section-grid">
        <div class="card">
          <div class="card-title">Create Backup</div>
          <p class="text-muted" style="margin-bottom:12px;">Backup aman berisi data AI OS tanpa env, token, API key, atau connection string.</p>
          <div id="backup-list">${UI.renderEmptyState('💾', 'Load Backups', 'Klik Load untuk melihat backup.')}</div>
        </div>
        <div class="card">
          <div class="card-title">Download / Export</div>
          <div class="alert alert-info">Klik Export JSON pada backup. File dibuat via Blob URL lokal dengan nama aman. Secrets tetap dikecualikan server-side.</div>
          <div class="card-title" style="margin-top:16px;">Import Preview</div>
          <div id="import-drop-zone" class="import-drop-zone">
            Drop file JSON di sini atau pilih file.
            <input id="import-file" type="file" accept="application/json,.json" style="display:block; margin:12px auto 0;">
          </div>
          <textarea id="import-json" rows="8" style="width:100%; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:6px; padding:10px;" placeholder="Paste sanitized backup JSON untuk validate/preview"></textarea>
          <div class="backup-action-row" style="margin-top:10px;">
            <button class="btn btn-outline" id="btn-import-validate">Validate Import</button>
            <button class="btn btn-outline" id="btn-import-preview">Preview Import</button>
            <button class="btn btn-outline" id="btn-restore-plan">Create Restore Plan</button>
          </div>
        </div>
      </div>
      <div class="backup-section-grid" style="margin-top:18px;">
        <div class="card">
          <div class="card-title">Scheduler</div>
          <div class="filter-bar" style="margin-bottom:12px;">
            <div class="filter-group"><label>Name</label><input id="schedule-name" placeholder="Weekly workspace backup"></div>
            <div class="filter-group"><label>Scope</label><select id="schedule-scope"><option value="workspace">workspace</option><option value="user">user</option><option value="system_safe">system_safe</option></select></div>
            <div class="filter-group"><label>Frequency</label><select id="schedule-frequency"><option value="manual">manual</option><option value="daily">daily</option><option value="weekly">weekly</option><option value="monthly">monthly</option></select></div>
            <label style="display:flex; align-items:center; gap:8px; min-height:40px;"><input type="checkbox" id="schedule-enabled" checked> Enabled</label>
            <button class="btn btn-primary" id="btn-schedule-create" style="height:40px;">Create Schedule</button>
          </div>
          <div id="backup-schedule-list">${UI.renderEmptyState('⏱️', 'Load Schedules', 'Schedule akan muncul di sini.')}</div>
        </div>
        <div class="card">
          <div class="card-title">Due / Pending Runs</div>
          <p class="text-muted" style="margin-bottom:12px;">Backup scheduled tidak berjalan otomatis. Request run, approve, lalu run approved.</p>
          <div id="backup-schedule-runs"><p class="text-muted">Load backup untuk melihat pending run.</p></div>
        </div>
      </div>
      <div class="backup-section-grid" style="margin-top:18px;">
        <div class="card">
          <div class="card-title">Disaster Recovery & Integrity</div>
          <div class="backup-action-row" style="margin-bottom:12px;">
            <button class="btn btn-outline" id="btn-recovery-check">Run Recovery Check</button>
            <button class="btn btn-outline" id="btn-integrity-check">Run Integrity Check</button>
          </div>
          <p class="text-muted">Cek storage driver, backup age, critical keys, dan referensi data yang rusak.</p>
        </div>
        <div class="card"><div class="card-title">Result</div><div id="backup-result"><p class="text-muted">Output backup/recovery akan muncul di sini.</p></div></div>
      </div>
    `;
    targetEl.innerHTML = html;
    document.getElementById('btn-backup-load').addEventListener('click', loadBackups);
    document.getElementById('btn-backup-workspace').addEventListener('click', () => createBackup('workspace'));
    document.getElementById('btn-backup-user').addEventListener('click', () => createBackup('user'));
    document.getElementById('btn-backup-system').addEventListener('click', () => createBackup('full_safe'));
    document.getElementById('btn-recovery-check').addEventListener('click', async () => writeResult((await Api.runRecoveryCheck(getFilters())).data || {}));
    document.getElementById('btn-integrity-check').addEventListener('click', async () => writeResult((await Api.runIntegrityCheck(getFilters())).data || {}));
    document.getElementById('btn-schedule-create').addEventListener('click', createSchedule);
    BackupImportUI.bindImportDropZone();
    document.getElementById('btn-import-validate').addEventListener('click', async () => {
      const parsed = BackupImportUI.parseJsonSafely(document.getElementById('import-json').value || '{}');
      if (!parsed.ok) return Utils.showToast(parsed.reason || 'JSON tidak valid.', 'danger');
      writeResult((await Api.validateImport(parsed.payload)).data || {});
    });
    document.getElementById('btn-import-preview').addEventListener('click', async () => {
      const parsed = BackupImportUI.parseJsonSafely(document.getElementById('import-json').value || '{}');
      if (!parsed.ok) return Utils.showToast(parsed.reason || 'JSON tidak valid.', 'danger');
      const res = await Api.previewImport(parsed.payload);
      document.getElementById('backup-result').innerHTML = BackupImportUI.renderPreview(res.data?.preview || res.data || res);
    });
    document.getElementById('btn-restore-plan').addEventListener('click', async () => {
      const parsed = BackupImportUI.parseJsonSafely(document.getElementById('import-json').value || '{}');
      if (!parsed.ok) return Utils.showToast(parsed.reason || 'JSON tidak valid.', 'danger');
      writeResult((await Api.createRestorePlan({ ...getFilters(), payload: parsed.payload })).data || {});
    });
    await loadBackups();
  },

  async renderInsights(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const loadData = async () => {
      const userId = document.getElementById('insights-user-id').value.trim();
      const workspaceId = document.getElementById('insights-workspace-id').value.trim();
      if (!userId) return;

      localStorage.setItem('last_user_id', userId);
      UI.setActiveWorkspaceId(workspaceId);
      const container = document.getElementById('insights-list-container');
      container.innerHTML = UI.renderLoading('Memuat Insights...');

      const res = await Api.getUserInsights(userId, workspaceId);
      if (!res.ok) {
        container.innerHTML = UI.renderError('Gagal Memuat Insights');
        return;
      }

      const insights = res.data.items || [];
      if (insights.length === 0) {
        container.innerHTML = UI.renderEmptyState('💡', 'Belum Ada Insights', 'Gunakan commands refleksi kognitif untuk mengumpulkan insights baru.');
        return;
      }

      let iHtml = `
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${insights.map(item => `
            <div class="card">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                  <span style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">ID: ${item.id}</span>
                  <div style="margin-top:4px;">
                    <span class="badge badge-none" style="font-size:10px;">Confidence: ${(item.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <span class="text-muted" style="font-size:12px;">${Utils.formatDate(item.createdAt)}</span>
              </div>
              <p style="font-size:14px; line-height:1.6; color:var(--text-primary); margin-bottom:12px;">${Utils.escapeHtml(item.content)}</p>
              ${item.relatedConcepts && item.relatedConcepts.length > 0 ? `
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  ${item.relatedConcepts.map(c => `<span style="font-size:11px; background:var(--bg-tertiary); padding:2px 8px; border-radius:4px; color:var(--color-info);">@${Utils.escapeHtml(c)}</span>`).join('')}
                </div>
              ` : ''}
              <div style="font-size:11px; color:var(--text-muted); border-top:1px solid var(--border-color); padding-top:12px; margin-top:12px;">
                Source context: ${Utils.escapeHtml(item.source || 'cognitive-reflection')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
      container.innerHTML = iHtml;
    };

    let html = UI.renderSectionHeader('Cognitive Insights');
    html += `
      <div class="filter-bar">
        <div class="filter-group">
          <label for="insights-user-id">User ID Telegram</label>
          <input type="text" id="insights-user-id" value="${Utils.escapeHtml(currentUserId)}">
        </div>
        ${UI.renderWorkspaceInput('insights')}
        <button class="btn btn-primary" id="btn-load-insights" style="height:40px;">Load Insights</button>
      </div>
      <div id="insights-list-container">
        ${UI.renderEmptyState('💡', 'Masukkan User ID', 'Load insight untuk melihat pelajaran dan pola mental yang dianalisis oleh AI.')}
      </div>
    `;

    targetEl.innerHTML = html;
    document.getElementById('btn-load-insights').addEventListener('click', loadData);
  },

  async renderGraph(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const loadData = async () => {
      const userId = document.getElementById('graph-user-id').value.trim();
      const workspaceId = document.getElementById('graph-workspace-id').value.trim();
      const q = document.getElementById('search-graph-concept').value.trim();
      if (!userId) return;

      localStorage.setItem('last_user_id', userId);
      UI.setActiveWorkspaceId(workspaceId);
      const container = document.getElementById('graph-content-container');
      container.innerHTML = UI.renderLoading('Memuat Knowledge Graph...');

      const res = q ? await Api.searchUserGraph(userId, q, workspaceId) : await Api.getUserGraph(userId, workspaceId);
      if (!res.ok) {
        container.innerHTML = UI.renderError('Gagal Memuat Knowledge Graph');
        return;
      }

      const graph = res.data || {};
      const nodes = graph.topNodes || graph.nodes || [];
      const edges = graph.topEdges || graph.edges || [];
      const stats = graph.stats || { nodes: nodes.length, edges: edges.length };

      if (nodes.length === 0) {
        container.innerHTML = UI.renderEmptyState('🕸️', 'Graph Kosong', 'Hubungan konsep entitas belum terbentuk untuk user ini.');
        return;
      }

      const graphForView = { nodes, edges, stats };
      const svgHtml = window.GraphViz
        ? window.GraphViz.renderGraphSvg(graphForView, { nodeLimit: 24, edgeLimit: 40 })
        : '';
      const graphStats = window.GraphViz ? window.GraphViz.renderGraphStats(graphForView) : stats;

      let gHtml = `
        ${svgHtml}

        <div class="card" style="margin-bottom:24px;">
          <div class="card-title">Graph Statistics</div>
          <div style="display:flex; gap:32px; font-family:var(--font-mono); font-size:18px; font-weight:700; margin-top:8px;">
            <div>Nodes: <span class="text-info">${graphStats.nodes}</span></div>
            <div>Edges: <span class="text-success">${graphStats.edges}</span></div>
            <div>Avg confidence: <span class="text-warning">${((graphStats.averageConfidence || 0) * 100).toFixed(0)}%</span></div>
          </div>
        </div>

        <h3 style="font-size:16px; font-weight:600; color:var(--text-secondary); margin-bottom:16px;">DAFTAR HUBUNGAN ENTITAS (EDGES)</h3>
        <div class="relationship-list">
          ${edges.slice(0, 30).map(edge => `
            <div class="relationship-card">
              <span class="node-entity" title="${edge.from}">${Utils.escapeHtml(edge.from)}</span>
              <div class="edge-link">
                <span class="edge-label">${Utils.escapeHtml(edge.relationship)}</span>
                <div class="edge-line"><span class="edge-arrow">▶</span></div>
                <span style="font-size:9px; color:var(--text-muted); margin-top:2px;">W: ${(edge.weight || 0.5).toFixed(2)}</span>
              </div>
              <span class="node-entity" title="${edge.to}">${Utils.escapeHtml(edge.to)}</span>
            </div>
          `).join('')}
        </div>
      `;
      container.innerHTML = gHtml;
    };

    let html = UI.renderSectionHeader('Knowledge Graph Explorer');
    html += `
      <div class="filter-bar">
        <div class="filter-group">
          <label for="graph-user-id">User ID Telegram</label>
          <input type="text" id="graph-user-id" value="${Utils.escapeHtml(currentUserId)}">
        </div>
        ${UI.renderWorkspaceInput('graph')}
        <div class="filter-group">
          <label for="search-graph-concept">Cari Konsep Spesifik (Opsional)</label>
          <input type="text" id="search-graph-concept" placeholder="E.g., memory, study">
        </div>
        <button class="btn btn-primary" id="btn-load-graph" style="height:40px;">Load Graph</button>
      </div>
      <div id="graph-content-container">
        ${UI.renderEmptyState('🕸️', 'Masukkan User ID', 'Load graph untuk menampilkan keterhubungan konsep ingatan user.')}
      </div>
    `;

    targetEl.innerHTML = html;
    document.getElementById('btn-load-graph').addEventListener('click', loadData);
  },

  async renderBenchmarks(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat benchmarks history...');

    const res = await Api.getBenchmarks();
    if (!res.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Benchmarks');
      return;
    }

    const { summary, history } = res.data;
    const latest = history[history.length - 1] || null;

    let html = UI.renderSectionHeader('Benchmarks Audit', `
      <button class="btn btn-primary" id="btn-benchmark-light">⚡ Run Light Benchmark</button>
      <button class="btn btn-outline" id="btn-benchmark-full" disabled>⚡ Run Full Benchmark (Coming soon)</button>
    `);

    html += `
      <div class="card-grid">
        <div class="card">
          <div class="card-title">Latest Score</div>
          <div class="card-value" style="color: ${latest && latest.passed ? 'var(--color-success)' : 'var(--color-warning)'}">
            ${latest ? UI.formatScore(latest.score) : '0%'}
          </div>
          <div class="card-subtitle">Status: ${latest ? UI.renderBadge(latest.status) : 'none'}</div>
        </div>
        <div class="card">
          <div class="card-title">Total Benchmark Runs</div>
          <div class="card-value">${summary.totalRuns ?? 0}</div>
          <div class="card-subtitle">Baseline Run ID: ${Utils.escapeHtml(summary.baselineId || 'None')}</div>
        </div>
        <div class="card">
          <div class="card-title">Regression Check</div>
          <div class="card-value" style="color: ${summary.regressionAgainstBaseline ? 'var(--color-danger)' : 'var(--color-success)'}">
            ${summary.regressionAgainstBaseline ? 'REGRESSION' : 'STABLE'}
          </div>
          <div class="card-subtitle">Dibandingkan dengan Baseline</div>
        </div>
      </div>
    `;

    // History Table
    html += `
      <div class="panel">
        <h3 class="panel-title">Benchmark Runs History</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Tanggal Run</th>
                <th>Tipe</th>
                <th>Jumlah Cases</th>
                <th>Rata-rata Skor</th>
                <th>Hasil</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(run => `
                <tr>
                  <td style="font-family:var(--font-mono); font-weight:bold;">${Utils.escapeHtml(run.id)}</td>
                  <td>${Utils.formatDate(run.createdAt)}</td>
                  <td><code>${Utils.escapeHtml(run.type)}</code></td>
                  <td>${run.caseCount} cases</td>
                  <td style="font-family:var(--font-mono); font-weight:bold; color: var(--color-accent);">${UI.formatScore(run.score)}</td>
                  <td>${UI.renderBadge(run.status)}</td>
                </tr>
              `).join('')}
              ${history.length === 0 ? `<tr><td colspan="6" class="text-center text-muted">Belum ada history benchmark run.</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    targetEl.innerHTML = html;

    document.getElementById('btn-benchmark-light').addEventListener('click', () => {
      Utils.confirmAction('Run Light Benchmark', 'Apakah Anda yakin ingin memicu simulasi benchmark AI OS ringan in-memory?', async () => {
        Utils.showToast('Menjalankan light benchmark...', 'info');
        const r = await Api.runBenchmarkLight();
        if (r.ok && r.data.ok) {
          Utils.showToast('Benchmark selesai!', 'success');
          this.renderBenchmarks(targetEl);
        } else {
          Utils.showToast('Gagal memicu benchmark.', 'danger');
        }
      });
    });
  },

  async renderIncidents(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat laporan incidents...');

    const res = await Api.getIncidents();
    if (!res.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Incidents');
      return;
    }

    const incidents = res.data.items || [];

    let html = UI.renderSectionHeader('Incidents Log', `
      <button class="btn btn-outline" id="btn-refresh-incidents">🔄 Refresh</button>
    `);

    html += `
      <div class="panel">
        <h3 class="panel-title">Laporan Masalah Produksi Terkini</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Kategori & Severity</th>
                <th>Deskripsi Kejadian</th>
                <th>Dugaan Penyebab</th>
                <th>Rekomendasi Perbaikan</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              ${incidents.map(inc => `
                <tr>
                  <td style="font-family:var(--font-mono); font-weight:bold; font-size:11px;">${Utils.escapeHtml(inc.id)}</td>
                  <td>
                    ${UI.renderBadge(inc.severity)}
                    <span class="badge badge-none" style="font-size:10px;">${Utils.escapeHtml(inc.category)}</span>
                  </td>
                  <td><strong>${Utils.escapeHtml(inc.title)}</strong></td>
                  <td style="font-size:12px; color:var(--text-secondary);">${Utils.escapeHtml(inc.suspectedCause || '-')}</td>
                  <td style="font-size:12px; color:var(--text-secondary);">
                    ${inc.recommendedFixes && inc.recommendedFixes.length > 0 
                      ? `<ul style="padding-left:14px;">${inc.recommendedFixes.map(f => `<li>${Utils.escapeHtml(f)}</li>`).join('')}</ul>` 
                      : '-'}
                  </td>
                  <td style="font-size:11px; color:var(--text-muted);">${Utils.formatDate(inc.createdAt)}</td>
                </tr>
              `).join('')}
              ${incidents.length === 0 ? `<tr><td colspan="6" class="text-center text-muted" style="padding:40px;">🎉 Tidak ada incident/error yang terekam. Bot berjalan stabil.</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    targetEl.innerHTML = html;
    document.getElementById('btn-refresh-incidents').addEventListener('click', () => this.renderIncidents(targetEl));
  },

  async renderAudit(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat audit log...');

    const loadData = async () => {
      const filters = {
        limit: document.getElementById('audit-limit')?.value || 20,
        action: document.getElementById('audit-action')?.value || '',
        status: document.getElementById('audit-status')?.value || '',
        targetType: document.getElementById('audit-target-type')?.value || '',
        userId: document.getElementById('audit-user-id')?.value || '',
        workspaceId: document.getElementById('audit-workspace-id')?.value || '',
        decision: document.getElementById('audit-decision')?.value || ''
      };
      const res = await Api.getAuditLogs(filters);
      const container = document.getElementById('audit-list-container');
      if (!res.ok) {
        container.innerHTML = UI.renderError('Gagal Memuat Audit Log', 'Pastikan token admin benar.');
        return;
      }
      const items = res.data.items || [];
      if (!items.length) {
        container.innerHTML = UI.renderEmptyState('🧾', 'Belum Ada Audit', 'Action dashboard belum menghasilkan audit log.');
        return;
      }
      container.innerHTML = UI.renderTable(
        ['Waktu', 'Action', 'Workspace', 'Decision', 'Target', 'Status', 'User', 'Reason'],
        items.map(item => [
          Utils.escapeHtml(Utils.formatDate(item.createdAt)),
          `<code>${Utils.escapeHtml(item.action)}</code>`,
          `<code>${Utils.escapeHtml(item.workspaceId || '-')}</code>`,
          UI.renderBadge(item.decision || 'allowed'),
          `${Utils.escapeHtml(item.targetType || '-')}:${Utils.escapeHtml(item.targetId || '-')}`,
          UI.renderBadge(item.status || 'ok'),
          Utils.escapeHtml(item.userId || '-'),
          Utils.escapeHtml(item.reason || '-')
        ])
      );
    };

    let html = UI.renderSectionHeader('Audit Log', `
      <button class="btn btn-outline" id="btn-refresh-audit">Refresh</button>
    `);
    html += `
      <div class="filter-bar">
        <div class="filter-group">
          <label for="audit-user-id">User ID</label>
          <input type="text" id="audit-user-id" placeholder="optional">
        </div>
        <div class="filter-group">
          <label for="audit-workspace-id">Workspace ID</label>
          <input type="text" id="audit-workspace-id" placeholder="optional">
        </div>
        <div class="filter-group">
          <label for="audit-action">Action</label>
          <input type="text" id="audit-action" placeholder="memory/update">
        </div>
        <div class="filter-group">
          <label for="audit-status">Status</label>
          <input type="text" id="audit-status" placeholder="ok/rejected">
        </div>
        <div class="filter-group">
          <label for="audit-target-type">Target Type</label>
          <input type="text" id="audit-target-type" placeholder="memory/goal/workflow">
        </div>
        <div class="filter-group">
          <label for="audit-decision">Decision</label>
          <input type="text" id="audit-decision" placeholder="allowed/denied">
        </div>
        <div class="filter-group" style="max-width:100px;">
          <label for="audit-limit">Limit</label>
          <select id="audit-limit"><option>20</option><option>50</option><option>100</option></select>
        </div>
        <button class="btn btn-primary" id="btn-load-audit" style="height:40px;">Load Audit</button>
      </div>
      <div class="panel" style="border-color:rgba(240,60,60,0.35);">
        <h3 class="panel-title">Danger Zone Rules</h3>
        <p style="color:var(--text-secondary); font-size:13px;">Archive/restore action membutuhkan confirmation word. Tidak ada hard delete endpoint di dashboard Phase 13.</p>
      </div>
      <div id="audit-list-container">${UI.renderLoading('Memuat audit log...')}</div>
    `;
    targetEl.innerHTML = html;
    document.getElementById('btn-load-audit').addEventListener('click', loadData);
    document.getElementById('btn-refresh-audit').addEventListener('click', loadData);
    await loadData();
  },

  async renderCommands(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat daftar commands...');

    const res = await Api.getCommands();
    if (!res.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Commands');
      return;
    }

    const categories = res.data || {};

    const renderGrid = (searchQuery = '') => {
      const listContainer = document.getElementById('commands-catalog-grid');
      let gridHtml = '';

      for (const [cat, list] of Object.entries(categories)) {
        const filtered = list.filter(cmd => cmd.toLowerCase().includes(searchQuery.toLowerCase()));
        if (filtered.length === 0) continue;

        gridHtml += `
          <div class="panel" style="margin-bottom:20px;">
            <h3 class="panel-title" style="text-transform:uppercase; font-size:14px; font-weight:700; color:var(--color-accent);">${Utils.escapeHtml(cat)}</h3>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
              ${filtered.map(cmd => `<code style="background:var(--bg-primary); border:1px solid var(--border-color); padding:6px 12px; border-radius:6px; font-family:var(--font-mono); font-size:13px; color:var(--text-primary);">${Utils.escapeHtml(cmd)}</code>`).join('')}
            </div>
          </div>
        `;
      }

      listContainer.innerHTML = gridHtml || UI.renderEmptyState('📜', 'Tidak Ditemukan', 'Tidak ada command yang cocok dengan kata kunci pencarian.');
    };

    let html = UI.renderSectionHeader('Command Catalog');
    html += `
      <div class="filter-bar" style="margin-bottom:24px;">
        <div class="filter-group">
          <label for="search-commands-input">Cari Command Bot</label>
          <input type="text" id="search-commands-input" placeholder="Ketik kata kunci E.g., /remember, /goal...">
        </div>
      </div>
      <div id="commands-catalog-grid"></div>
    `;

    targetEl.innerHTML = html;
    renderGrid('');

    document.getElementById('search-commands-input').addEventListener('input', (e) => {
      renderGrid(e.target.value.trim());
    });
  },

  async renderEnv(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Mengecek status env...');

    const res = await Api.getEnvCheck();
    if (!res.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Mengecek Environment');
      return;
    }

    const env = res.data || {};

    let html = UI.renderSectionHeader('Environment Check');
    html += `
      <div class="panel">
        <h3 class="panel-title">Status Konfigurasi Environment Variables</h3>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:20px;">
          Keamanan Terjamin: Nilai parameter rahasia disensor secara penuh di sisi server dan tidak diekspos ke klien.
        </p>
        <div class="kv-list">
          ${Object.entries(env).map(([key, status]) => {
            const isSet = status === 'set';
            return `
              <div class="kv-item">
                <span class="kv-key" style="font-family:var(--font-mono);">${Utils.escapeHtml(key)}</span>
                <span class="kv-value">
                  ${isSet 
                    ? `<span class="badge badge-healthy">Set ✅</span>` 
                    : `<span class="badge badge-critical">Missing ❌</span>`}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    targetEl.innerHTML = html;
  },

  renderSettings(targetEl) {
    const isLocalSet = Auth.isLoggedIn();
    const tokenStatus = isLocalSet ? 'Set locally' : 'Not set locally';
    const serverEnabled = localStorage.getItem('server_dashboard_enabled') || 'Memuat...';

    let html = UI.renderSectionHeader('Settings Control');

    html += `
      <div class="panel">
        <h3 class="panel-title">⚙️ Konfigurasi Klien & Keamanan</h3>
        <div class="kv-list" style="margin-bottom:24px;">
          <div class="kv-item">
            <span class="kv-key">Dashboard Enabled (Server)</span>
            <span class="kv-value">${Utils.escapeHtml(serverEnabled)}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Auth Token Klien (Local)</span>
            <span class="kv-value" style="color: ${isLocalSet ? 'var(--color-success)' : 'var(--color-warning)'}">${tokenStatus}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Base API Endpoint</span>
            <span class="kv-value"><code>/api/dashboard</code></span>
          </div>
        </div>

        <button class="btn btn-danger" id="btn-clear-settings">Hapus Token Lokal</button>
      </div>

      <div class="panel">
        <h3 class="panel-title">📱 PWA Mobile Dashboard</h3>
        <div class="pwa-status-row" style="margin-bottom:16px;">
          <span id="settings-pwa-online">${navigator.onLine ? UI.renderBadge('online') : UI.renderBadge('offline')}</span>
          <span class="badge badge-info">Static-only cache</span>
          <span class="badge badge-warning">API data tidak di-cache</span>
        </div>
        <p class="text-muted" style="margin-bottom:16px;">Dashboard bisa di-install dari browser HP. Service worker hanya cache shell statis, bukan response API, backup JSON, atau header Authorization.</p>
        <div class="mobile-safe-actions" style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary hidden" id="btn-pwa-install">Install Dashboard</button>
          <button class="btn btn-outline" id="btn-pwa-clear-cache">Clear App Cache</button>
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">🛡️ Checklist Peluncuran Aman (Safe Production)</h3>
        <ul style="list-style:none; display:flex; flex-direction:column; gap:12px; font-size:14px; color:var(--text-secondary);">
          <li>
            <input type="checkbox" checked disabled> 
            <strong class="text-primary">DASHBOARD_ENABLED=true</strong> diset di env.
          </li>
          <li>
            <input type="checkbox" checked disabled>
            <strong class="text-primary">DASHBOARD_ADMIN_TOKEN</strong> tidak dibagikan dan di-rotate jika dicurigai bocor.
          </li>
          <li>
            <input type="checkbox" checked disabled>
            Seluruh data database dan API token disembunyikan menggunakan serializer server-side.
          </li>
          <li>
            <input type="checkbox" checked disabled>
            Koneksi production dilindungi protokol <strong class="text-primary">HTTPS Render SSL</strong>.
          </li>
        </ul>
      </div>
    `;

    targetEl.innerHTML = html;

    document.getElementById('btn-clear-settings').addEventListener('click', () => {
      Utils.confirmAction('Hapus Token Lokal', 'Ini akan menghapus DASHBOARD_ADMIN_TOKEN dari browser Anda. Lanjutkan?', () => {
        Auth.clearStoredToken();
        Utils.showToast('Token lokal dibersihkan!', 'success');
        window.location.reload();
      });
    });
    if (window.PWA) PWA.bindSettingsControls(document);
  }
};
