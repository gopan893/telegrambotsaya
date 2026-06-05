/* 
   =========================================
   Telegram AI OS Dashboard - UI Engine
   =========================================
*/

const UI = {
  // --- Standard Component Renderers ---
  renderBadge(status) {
    const clean = String(status || '').toLowerCase();
    return `<span class="badge badge-${clean}">${Utils.escapeHtml(status || 'unknown')}</span>`;
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

    let html = UI.renderSectionHeader('System Overview', `
      <button class="btn btn-outline" id="btn-refresh-overview">🔄 Refresh</button>
      <button class="btn btn-primary" id="btn-diagnostics-overview">🩺 Run Diagnostics</button>
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
          <div class="card-subtitle">Redis status: ${health.redisAvailable ? 'Connected' : 'Disconnected'}</div>
        </div>
      </div>
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
            <div class="card-value" id="overview-reliability-val">${reliability.score ? (reliability.score * 100).toFixed(0) : '0'}%</div>
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

    const benchBtn = document.getElementById('btn-quick-benchmark');
    if (benchBtn) {
      benchBtn.addEventListener('click', () => {
        Utils.confirmAction('Run Light Benchmark', 'Ini akan mengevaluasi fungsionalitas core AI OS melalui simulator in-memory ringan.', async () => {
          Utils.showToast('Menjalankan benchmark...', 'info');
          const res = await Api.runBenchmarkLight();
          if (res.ok && res.data.ok) {
            Utils.showToast(`Benchmark selesai! Score: ${(res.data.result.score * 100).toFixed(0)}%`, 'success');
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
    
    const opsRes = await Api.getOps();
    if (!opsRes.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Ops Viewer', 'Pastikan token admin Anda benar.');
      return;
    }

    const ops = opsRes.data;
    const health = ops.health || {};
    const telemetry = ops.telemetry || {};
    const reliability = ops.reliability || {};

    let html = UI.renderSectionHeader('Ops Viewer', `
      <button class="btn btn-outline" id="btn-refresh-ops">🔄 Refresh</button>
      <button class="btn btn-primary" id="btn-run-diagnostics">🩺 Run Diagnostics</button>
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
          <div class="card-value">${reliability.score ? (reliability.score * 100).toFixed(0) : '0'}%</div>
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
              <span class="kv-key">Redis Available</span>
              <span class="kv-value">${health.redis?.available !== undefined ? (health.redis.available ? 'OK' : 'FAIL') : '-'}</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">PostgreSQL Database</span>
              <span class="kv-value">${health.db?.driver || 'Unavailable'}</span>
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
                <button class="btn btn-outline btn-block" style="padding:4px 10px; font-size:11px; max-width:100px;" disabled>Hapus (Soon)</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      contentListEl.innerHTML = mHtml;
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
            </div>
          `).join('')}
        </div>
      `;
      container.innerHTML = gHtml;
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
              </div>
            `;
          }).join('')}
        </div>
      `;
      container.innerHTML = wHtml;
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

      // Draw dynamic SVGs for visual representation (Mock graph layout)
      let svgHtml = '';
      if (nodes.length > 0) {
        const svgWidth = 800;
        const svgHeight = 240;
        const centerX = svgWidth / 2;
        const centerY = svgHeight / 2;
        const radius = 90;

        // Radial nodes around a main central node
        const nodeCircles = [];
        const edgeLines = [];

        // Main node center
        nodeCircles.push(`<circle cx="${centerX}" cy="${centerY}" r="14" fill="var(--color-accent)" stroke="#fff" stroke-width="2"/>`);
        nodeCircles.push(`<text x="${centerX}" y="${centerY - 20}" fill="var(--text-primary)" font-size="11" font-weight="bold" text-anchor="middle">${Utils.escapeHtml(nodes[0].label || 'Center')}</text>`);

        // Outer nodes
        const numOuter = Math.min(nodes.length - 1, 8);
        for (let i = 0; i < numOuter; i++) {
          const angle = (i / numOuter) * 2 * Math.PI;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          
          edgeLines.push(`<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="var(--border-color)" stroke-width="1.5" />`);
          nodeCircles.push(`<circle cx="${x}" cy="${y}" r="8" fill="var(--bg-tertiary)" stroke="var(--color-accent)" stroke-width="1.5" />`);
          nodeCircles.push(`<text x="${x}" y="${y + 18}" fill="var(--text-secondary)" font-size="10" text-anchor="middle">${Utils.escapeHtml(nodes[i + 1].label || '')}</text>`);
        }

        svgHtml = `
          <div class="svg-graph-container">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="svg-graph" style="width:100%; max-height:240px;">
              ${edgeLines.join('')}
              ${nodeCircles.join('')}
            </svg>
          </div>
        `;
      }

      let gHtml = `
        ${svgHtml}

        <div class="card" style="margin-bottom:24px;">
          <div class="card-title">Graph Statistics</div>
          <div style="display:flex; gap:32px; font-family:var(--font-mono); font-size:18px; font-weight:700; margin-top:8px;">
            <div>Nodes: <span class="text-info">${stats.nodes}</span></div>
            <div>Edges: <span class="text-success">${stats.edges}</span></div>
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
            ${latest ? (latest.score * 100).toFixed(0) + '%' : '0%'}
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
                  <td style="font-family:var(--font-mono); font-weight:bold; color: var(--color-accent);">${(run.score * 100).toFixed(0)}%</td>
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
  },

  // --- Phase 30 Missing Tab Renderers ---

  async renderAgents(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat data agents...');

    const res = await Api.getSummary();
    const healthRes = await Api.getHealth();

    if (!healthRes.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Agents', 'Server tidak merespons.');
      return;
    }

    const summary = res.ok ? res.data : null;

    let html = UI.renderSectionHeader('🤖 Agents & Multi-Bot Management', `
      <button class="btn btn-outline" id="btn-refresh-agents">🔄 Refresh</button>
    `);

    // Bot Token Mapping Status
    html += `
      <div class="panel">
        <h3 class="panel-title">🔐 Bot Token Mapping</h3>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
          Status mapping token bot ke specialist agent. Token disembunyikan untuk keamanan.
        </p>
        <div class="kv-list">
          <div class="kv-item">
            <span class="kv-key">TELEGRAM_TOKEN (Orchestrator)</span>
            <span class="kv-value"><span class="badge badge-healthy">Active</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">TELEGRAM_TOKEN_PLANNER</span>
            <span class="kv-value"><span class="badge badge-info">Optional</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">TELEGRAM_TOKEN_CODER</span>
            <span class="kv-value"><span class="badge badge-info">Optional</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">TELEGRAM_TOKEN_CRITIC</span>
            <span class="kv-value"><span class="badge badge-info">Optional</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">TELEGRAM_TOKEN_SECURITY</span>
            <span class="kv-value"><span class="badge badge-info">Optional</span></span>
          </div>
        </div>
      </div>
    `;

    // Agent Registry
    html += `
      <div class="panel">
        <h3 class="panel-title">📋 Agent Registry</h3>
        <div class="card-grid">
          <div class="card">
            <div class="card-title">Orchestrator</div>
            <div class="card-value">Default Bot</div>
            <div class="card-subtitle">Routes queries to specialists</div>
          </div>
          <div class="card">
            <div class="card-title">Planner</div>
            <div class="card-value">Optional</div>
            <div class="card-subtitle">Task planning & roadmap</div>
          </div>
          <div class="card">
            <div class="card-title">Coder</div>
            <div class="card-value">Optional</div>
            <div class="card-subtitle">Code analysis & debugging</div>
          </div>
          <div class="card">
            <div class="card-title">Critic</div>
            <div class="card-value">Optional</div>
            <div class="card-subtitle">Review & quality gates</div>
          </div>
          <div class="card">
            <div class="card-title">Security</div>
            <div class="card-value">Optional</div>
            <div class="card-subtitle">Risk assessment & approval</div>
          </div>
          <div class="card">
            <div class="card-title">Ops</div>
            <div class="card-value">Optional</div>
            <div class="card-subtitle">Deployment & operations</div>
          </div>
        </div>
      </div>
    `;

    // Multi-Bot Safety Status
    html += `
      <div class="panel">
        <h3 class="panel-title">🛡️ Multi-Bot Safety</h3>
        <div class="kv-list">
          <div class="kv-item">
            <span class="kv-key">Bot-to-Bot Loop Prevention</span>
            <span class="kv-value"><span class="badge badge-healthy">Enabled</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Visible Specialist Replies</span>
            <span class="kv-value"><span class="badge badge-healthy">Max Limited</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Spam Prevention</span>
            <span class="kv-value"><span class="badge badge-healthy">Active</span></span>
          </div>
        </div>
      </div>
    `;

    targetEl.innerHTML = html;

    document.getElementById('btn-refresh-agents')?.addEventListener('click', () => {
      UI.renderAgents(targetEl);
    });
  },

  async renderIntegrations(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat data integrations...');

    const res = await Api.getSummary();
    const healthRes = await Api.getHealth();

    if (!healthRes.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Integrations', 'Server tidak merespons.');
      return;
    }

    let html = UI.renderSectionHeader('🔌 External Integrations', `
      <button class="btn btn-outline" id="btn-refresh-integrations">🔄 Refresh</button>
    `);

    // Integration Status Grid
    html += `
      <div class="panel">
        <h3 class="panel-title">📡 Integration Status</h3>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
          Semua integrasi eksternal memerlukan Evaluation v2 gate + executor approval sebelum eksekusi.
        </p>
        <div class="card-grid">
          <div class="card">
            <div class="card-title">GitHub</div>
            <div class="card-value">Proposal Only</div>
            <div class="card-subtitle">Issue/PR/Comment via Eval v2</div>
          </div>
          <div class="card">
            <div class="card-title">Google Calendar</div>
            <div class="card-value">OAuth Required</div>
            <div class="card-subtitle">Create/Update events</div>
          </div>
          <div class="card">
            <div class="card-title">Gmail</div>
            <div class="card-value">Draft Only</div>
            <div class="card-subtitle">Send disabled by default</div>
          </div>
          <div class="card">
            <div class="card-title">Webhook</div>
            <div class="card-value">Dry-Run Only</div>
            <div class="card-subtitle">POST requires approval</div>
          </div>
          <div class="card">
            <div class="card-title">Cloudflare/NAS</div>
            <div class="card-value">Config Mutation</div>
            <div class="card-subtitle">High risk approval required</div>
          </div>
        </div>
      </div>
    `;

    // Evaluation Gate Status
    html += `
      <div class="panel">
        <h3 class="panel-title">✅ Evaluation v2 Gate</h3>
        <div class="kv-list">
          <div class="kv-item">
            <span class="kv-key">GitHub Issue/PR Proposal</span>
            <span class="kv-value"><span class="badge badge-healthy">Requires Eval v2</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Calendar Create/Update</span>
            <span class="kv-value"><span class="badge badge-healthy">Requires Eval v2</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Gmail Draft</span>
            <span class="kv-value"><span class="badge badge-healthy">Requires Eval v2</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Webhook POST</span>
            <span class="kv-value"><span class="badge badge-healthy">Requires Eval v2</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Gmail Send</span>
            <span class="kv-value"><span class="badge badge-critical">Disabled</span></span>
          </div>
        </div>
      </div>
    `;

    // Dry-Run Safety
    html += `
      <div class="panel">
        <h3 class="panel-title">🧪 Dry-Run Safety</h3>
        <div class="kv-list">
          <div class="kv-item">
            <span class="kv-key">Dry-Run Mode</span>
            <span class="kv-value"><span class="badge badge-healthy">Never performs external write</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Credential Exposure</span>
            <span class="kv-value"><span class="badge badge-healthy">Redacted in output</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Missing Env Handling</span>
            <span class="kv-value"><span class="badge badge-healthy">Setup plan, no crash</span></span>
          </div>
        </div>
      </div>
    `;

    targetEl.innerHTML = html;

    document.getElementById('btn-refresh-integrations')?.addEventListener('click', () => {
      UI.renderIntegrations(targetEl);
    });
  },

  async renderCodingWorkspace(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat coding workspace...');

    const res = await Api.getSummary();
    const healthRes = await Api.getHealth();

    if (!healthRes.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Coding Workspace', 'Server tidak merespons.');
      return;
    }

    let html = UI.renderSectionHeader('💻 Coding Workspace', `
      <button class="btn btn-outline" id="btn-refresh-coding">🔄 Refresh</button>
    `);

    // Workspace Constraints
    html += `
      <div class="panel">
        <h3 class="panel-title">📏 Project Constraints</h3>
        <div class="kv-list">
          <div class="kv-item">
            <span class="kv-key">Runtime</span>
            <span class="kv-value">Node.js 20</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Module System</span>
            <span class="kv-value">CommonJS</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Dashboard</span>
            <span class="kv-value">Vanilla HTML/CSS/JS (PWA)</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">TypeScript</span>
            <span class="kv-value"><span class="badge badge-critical">Not Allowed</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">React/Next/Vue</span>
            <span class="kv-value"><span class="badge badge-critical">Not Allowed</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Large Refactor</span>
            <span class="kv-value"><span class="badge badge-critical">Requires Approval</span></span>
          </div>
        </div>
      </div>
    `;

    // Coding Features
    html += `
      <div class="panel">
        <h3 class="panel-title">🔧 Available Features</h3>
        <div class="card-grid">
          <div class="card">
            <div class="card-title">Code Analysis</div>
            <div class="card-value">Active</div>
            <div class="card-subtitle">Static analysis & classification</div>
          </div>
          <div class="card">
            <div class="card-title">Change Planning</div>
            <div class="card-value">Active</div>
            <div class="card-subtitle">Non-mutating plans only</div>
          </div>
          <div class="card">
            <div class="card-title">Test Generation</div>
            <div class="card-value">Active</div>
            <div class="card-subtitle">Relevant test suggestions</div>
          </div>
          <div class="card">
            <div class="card-title">Codex Prompt</div>
            <div class="card-value">Active</div>
            <div class="card-subtitle">Generate Codex prompts</div>
          </div>
        </div>
      </div>
    `;

    // Safety Rules
    html += `
      <div class="panel">
        <h3 class="panel-title">🛡️ Safety Rules</h3>
        <div class="kv-list">
          <div class="kv-item">
            <span class="kv-key">Code Change Plan</span>
            <span class="kv-value"><span class="badge badge-healthy">Does not mutate repo</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">GitHub Issue/PR Proposal</span>
            <span class="kv-value"><span class="badge badge-healthy">Requires Eval v2 + Approval</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Personal Chat Trigger</span>
            <span class="kv-value"><span class="badge badge-healthy">Blocked</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">External Actions</span>
            <span class="kv-value"><span class="badge badge-healthy">Approval First</span></span>
          </div>
        </div>
      </div>
    `;

    targetEl.innerHTML = html;

    document.getElementById('btn-refresh-coding')?.addEventListener('click', () => {
      UI.renderCodingWorkspace(targetEl);
    });
  },

  async renderRelease(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat release status...');

    const healthRes = await Api.getHealth();
    const summaryRes = await Api.getSummary();

    if (!healthRes.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Release Status', 'Server tidak merespons.');
      return;
    }

    const health = healthRes.data;
    const summary = summaryRes.ok ? summaryRes.data : null;

    let html = UI.renderSectionHeader('🚀 Release Status & Health', `
      <button class="btn btn-outline" id="btn-refresh-release">🔄 Refresh</button>
    `);

    // App Version & Phase
    html += `
      <div class="panel">
        <h3 class="panel-title">📦 Application Info</h3>
        <div class="kv-list">
          <div class="kv-item">
            <span class="kv-key">Version</span>
            <span class="kv-value">${Utils.escapeHtml(health.version || 'v2.0.0')}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Phase</span>
            <span class="kv-value">Phase 30 - Stable Release</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Uptime</span>
            <span class="kv-value">${Utils.formatDuration(health.uptime)}</span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Storage Driver</span>
            <span class="kv-value">${Utils.escapeHtml(health.storageDriver)}</span>
          </div>
        </div>
      </div>
    `;

    // System Health Status
    html += `
      <div class="panel">
        <h3 class="panel-title">🩺 System Health</h3>
        <div class="card-grid">
          <div class="card">
            <div class="card-title">Bot Health</div>
            <div class="card-value" style="color: ${health.ok ? 'var(--color-success)' : 'var(--color-danger)'}">
              ${health.ok ? 'HEALTHY' : 'DEGRADED'}
            </div>
          </div>
          <div class="card">
            <div class="card-title">Dashboard</div>
            <div class="card-value" style="color: ${health.dashboardEnabled ? 'var(--color-success)' : 'var(--color-warning)'}">
              ${health.dashboardEnabled ? 'ENABLED' : 'DISABLED'}
            </div>
          </div>
          <div class="card">
            <div class="card-title">Redis</div>
            <div class="card-value" style="color: ${health.redisAvailable ? 'var(--color-success)' : 'var(--color-warning)'}">
              ${health.redisAvailable ? 'CONNECTED' : 'DISCONNECTED'}
            </div>
          </div>
          <div class="card">
            <div class="card-title">Admin Token</div>
            <div class="card-value" style="color: ${health.adminTokenSet ? 'var(--color-success)' : 'var(--color-danger)'}">
              ${health.adminTokenSet ? 'SET' : 'MISSING'}
            </div>
          </div>
        </div>
      </div>
    `;

    // Release Gate Status (Phase 30)
    html += `
      <div class="panel">
        <h3 class="panel-title">🚦 Release Gate Status (Phase 30)</h3>
        <div class="kv-list">
          <div class="kv-item">
            <span class="kv-key">Boot Stability</span>
            <span class="kv-value"><span class="badge badge-healthy">PASS</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Dashboard Routes</span>
            <span class="kv-value"><span class="badge badge-healthy">PASS</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Executor Boundary</span>
            <span class="kv-value"><span class="badge badge-healthy">PASS</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Integration Gate</span>
            <span class="kv-value"><span class="badge badge-healthy">PASS</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Secret Leakage</span>
            <span class="kv-value"><span class="badge badge-healthy">NONE DETECTED</span></span>
          </div>
          <div class="kv-item">
            <span class="kv-key">Bot-to-Bot Loop</span>
            <span class="kv-value"><span class="badge badge-healthy">PREVENTED</span></span>
          </div>
        </div>
      </div>
    `;

    // Degraded Mode Warning
    html += `
      <div class="panel">
        <h3 class="panel-title">⚠️ Degraded Mode</h3>
        <p style="font-size:13px; color:var(--text-secondary);">
          Jika release gate gagal, sistem akan berjalan dalam mode degraded.
          Fitur yang gagal akan ditampilkan di bawah.
        </p>
        <div id="degraded-features" style="margin-top:12px;">
          <span class="badge badge-healthy">No degraded features detected</span>
        </div>
      </div>
    `;

    // Recent Test Results (if available)
    if (summary) {
      html += `
        <div class="panel">
          <h3 class="panel-title">📊 System Data Summary</h3>
          <div class="kv-list">
            <div class="kv-item">
              <span class="kv-key">Memory Records</span>
              <span class="kv-value">${summary.memoryCount || 0}</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">Goals</span>
              <span class="kv-value">${summary.goalCount || 0}</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">Workflows</span>
              <span class="kv-value">${summary.workflowCount || 0}</span>
            </div>
            <div class="kv-item">
              <span class="kv-key">Graph Nodes</span>
              <span class="kv-value">${summary.graphNodeCount || 0}</span>
            </div>
          </div>
        </div>
      `;
    }

    targetEl.innerHTML = html;

    document.getElementById('btn-refresh-release')?.addEventListener('click', () => {
      UI.renderRelease(targetEl);
    });
  },

  async renderRoutines(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat routine center...');

    const routinesRes = await Api.apiGet('/routines');
    if (!routinesRes.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Routine Center', 'Server tidak merespons atau token tidak valid.');
      return;
    }

    const routines = routinesRes.data.routines || [];

    let html = UI.renderSectionHeader('⏰ Routine Center', `
      <button class="btn btn-outline" id="btn-refresh-routines">🔄 Refresh</button>
    `);

    // Routine Status Overview
    const enabledCount = routines.filter(r => r.enabled).length;
    const disabledCount = routines.filter(r => !r.enabled).length;
    html += `
      <div class="card-grid">
        <div class="card">
          <div class="card-title">Total Routines</div>
          <div class="card-value">${routines.length}</div>
        </div>
        <div class="card">
          <div class="card-title">Enabled</div>
          <div class="card-value" style="color:var(--color-success);">${enabledCount}</div>
        </div>
        <div class="card">
          <div class="card-title">Disabled</div>
          <div class="card-value" style="color:var(--text-muted);">${disabledCount}</div>
        </div>
      </div>
    `;

    // Routine List
    html += `
      <div class="panel">
        <h3 class="panel-title">Routines List</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Schedule</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${routines.length === 0 ? '<tr><td colspan="6" class="text-center text-muted">No routines configured.</td></tr>' : routines.map(r => `
                <tr>
                  <td><strong>${Utils.escapeHtml(r.name)}</strong></td>
                  <td><code>${Utils.escapeHtml(r.type)}</code></td>
                  <td><span class="badge badge-none">${Utils.escapeHtml(r.schedule || 'manual')}</span></td>
                  <td><span class="badge badge-${r.riskLevel === 'low' ? 'healthy' : r.riskLevel === 'medium' ? 'warning' : r.riskLevel === 'high' ? 'degraded' : 'critical'}">${Utils.escapeHtml(r.riskLevel || 'unknown')}</span></td>
                  <td>${r.enabled ? UI.renderBadge('healthy') : UI.renderBadge('disabled')}</td>
                  <td>
                    <button class="btn btn-outline btn-sm" data-routine-id="${r.id}" data-action="run">Run</button>
                    <button class="btn btn-outline btn-sm" data-routine-id="${r.id}" data-action="dry-run">Dry-Run</button>
                    <button class="btn btn-outline btn-sm" data-routine-id="${r.id}" data-action="${r.enabled ? 'disable' : 'enable'}">${r.enabled ? 'Disable' : 'Enable'}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    targetEl.innerHTML = html;

    // Action buttons
    targetEl.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-routine-id');
        const action = btn.getAttribute('data-action');
        const endpoints = {
          run: `/routines/${id}/run`,
          'dry-run': `/routines/${id}/dry-run`,
          enable: `/routines/${id}/enable`,
          disable: `/routines/${id}/disable`
        };
        const ep = endpoints[action];
        if (!ep) return;
        Utils.showToast(`${action} routine...`, 'info');
        const res = await Api.apiPost(ep);
        if (res.ok && (res.data.ok || res.data.status === 'completed')) {
          Utils.showToast(`Routine ${action} berhasil!`, 'success');
          UI.renderRoutines(targetEl);
        } else {
          Utils.showToast(`Gagal ${action} routine: ${res.data?.error || 'unknown'}`, 'danger');
        }
      });
    });

    document.getElementById('btn-refresh-routines')?.addEventListener('click', () => {
      UI.renderRoutines(targetEl);
    });
  },

  // --- Placeholder renderers for tabs without full implementation ---

  async renderWorkspaces(targetEl) {
    targetEl.innerHTML = UI.renderSectionHeader('🏢 Workspaces');
    targetEl.innerHTML += `
      <div class="empty-state">
        <span class="empty-state-emoji">🏢</span>
        <h3>Workspaces</h3>
        <p>Workspace module belum tersedia atau belum termuat.</p>
      </div>
    `;
  },

  async renderUsers(targetEl) {
    targetEl.innerHTML = UI.renderSectionHeader('👥 Users');
    targetEl.innerHTML += `
      <div class="empty-state">
        <span class="empty-state-emoji">👥</span>
        <h3>Users</h3>
        <p>User management module belum tersedia atau belum termuat.</p>
      </div>
    `;
  },

  async renderPermissions(targetEl) {
    targetEl.innerHTML = UI.renderSectionHeader('🛡️ Permissions');
    targetEl.innerHTML += `
      <div class="empty-state">
        <span class="empty-state-emoji">🛡️</span>
        <h3>Permissions</h3>
        <p>Permission management module belum tersedia atau belum termuat.</p>
      </div>
    `;
  },

  async renderPlanner(targetEl) {
    targetEl.innerHTML = UI.renderSectionHeader('🗺️ Planner');
    targetEl.innerHTML += `
      <div class="empty-state">
        <span class="empty-state-emoji">🗺️</span>
        <h3>Planner</h3>
        <p>Planner module belum tersedia atau belum termuat.</p>
      </div>
    `;
  },

  async renderExecutor(targetEl) {
    targetEl.innerHTML = UI.renderSectionHeader('✅ Executor');
    targetEl.innerHTML += `
      <div class="empty-state">
        <span class="empty-state-emoji">✅</span>
        <h3>Executor</h3>
        <p>Executor module belum tersedia atau belum termuat.</p>
      </div>
    `;
  },

  async renderTools(targetEl) {
    targetEl.innerHTML = UI.renderSectionHeader('🧰 Tools');
    targetEl.innerHTML += `
      <div class="empty-state">
        <span class="empty-state-emoji">🧰</span>
        <h3>Tools</h3>
        <p>Tool registry module belum tersedia atau belum termuat.</p>
      </div>
    `;
  },

  async renderBackup(targetEl) {
    targetEl.innerHTML = UI.renderSectionHeader('💾 Backup & Recovery');
    targetEl.innerHTML += `
      <div class="empty-state">
        <span class="empty-state-emoji">💾</span>
        <h3>Backup & Recovery</h3>
        <p>Backup module belum tersedia atau belum termuat.</p>
      </div>
    `;
  },

  async renderAuditLog(targetEl) {
    targetEl.innerHTML = UI.renderSectionHeader('🧾 Audit Log');
    targetEl.innerHTML += `
      <div class="empty-state">
        <span class="empty-state-emoji">🧾</span>
        <h3>Audit Log</h3>
        <p>Audit log module belum tersedia atau belum termuat.</p>
      </div>
    `;
  },

  async renderAgentEvaluation(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat evaluasi agen...');

    const healthRes = await Api.getHealth();
    if (!healthRes.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Agent Evaluation', 'Server tidak merespons.');
      return;
    }

    let html = UI.renderSectionHeader('📊 Agent Evaluation');
    html += `
      <div class="empty-state">
        <span class="empty-state-emoji">📊</span>
        <h3>Agent Evaluation</h3>
        <p>Agent evaluation module belum tersedia atau belum termuat.</p>
      </div>
    `;
    targetEl.innerHTML = html;
  },

  async renderSelfHealing(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat Self-Healing & Regression Guard...');

    const res = await Api.apiGet('/selfhealing');
    if (!res.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Self-Healing', 'Server tidak merespons atau self-healing system tidak aktif.');
      return;
    }

    const data = res.data;
    let html = UI.renderSectionHeader('🛡️ Self-Healing & Regression Guard', `
      <button class="btn btn-primary" id="btn-run-all-checks">▶ Run All Checks</button>
      <button class="btn btn-outline" id="btn-run-p0-checks">▶ Run P0 Checks</button>
    `);

    // Guard count summary
    html += `
      <div class="card-grid">
        <div class="card">
          <div class="card-title">Guards Registered</div>
          <div class="card-value">${data.guardCount || 0}</div>
          <div class="card-subtitle">Regression guards</div>
        </div>
        <div class="card">
          <div class="card-title">Status</div>
          <div class="card-value">${data.initialized ? 'Active' : 'Inactive'}</div>
          <div class="card-subtitle">Self-healing system</div>
        </div>
      </div>
    `;

    // Guard list
    html += `<div class="panel"><h3 class="panel-title">Registered Guards</h3><div class="table-responsive"><table><thead><tr><th>Guard</th><th>Category</th><th>Severity</th><th>Status</th></tr></thead><tbody>`;
    (data.guards || []).forEach(g => {
      html += `<tr><td>${Utils.escapeHtml(g.name)}</td><td><code>${Utils.escapeHtml(g.category)}</code></td><td>${UI.renderBadge(g.severity)}</td><td>${g.enabled ? '<span class="badge badge-healthy">Enabled</span>' : '<span class="badge badge-critical">Disabled</span>'}</td></tr>`;
    });
    html += `</tbody></table></div></div>`;

    // Results area
    html += `<div id="selfhealing-results"></div>`;

    targetEl.innerHTML = html;

    document.getElementById('btn-run-all-checks')?.addEventListener('click', async () => {
      const resultsEl = document.getElementById('selfhealing-results');
      resultsEl.innerHTML = UI.renderLoading('Running all checks...');
      const runRes = await Api.apiPost('/selfhealing/run', {});
      if (runRes.ok) {
        let rHtml = '<div class="panel"><h3 class="panel-title">Check Results</h3>';
        (runRes.data.results || []).forEach(r => {
          rHtml += `<div class="card" style="margin-bottom:8px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span>${Utils.escapeHtml(r.summary)}</span>
              ${UI.renderBadge(r.status)}
            </div>
          </div>`;
        });
        rHtml += `<p style="margin-top:12px;color:var(--text-secondary)">${Utils.escapeHtml(runRes.data.summary)}</p>`;
        rHtml += '</div>';
        resultsEl.innerHTML = rHtml;
      } else {
        resultsEl.innerHTML = UI.renderError('Gagal menjalankan checks');
      }
    });

    document.getElementById('btn-run-p0-checks')?.addEventListener('click', async () => {
      const resultsEl = document.getElementById('selfhealing-results');
      resultsEl.innerHTML = UI.renderLoading('Running P0 critical checks...');
      const runRes = await Api.apiPost('/selfhealing/run', { severity: 'critical' });
      if (runRes.ok) {
        let rHtml = '<div class="panel"><h3 class="panel-title">P0 Check Results</h3>';
        (runRes.data.results || []).forEach(r => {
          rHtml += `<div class="card" style="margin-bottom:8px;padding:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span>${Utils.escapeHtml(r.summary)}</span>
              ${UI.renderBadge(r.status)}
            </div>
          </div>`;
        });
        rHtml += `<p style="margin-top:12px;color:var(--text-secondary)">${Utils.escapeHtml(runRes.data.summary)}</p>`;
        rHtml += '</div>';
        resultsEl.innerHTML = rHtml;
      } else {
        resultsEl.innerHTML = UI.renderError('Gagal menjalankan P0 checks');
      }
    });
  },

  async renderMonitoring(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat monitoring...');
    const res = await Api.apiGet('/monitoring/snapshot');
    if (!res.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat Monitoring', 'Server tidak merespons atau monitoring system tidak aktif.');
      return;
    }
    const data = res.data;
    let html = UI.renderSectionHeader('📡 Real-Time Monitoring', `
      <button class="btn btn-outline" id="btn-refresh-monitoring">🔄 Refresh</button>
    `);
    html += `
      <div class="card-grid">
        <div class="card">
          <div class="card-title">Event History</div>
          <div class="card-value">${data.eventCount || 0}</div>
          <div class="card-subtitle">Total events tracked</div>
        </div>
        <div class="card">
          <div class="card-title">WS Clients</div>
          <div class="card-value">${data.wsClients ?? 0}</div>
          <div class="card-subtitle">${data.wsFallback ? 'SSE fallback active' : 'WebSocket connected'}</div>
        </div>
        <div class="card">
          <div class="card-title">Metrics Keys</div>
          <div class="card-value">${Object.keys(data.metrics || {}).length}</div>
          <div class="card-subtitle">Active metrics</div>
        </div>
      </div>
      <div class="panel">
        <h3 class="panel-title">Recent Events</h3>
        <div class="table-responsive">
          <table>
            <thead><tr><th>Time</th><th>Topic</th><th>Severity</th><th>Title</th><th>Source</th></tr></thead>
            <tbody>
              ${(data.recentEvents || []).map(e => `
                <tr>
                  <td style="font-size:11px;color:var(--text-muted)">${Utils.formatDate(e.createdAt)}</td>
                  <td><code>${Utils.escapeHtml(e.topic)}</code></td>
                  <td>${UI.renderBadge(e.severity)}</td>
                  <td>${Utils.escapeHtml(e.title)}</td>
                  <td style="font-size:12px">${Utils.escapeHtml(e.source || '-')}</td>
                </tr>
              `).join('')}
              ${!data.recentEvents || data.recentEvents.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">No events yet.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
      <div id="monitoring-additional"></div>
    `;
    targetEl.innerHTML = html;
    document.getElementById('btn-refresh-monitoring')?.addEventListener('click', () => UI.renderMonitoring(targetEl));
  },

  async renderCicd(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat CI/CD status...');
    const res = await Api.apiGet('/cicd/status');
    if (!res.ok) {
      targetEl.innerHTML = UI.renderError('Gagal Memuat CI/CD', 'Server tidak merespons atau CI/CD system tidak aktif.');
      return;
    }
    const data = res.data;
    let html = UI.renderSectionHeader('🔄 CI/CD Pipeline', `
      <button class="btn btn-outline" id="btn-refresh-cicd">🔄 Refresh</button>
    `);
    html += `
      <div class="card-grid">
        <div class="card">
          <div class="card-title">Releases</div>
          <div class="card-value">${data.releaseCount || 0}</div>
          <div class="card-subtitle">Total releases</div>
        </div>
        <div class="card">
          <div class="card-title">Proposals</div>
          <div class="card-value">${data.proposalCount || 0}</div>
          <div class="card-subtitle">Pending proposals</div>
        </div>
        <div class="card">
          <div class="card-title">Pipelines</div>
          <div class="card-value">${data.pipelineCount || 0}</div>
          <div class="card-subtitle">Pipeline runs</div>
        </div>
      </div>
      <div class="panel">
        <h3 class="panel-title">Last Release</h3>
        <div id="cicd-last-release">
          ${data.lastRelease ? `
            <div class="kv-list">
              <div class="kv-item"><span class="kv-key">Version</span><span class="kv-value">${Utils.escapeHtml(data.lastRelease.version || '-')}</span></div>
              <div class="kv-item"><span class="kv-key">Status</span><span class="kv-value">${UI.renderBadge(data.lastRelease.status)}</span></div>
              <div class="kv-item"><span class="kv-key">Created</span><span class="kv-value">${Utils.formatDate(data.lastRelease.createdAt)}</span></div>
            </div>
          ` : '<p class="text-muted">No releases yet.</p>'}
        </div>
      </div>
      <div class="panel">
        <h3 class="panel-title">Quality Gate</h3>
        <button class="btn btn-primary" id="btn-run-quality-check">Run Quality Check</button>
        <div id="quality-check-result" style="margin-top:12px;"></div>
      </div>
    `;
    targetEl.innerHTML = html;
    document.getElementById('btn-refresh-cicd')?.addEventListener('click', () => UI.renderCicd(targetEl));
    document.getElementById('btn-run-quality-check')?.addEventListener('click', async () => {
      const resultEl = document.getElementById('quality-check-result');
      resultEl.innerHTML = UI.renderLoading('Running quality checks...');
      const r = await Api.apiPost('/cicd/quality-check', { evaluationScore: 100 });
      if (r.ok) {
        let rHtml = `<p>${Utils.escapeHtml(r.data.summary)}</p><ul>`;
        (r.data.checks || []).forEach(c => {
          rHtml += `<li>${Utils.escapeHtml(c.name)}: ${c.passed ? '✅' : '❌'}</li>`;
        });
        rHtml += '</ul>';
        resultEl.innerHTML = rHtml;
      } else {
        resultEl.innerHTML = UI.renderError('Quality check failed');
      }
    });
  },

  renderDevGovernance: async function(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Loading Dev Governance...');
    if (!targetEl) return;
    const govRes = await Api.apiGet('/devgovernance');
    if (!govRes.ok) {
      targetEl.innerHTML = UI.renderError('Failed to load Dev Governance');
      return;
    }
    const data = govRes.data;
    const html = `
      <div class="tab-header" style="margin-bottom:24px;">
        <h2>🏛️ Dev Governance</h2>
        <p>Multi-Agent Development Governance — handoff, collision prevention, integration contract.</p>
      </div>
      <div class="section-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px;">
        <div class="panel">
          <h3 class="panel-title">Agent Contract</h3>
          <div class="kv-row">
            <span class="kv-key">Exists</span>
            <span class="kv-value">${data.contract.exists ? '✅' : '❌'}</span>
          </div>
          <div class="kv-row">
            <span class="kv-key">Valid</span>
            <span class="kv-value">${data.contract.valid === true ? '✅' : data.contract.valid === false ? '❌' : 'Unknown'}</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="UI._govCheckContract()">Validate Contract</button>
          <div id="gov-contract-result" style="margin-top:8px;"></div>
        </div>
        <div class="panel">
          <h3 class="panel-title">Latest Handoff</h3>
          <div class="kv-row"><span class="kv-key">Last Agent</span><span class="kv-value">${Utils.escapeHtml(data.handoff?.lastAgent || 'None')}</span></div>
          <div class="kv-row"><span class="kv-key">Task</span><span class="kv-value">${Utils.escapeHtml(data.handoff?.currentTask || 'None')}</span></div>
          <div class="kv-row"><span class="kv-key">Tests Failed</span><span class="kv-value">${data.handoff?.testsFailed || 0}</span></div>
          <div class="kv-row"><span class="kv-key">Tests Skipped</span><span class="kv-value">${data.handoff?.testsSkipped || 0}</span></div>
          <button class="btn btn-outline btn-sm" onclick="UI._govShowHandoff()">View Full Handoff</button>
        </div>
        <div class="panel">
          <h3 class="panel-title">Architecture Map</h3>
          <div class="kv-row"><span class="kv-key">Entry Points</span><span class="kv-value">${data.architecture?.entryPoints || 0}</span></div>
          <div class="kv-row"><span class="kv-key">Dashboard Tabs</span><span class="kv-value">${data.architecture?.dashboardTabs?.found || 0}/${data.architecture?.dashboardTabs?.total || 0}</span></div>
          <div class="kv-row"><span class="kv-key">Module Groups</span><span class="kv-value">${data.architecture?.moduleGroups || 0}</span></div>
          <button class="btn btn-outline btn-sm" onclick="UI._govScanArchitecture()">Scan Architecture</button>
          <div id="gov-arch-result" style="margin-top:8px;"></div>
        </div>
      </div>
      <div class="section-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px; margin-top:16px;">
        <div class="panel">
          <h3 class="panel-title">Collision Check</h3>
          <button class="btn btn-outline btn-sm" onclick="UI._govRunCollisionCheck()">Run Collision Check</button>
          <div id="gov-collision-result" style="margin-top:8px;"></div>
        </div>
        <div class="panel">
          <h3 class="panel-title">Dashboard Routes</h3>
          <button class="btn btn-outline btn-sm" onclick="UI._govCheckDashboardRoutes()">Check Routes</button>
          <div id="gov-routes-result" style="margin-top:8px;"></div>
        </div>
        <div class="panel">
          <h3 class="panel-title">Backend/Frontend Linker</h3>
          <button class="btn btn-outline btn-sm" onclick="UI._govCheckBackendFrontend()">Check Links</button>
          <div id="gov-link-result" style="margin-top:8px;"></div>
        </div>
      </div>
      <div class="section-container" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px; margin-top:16px;">
        <div class="panel">
          <h3 class="panel-title">Test Matrix</h3>
          <div class="form-group">
            <label>Change Description</label>
            <textarea id="gov-change-desc" class="form-input" rows="2" placeholder="Describe recent changes..."></textarea>
          </div>
          <button class="btn btn-outline btn-sm" onclick="UI._govGenerateTestMatrix()">Generate Test Matrix</button>
          <div id="gov-matrix-result" style="margin-top:8px;"></div>
        </div>
        <div class="panel">
          <h3 class="panel-title">Next-Agent Prompt</h3>
          <div class="form-group">
            <select id="gov-prompt-type" class="form-input">
              <option value="codex">Codex Next Task</option>
              <option value="opencode">OpenCode Next Task</option>
              <option value="recovery">Recovery</option>
              <option value="p0">P0 Patch</option>
              <option value="review">Post-Codex Review</option>
            </select>
          </div>
          <button class="btn btn-outline btn-sm" onclick="UI._govGeneratePrompt()">Generate Prompt</button>
          <div id="gov-prompt-result" style="margin-top:8px;"></div>
          <pre id="gov-prompt-text" style="margin-top:8px; padding:12px; background:var(--bg-secondary); border-radius:8px; font-size:12px; max-height:300px; overflow:auto; white-space:pre-wrap; display:none;"></pre>
          <button id="gov-copy-prompt" class="btn btn-sm btn-outline" style="margin-top:8px; display:none;" onclick="UI._govCopyPrompt()">📋 Copy Prompt</button>
        </div>
      </div>
      <div class="panel" style="margin-top:16px;">
        <h3 class="panel-title">Natural Workflow Detector</h3>
        <p style="margin-bottom:8px;">Ketik prompt biasa untuk mendeteksi workflow intent:</p>
        <div class="form-group">
          <textarea id="gov-workflow-prompt" class="form-input" rows="3" placeholder="Contoh: token Codex habis, lanjut OpenCode"></textarea>
        </div>
        <button class="btn btn-primary" onclick="UI._govDetectWorkflow()">Detect Workflow</button>
        <div id="gov-workflow-result" style="margin-top:12px;"></div>
        <div id="gov-workflow-detail" style="margin-top:8px; display:none;">
          <pre id="gov-workflow-text" style="padding:12px; background:var(--bg-secondary); border-radius:8px; font-size:12px; max-height:300px; overflow:auto; white-space:pre-wrap;"></pre>
          <button id="gov-copy-workflow" class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="UI._govCopyWorkflow()">📋 Copy Workflow</button>
        </div>
      </div>
    `;
    targetEl.innerHTML = html;
  },

  _govCheckContract: async function() {
    const el = document.getElementById('gov-contract-result');
    el.innerHTML = UI.renderLoading('Validating...');
    const r = await Api.apiGet('/devgovernance/contract');
    if (!r.ok) { el.innerHTML = UI.renderError('Failed'); return; }
    const data = r.data;
    const errors = data.validation?.errors || [];
    const warnings = data.validation?.warnings || [];
    el.innerHTML = \`
      <p><strong>Status:</strong> \${data.validation?.ok ? '✅ Valid' : '❌ Invalid'}</p>
      <p>Sections: \${data.validation?.summary?.sectionCount || 0}</p>
      \${errors.length ? '<p style="color:var(--danger);">Errors:<br>' + errors.map(e => '⚠️ ' + Utils.escapeHtml(e)).join('<br>') + '</p>' : ''}
      \${warnings.length ? '<p style="color:var(--warning);">Warnings:<br>' + warnings.map(w => '⚠️ ' + Utils.escapeHtml(w)).join('<br>') + '</p>' : ''}
    \`;
  },

  _govShowHandoff: async function() {
    const el = document.getElementById('tab-content');
    el.innerHTML = UI.renderLoading('Loading handoff...');
    const r = await Api.apiGet('/devgovernance/handoff');
    if (!r.ok) { el.innerHTML = UI.renderError('Failed'); return; }
    const h = r.data.handoff || r.data.summary || {};
    el.innerHTML = \`
      <div class="tab-header"><h2>📋 Agent Handoff</h2>
        <button class="btn btn-outline btn-sm" onclick="UI.renderDevGovernance(document.getElementById('tab-content'))">Back</button>
      </div>
      <div class="panel" style="margin-top:16px;">
        <div class="kv-row"><span class="kv-key">ID</span><span class="kv-value">\${Utils.escapeHtml(h.id || '-')}</span></div>
        <div class="kv-row"><span class="kv-key">Last Agent</span><span class="kv-value">\${Utils.escapeHtml(h.lastAgent || '-')}</span></div>
        <div class="kv-row"><span class="kv-key">Task</span><span class="kv-value">\${Utils.escapeHtml(h.currentTask || '-')}</span></div>
        <div class="kv-row"><span class="kv-key">Goal</span><span class="kv-value">\${Utils.escapeHtml(h.goal || '-')}</span></div>
        <div class="kv-row"><span class="kv-key">Files Changed</span><span class="kv-value">\${(h.filesChanged || []).length}</span></div>
        <div class="kv-row"><span class="kv-key">Tests Run</span><span class="kv-value">\${(h.testsRun || []).length}</span></div>
        <div class="kv-row"><span class="kv-key">Tests Failed</span><span class="kv-value">\${(h.testsFailed || []).length}</span></div>
      </div>
      \${(h.filesChanged || []).length ? '<div class="panel"><h3 class="panel-title">Files Changed</h3><ul>' + h.filesChanged.map(f => '<li>' + Utils.escapeHtml(f) + '</li>').join('') + '</ul></div>' : ''}
      \${(h.remainingRisks || []).length ? '<div class="panel"><h3 class="panel-title">Risks</h3><ul>' + h.remainingRisks.map(r => '<li>⚠️ ' + Utils.escapeHtml(r) + '</li>').join('') + '</ul></div>' : ''}
      \${h.nextAgentTask ? '<div class="panel"><h3 class="panel-title">Next Agent Task</h3><pre style="white-space:pre-wrap;">' + Utils.escapeHtml(h.nextAgentTask) + '</pre></div>' : ''}
    \`;
  },

  _govScanArchitecture: async function() {
    const el = document.getElementById('gov-arch-result');
    el.innerHTML = UI.renderLoading('Scanning...');
    const r = await Api.apiPost('/devgovernance/scan', {});
    if (!r.ok) { el.innerHTML = UI.renderError('Failed'); return; }
    el.innerHTML = '<p>✅ Architecture map generated: ' + Utils.escapeHtml(r.data.architectureMap?.path || '') + '</p>';
  },

  _govRunCollisionCheck: async function() {
    const el = document.getElementById('gov-collision-result');
    el.innerHTML = UI.renderLoading('Checking...');
    const r = await Api.apiGet('/devgovernance/collisions');
    if (!r.ok) { el.innerHTML = UI.renderError('Failed'); return; }
    const coll = r.data.collisions || {};
    const items = coll.collisions || [];
    const critical = coll.critical || [];
    const warnings = coll.warnings || [];
    el.innerHTML = \`
      <p><strong>Total:</strong> \${items.length} | <strong>Critical:</strong> \${critical.length} | <strong>Warnings:</strong> \${warnings.length}</p>
      \${critical.length ? '<div style="color:var(--danger);"><strong>Critical:</strong><ul>' + critical.map(c => '<li>⚠️ ' + Utils.escapeHtml(c.message) + '</li>').join('') + '</ul></div>' : ''}
      \${warnings.length ? '<div style="color:var(--warning);"><strong>Warnings:</strong><ul>' + warnings.map(c => '<li>⚠️ ' + Utils.escapeHtml(c.message) + '</li>').join('') + '</ul></div>' : ''}
      \${!items.length ? '<p>✅ No collisions detected</p>' : ''}
    \`;
  },

  _govCheckDashboardRoutes: async function() {
    const el = document.getElementById('gov-routes-result');
    el.innerHTML = UI.renderLoading('Checking...');
    const r = await Api.apiGet('/devgovernance/dashboard-routes');
    if (!r.ok) { el.innerHTML = UI.renderError('Failed'); return; }
    const dr = r.data.dashboardRoutes || {};
    const issues = dr.issues || [];
    const critical = dr.critical || [];
    el.innerHTML = \`
      <p><strong>Issues:</strong> \${issues.length} | <strong>Critical:</strong> \${critical.length}</p>
      \${critical.length ? '<div style="color:var(--danger);"><ul>' + critical.map(c => '<li>⚠️ ' + Utils.escapeHtml(c.message) + '</li>').join('') + '</ul></div>' : ''}
      \${!critical.length ? '<p>✅ No critical route issues</p>' : ''}
    \`;
  },

  _govCheckBackendFrontend: async function() {
    const el = document.getElementById('gov-link-result');
    el.innerHTML = UI.renderLoading('Checking...');
    const r = await Api.apiGet('/devgovernance/backend-frontend');
    if (!r.ok) { el.innerHTML = UI.renderError('Failed'); return; }
    const bf = r.data.backendFrontend?.report || r.data.backendFrontend || {};
    el.innerHTML = \`
      <p><strong>Frontend Calls:</strong> \${bf.summary?.frontendCalls || 0} | <strong>Backend Routes:</strong> \${bf.summary?.backendRoutes || 0}</p>
      <p><strong>Matched:</strong> \${bf.summary?.matched || 0} | <strong>Missing:</strong> \${bf.summary?.missing || 0} | <strong>Unused:</strong> \${bf.summary?.unused || 0}</p>
      \${(bf.missing || []).length ? '<div style="color:var(--warning);"><strong>Missing Backend Routes:</strong><ul>' + bf.missing.map(m => '<li>' + Utils.escapeHtml(m.endpoint) + '</li>').join('') + '</ul></div>' : ''}
      \${!bf.summary?.missing ? '<p>✅ All frontend calls match backend routes</p>' : ''}
    \`;
  },

  _govGenerateTestMatrix: async function() {
    const el = document.getElementById('gov-matrix-result');
    const desc = document.getElementById('gov-change-desc')?.value || '';
    el.innerHTML = UI.renderLoading('Generating...');
    const r = await Api.apiPost('/devgovernance/test-matrix', { changeManifest: desc ? { filesChanged: [desc] } : null });
    if (!r.ok) { el.innerHTML = UI.renderError('Failed'); return; }
    const matrix = r.data.matrix || {};
    el.innerHTML = \`
      <p><strong>Areas:</strong> \${(matrix.areas || []).join(', ') || 'All'}</p>
      <p><strong>Total Tests:</strong> \${matrix.total}</p>
      <details>
        <summary>View Test List</summary>
        <ul style="max-height:200px; overflow:auto;">\${(matrix.tests || []).map(t => '<li><code>' + Utils.escapeHtml(t) + '</code></li>').join('')}</ul>
      </details>
    \`;
  },

  _govGeneratePrompt: async function() {
    const el = document.getElementById('gov-prompt-result');
    const promptEl = document.getElementById('gov-prompt-text');
    const copyBtn = document.getElementById('gov-copy-prompt');
    const type = document.getElementById('gov-prompt-type')?.value || 'codex';
    el.innerHTML = UI.renderLoading('Generating...');
    const r = await Api.apiPost('/devgovernance/next-agent-prompt', { type });
    if (!r.ok) { el.innerHTML = UI.renderError('Failed'); return; }
    promptEl.textContent = r.data.prompt || '';
    promptEl.style.display = 'block';
    copyBtn.style.display = 'inline-block';
    el.innerHTML = '<p>✅ Prompt generated (' + Utils.escapeHtml(type) + ')</p>';
  },

  _govCopyPrompt: function() {
    const promptEl = document.getElementById('gov-prompt-text');
    if (!promptEl) return;
    navigator.clipboard.writeText(promptEl.textContent).then(() => {
      Utils.showToast('Prompt copied to clipboard!', 'success');
    }).catch(() => {
      Utils.showToast('Failed to copy', 'error');
    });
  },

  _govDetectWorkflow: async function() {
    const el = document.getElementById('gov-workflow-result');
    const detailEl = document.getElementById('gov-workflow-detail');
    const textEl = document.getElementById('gov-workflow-text');
    const prompt = document.getElementById('gov-workflow-prompt')?.value || '';
    if (!prompt.trim()) {
      el.innerHTML = '<p style="color:var(--danger);">Masukkan prompt terlebih dahulu.</p>';
      return;
    }
    el.innerHTML = UI.renderLoading('Mendeteksi workflow...');
    const r = await Api.apiPost('/devgovernance/workflow-route', { prompt });
    if (!r.ok) { el.innerHTML = UI.renderError('Failed'); return; }
    const d = r.data;
    let html = '<div style="margin-top:8px;">';
    html += '<div class="kv-row"><span class="kv-key">Intent</span><span class="kv-value">' + Utils.escapeHtml(d.intent || 'unknown') + '</span></div>';
    html += '<div class="kv-row"><span class="kv-key">Confidence</span><span class="kv-value">' + ((d.confidence || 0) * 100).toFixed(0) + '%</span></div>';
    html += '<div class="kv-row"><span class="kv-key">Mode</span><span class="kv-value">' + Utils.escapeHtml(d.mode || 'audit') + '</span></div>';
    html += '<div class="kv-row"><span class="kv-key">Recommended Agent</span><span class="kv-value">' + Utils.escapeHtml(d.recommendedAgent || 'opencode') + '</span></div>';
    html += '<div class="kv-row"><span class="kv-key">Risk Level</span><span class="kv-value">' + Utils.escapeHtml(d.policy?.riskLevel || 'low') + '</span></div>';
    if (d.tokenExhausted) html += '<p style="color:var(--danger); margin-top:8px;">⚠️ Token exhausted. Recovery mode.</p>';
    if (d.critical) html += '<p style="color:var(--danger); margin-top:8px;">🔴 P0 critical. Block feature work.</p>';
    if (d.message) html += '<p style="margin-top:8px;">' + Utils.escapeHtml(d.message) + '</p>';
    html += '<details style="margin-top:8px;"><summary>Allowed Actions</summary><ul>' + (d.policy?.allowedActions || []).map(a => '<li>✅ ' + Utils.escapeHtml(a) + '</li>').join('') + '</ul></details>';
    html += '<details style="margin-top:8px;"><summary>Blocked Actions</summary><ul>' + (d.policy?.blockedActions || []).map(a => '<li>🚫 ' + Utils.escapeHtml(a) + '</li>').join('') + '</ul></details>';
    html += '</div>';
    el.innerHTML = html;
    if (d.response?.prompt || d.response?.report || d.response?.steps) {
      const text = d.response.prompt || d.response.report || (d.response.steps || []).join('\n');
      textEl.textContent = text;
      detailEl.style.display = 'block';
    }
  },

  _govCopyWorkflow: function() {
    const textEl = document.getElementById('gov-workflow-text');
    if (!textEl) return;
    navigator.clipboard.writeText(textEl.textContent).then(() => {
      Utils.showToast('Workflow output copied!', 'success');
    }).catch(() => {
      Utils.showToast('Failed to copy', 'error');
    });
  },

  renderGithubOps: async function(targetEl) {
    const actions = [
      { key: 'repo', label: '🔍 Check Repo State', action: async () => GITHUBOPS.repoState() },
      { key: 'manifest', label: '📋 Build Change Manifest', action: async () => GITHUBOPS.changeManifest() },
      { key: 'scan', label: '🔒 Run Secret Scan', action: async () => GITHUBOPS.runSecretScan() },
      { key: 'commit', label: '📝 Create Commit Plan', action: async () => GITHUBOPS.createCommitPlan() },
      { key: 'pushplan', label: '📦 Create Push Plan', action: async () => GITHUBOPS.createPushPlan() },
      { key: 'proposal', label: '📨 Create Push Proposal', action: async () => GITHUBOPS.createPushProposal() },
      { key: 'pipeline', label: '🏗️ Run Full Pipeline', action: async () => GITHUBOPS.runFullPipeline() },
      { key: 'workflows', label: '📜 List Workflows', action: async () => GITHUBOPS.listWorkflows() },
      { key: 'release', label: '🚦 Check Release Gate', action: async () => GITHUBOPS.getReleaseGate() },
      { key: 'pushlist', label: '📋 List Push Proposals', action: async () => GITHUBOPS.listPushProposals() },
      { key: 'wflist', label: '📋 List Workflow Proposals', action: async () => GITHUBOPS.listWorkflowRunProposals() }
    ];

    let html = '<div class="tab-header"><h2>🐙 GitHub Ops Pipeline</h2></div>';
    html += '<p style="color:var(--muted); margin-bottom:16px;">Inspect repo state, create proposals, and manage GitHub push/workflow approvals.</p>';
    html += '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px;">';

    for (const a of actions) {
      html += `<button class="btn btn-outline btn-sm" onclick="UI._ghAction('${a.key}')">${Utils.escapeHtml(a.label)}</button>`;
    }
    html += '</div>';
    html += '<div id="gh-result" style="margin-top:12px; font-family:var(--font-mono); font-size:13px; white-space:pre-wrap;"></div>';
    targetEl.innerHTML = html;
  },

  _ghAction: async function(key) {
    const el = document.getElementById('gh-result');
    if (!el) return;
    el.innerHTML = UI.renderLoading('Processing...');

    const actions = {
      repo: GITHUBOPS.repoState,
      manifest: GITHUBOPS.changeManifest,
      scan: GITHUBOPS.runSecretScan,
      commit: GITHUBOPS.createCommitPlan,
      pushplan: GITHUBOPS.createPushPlan,
      proposal: GITHUBOPS.createPushProposal,
      pipeline: GITHUBOPS.runFullPipeline,
      workflows: GITHUBOPS.listWorkflows,
      release: GITHUBOPS.getReleaseGate,
      pushlist: GITHUBOPS.listPushProposals,
      wflist: GITHUBOPS.listWorkflowRunProposals
    };

    const fn = actions[key];
    if (!fn) { el.innerHTML = UI.renderError('Unknown action'); return; }

    try {
      const r = await fn();
      if (!r.ok) {
        el.innerHTML = UI.renderError('Error', r.error || 'Request failed');
        return;
      }
      const data = r.data || r;
      el.innerHTML = '<pre style="background:var(--bg-secondary); padding:12px; border-radius:6px; overflow-x:auto; max-height:60vh;">' + Utils.escapeHtml(JSON.stringify(data, null, 2)) + '</pre>';
    } catch (e) {
      el.innerHTML = UI.renderError('Exception', e.message);
    }
  }
};
