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

  renderStorageCards(storage = {}) {
    const warning = storage.postgresAvailable && storage.postgresTableReady && (storage.activeDriver || storage.storageDriver) === 'json'
      ? '<div class="alert alert-warning" style="margin-top:12px;">PostgreSQL connected, but storage is using JSON fallback.</div>'
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

  async renderMemory(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const loadData = async () => {
      const q = document.getElementById('search-memory-q').value.trim();
      const type = document.getElementById('filter-memory-type').value;
      const limit = document.getElementById('filter-memory-limit').value;
      const userId = document.getElementById('memory-user-id').value.trim();

      if (!userId) {
        Utils.showToast('Masukkan User ID terlebih dahulu', 'warning');
        return;
      }

      localStorage.setItem('last_user_id', userId);
      const contentListEl = document.getElementById('memory-list-container');
      contentListEl.innerHTML = UI.renderLoading('Memuat memory user...');

      const res = await Api.getUserMemories(userId, { q, type, limit });
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
            const res = await Api.updateMemory({ userId, memoryId, content });
            Utils.showToast(res.ok && res.data?.ok ? 'Memory updated.' : 'Gagal update memory.', res.ok && res.data?.ok ? 'success' : 'danger');
            await loadData();
            return;
          }
          if (action === 'archive') {
            const confirmationText = prompt('Ketik ARCHIVE untuk archive memory ini:');
            if (confirmationText !== 'ARCHIVE') return;
            const reason = prompt('Alasan archive (opsional):') || '';
            const res = await Api.archiveMemory({ userId, memoryId, confirm: true, confirmationText, reason });
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
      if (!userId) return;

      localStorage.setItem('last_user_id', userId);
      const container = document.getElementById('goals-list-container');
      container.innerHTML = UI.renderLoading('Memuat Goals...');

      const res = await Api.getUserGoals(userId);
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
            res = await Api.updateGoal({ userId, goalId, progress: Number(progress) });
          } else if (action === 'status') {
            const status = prompt('Status: active, paused, completed, archived, cancelled');
            if (!status) return;
            res = await Api.updateGoal({ userId, goalId, status });
          } else if (action === 'archive') {
            const confirmationText = prompt('Ketik ARCHIVE untuk archive goal ini:');
            if (confirmationText !== 'ARCHIVE') return;
            res = await Api.archiveGoal({ userId, goalId, confirm: true, confirmationText, reason: prompt('Alasan archive (opsional):') || '' });
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
      if (!userId) return;

      localStorage.setItem('last_user_id', userId);
      const container = document.getElementById('workflows-list-container');
      container.innerHTML = UI.renderLoading('Memuat Workflows...');

      const res = await Api.getUserWorkflows(userId);
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
            res = await Api.addWorkflowStep({ userId, workflowId, title });
          } else if (action === 'done-step') {
            const stepNumber = prompt('Step number yang selesai:');
            if (!stepNumber) return;
            res = await Api.markWorkflowStepDone({ userId, workflowId, stepNumber: Number(stepNumber) });
          } else if (action === 'archive') {
            const confirmationText = prompt('Ketik ARCHIVE untuk archive workflow ini:');
            if (confirmationText !== 'ARCHIVE') return;
            res = await Api.archiveWorkflow({ userId, workflowId, confirm: true, confirmationText, reason: prompt('Alasan archive (opsional):') || '' });
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
        <button class="btn btn-primary" id="btn-load-workflows" style="height:40px;">Load Workflows</button>
      </div>
      <div id="workflows-list-container">
        ${UI.renderEmptyState('🔄', 'Masukkan User ID', 'Muat workflows dengan memasukkan ID Telegram.')}
      </div>
    `;

    targetEl.innerHTML = html;
    document.getElementById('btn-load-workflows').addEventListener('click', loadData);
  },

  async renderInsights(targetEl) {
    let currentUserId = localStorage.getItem('last_user_id') || '123456789';

    const loadData = async () => {
      const userId = document.getElementById('insights-user-id').value.trim();
      if (!userId) return;

      localStorage.setItem('last_user_id', userId);
      const container = document.getElementById('insights-list-container');
      container.innerHTML = UI.renderLoading('Memuat Insights...');

      const res = await Api.getUserInsights(userId);
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
      const q = document.getElementById('search-graph-concept').value.trim();
      if (!userId) return;

      localStorage.setItem('last_user_id', userId);
      const container = document.getElementById('graph-content-container');
      container.innerHTML = UI.renderLoading('Memuat Knowledge Graph...');

      const res = q ? await Api.searchUserGraph(userId, q) : await Api.getUserGraph(userId);
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
        userId: document.getElementById('audit-user-id')?.value || ''
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
        ['Waktu', 'Action', 'Target', 'Status', 'User', 'Reason'],
        items.map(item => [
          Utils.escapeHtml(Utils.formatDate(item.createdAt)),
          `<code>${Utils.escapeHtml(item.action)}</code>`,
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
  }
};
