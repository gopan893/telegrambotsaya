/* Dashboard Telegram Control tab */
/* global Api, UI, DashboardState */

(function() {
  'use strict';

  const TAB_ID = 'telegram-control';

  function init() {
    DashboardState.DASHBOARD_TABS[TAB_ID] = {
      label: 'Telegram Control',
      title: 'Telegram Control Panel',
      navIcon: '📡',
      navVisible: true,
      aliases: ['telegram', 'commands', 'command-center', 'bot-control', 'telegram-menu'],
      renderer: 'renderTelegramControl'
    };
  }

  function renderTelegramControl(container) {
    container.innerHTML = buildLayout();
    loadOverview();
    bindEvents();
  }

  function buildLayout() {
    return `
      <div class="tab-content">
        <div class="section-header">
          <h2>📡 Telegram Control Panel</h2>
          <span class="badge" id="tc-cmd-count">Memuat...</span>
        </div>

        <div class="card-grid">
          <div class="card" id="tc-overview-card">
            <h3>Ringkasan</h3>
            <div id="tc-overview-content">
              <p class="loading">Memuat...</p>
            </div>
          </div>

          <div class="card" id="tc-registry-card">
            <h3>Command Registry</h3>
            <div class="filter-bar">
              <input type="text" id="tc-search" placeholder="Cari command..." class="input-dark" />
              <select id="tc-category-filter" class="input-dark">
                <option value="">Semua Kategori</option>
              </select>
              <select id="tc-risk-filter" class="input-dark">
                <option value="">Semua Risiko</option>
                <option value="read_only">Read Only</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="danger">Danger</option>
              </select>
            </div>
            <div id="tc-command-list" class="table-responsive">
              <p class="loading">Memuat daftar command...</p>
            </div>
          </div>
        </div>

        <div class="card-grid">
          <div class="card" id="tc-intent-test-card">
            <h3>Uji Natural Intent</h3>
            <div class="form-row">
              <input type="text" id="tc-intent-input" placeholder="Ketik pesan natural..." class="input-dark input-expanded" />
              <button id="tc-test-intent-btn" class="btn btn-primary">Uji</button>
            </div>
            <div id="tc-intent-result" class="result-box hidden"></div>
          </div>

          <div class="card" id="tc-audit-card">
            <h3>Audit Log Terbaru</h3>
            <div id="tc-audit-content">
              <p class="loading">Memuat...</p>
            </div>
          </div>
        </div>

        <div class="card-grid">
          <div class="card" id="tc-proposals-card">
            <h3>Proposal Tertunda</h3>
            <div id="tc-proposals-content">
              <p class="loading">Memuat...</p>
            </div>
          </div>

          <div class="card" id="tc-help-card">
            <h3>Bantuan / Menu</h3>
            <div class="form-row">
              <input type="text" id="tc-help-input" placeholder="Nama command atau kategori..." class="input-dark input-expanded" />
              <button id="tc-help-btn" class="btn btn-primary">Lihat</button>
            </div>
            <div id="tc-help-result" class="result-box hidden"></div>
          </div>
        </div>
      </div>
    `;
  }

  function loadOverview() {
    Api.apiGet('/telegram-control').then(function(data) {
      if (!data || !data.ok) {
        document.getElementById('tc-overview-content').innerHTML = '<p class="error">Gagal memuat data.</p>';
        return;
      }
      document.getElementById('tc-cmd-count').textContent = data.totalCommands + ' commands';

      var html = '<div class="stat-list">';
      html += '<div class="stat-item"><span class="stat-label">Total Commands</span><span class="stat-value">' + data.totalCommands + '</span></div>';
      html += '<div class="stat-item"><span class="stat-label">Kategori</span><span class="stat-value">' + (data.categories || []).length + '</span></div>';
      html += '<div class="stat-item"><span class="stat-label">Proposal Tertunda</span><span class="stat-value">' + data.pendingProposals + '</span></div>';
      html += '<div class="stat-item"><span class="stat-label">Registry Valid</span><span class="stat-value ' + (data.registryValid ? 'text-success' : 'text-danger') + '">' + (data.registryValid ? '✅' : '❌') + '</span></div>';
      html += '<div class="stat-item"><span class="stat-label">Version</span><span class="stat-value">' + (data.version || '1.0.0') + '</span></div>';
      html += '</div>';

      document.getElementById('tc-overview-content').innerHTML = html;
      populateCategoryFilter(data.categories || []);
    }).catch(function() {
      document.getElementById('tc-overview-content').innerHTML = '<p class="error">Gagal terhubung ke server.</p>';
    });
  }

  function populateCategoryFilter(categories) {
    var sel = document.getElementById('tc-category-filter');
    categories.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c.key;
      opt.textContent = c.label + ' (' + c.count + ')';
      sel.appendChild(opt);
    });
  }

  function loadCommands() {
    var search = document.getElementById('tc-search').value.trim();
    var category = document.getElementById('tc-category-filter').value;
    var risk = document.getElementById('tc-risk-filter').value;

    var params = [];
    if (search) params.push('search=' + encodeURIComponent(search));
    if (category) params.push('category=' + encodeURIComponent(category));
    if (risk) params.push('riskLevel=' + encodeURIComponent(risk));

    var url = '/telegram-control/commands' + (params.length > 0 ? '?' + params.join('&') : '');

    document.getElementById('tc-command-list').innerHTML = '<p class="loading">Memuat...</p>';

    Api.apiGet(url).then(function(data) {
      if (!data || !data.ok) {
        document.getElementById('tc-command-list').innerHTML = '<p class="error">Gagal memuat commands.</p>';
        return;
      }
      renderCommandList(data.items || []);
    }).catch(function() {
      document.getElementById('tc-command-list').innerHTML = '<p class="error">Gagal terhubung.</p>';
    });
  }

  function renderCommandList(items) {
    if (!items || items.length === 0) {
      document.getElementById('tc-command-list').innerHTML = '<p class="empty">Tidak ada command ditemukan.</p>';
      return;
    }

    var riskColors = { read_only: 'var(--color-info)', low: 'var(--color-success)', medium: 'var(--color-warning)', high: 'var(--color-danger)', danger: 'var(--color-danger)' };
    var riskLabels = { read_only: '📖', low: '🟢', medium: '🟡', high: '🟠', danger: '🔴' };

    var html = '<table class="table"><thead><tr><th>Command</th><th>Kategori</th><th>Deskripsi</th><th>Risiko</th><th>Akses</th><th>Status</th></tr></thead><tbody>';

    items.forEach(function(cmd) {
      var riskBadge = '<span style="color:' + (riskColors[cmd.riskLevel] || 'inherit') + '">' + (riskLabels[cmd.riskLevel] || '') + ' ' + cmd.riskLevel + '</span>';
      var accessIcon = cmd.requiresOwner ? '👑 Owner' : cmd.requiresAdmin ? '🛡️ Admin' : '👤 Semua';
      var statusIcon = cmd.enabled ? '✅' : '❌';
      var aliasStr = cmd.aliases && cmd.aliases.length > 0 ? ' (' + cmd.aliases.slice(0, 3).join(', ') + ')' : '';

      html += '<tr>';
      html += '<td><code>/' + cmd.name + '</code>' + aliasStr + '</td>';
      html += '<td>' + cmd.category + '</td>';
      html += '<td>' + (cmd.description || '-') + '</td>';
      html += '<td>' + riskBadge + '</td>';
      html += '<td>' + accessIcon + '</td>';
      html += '<td>' + statusIcon + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '<p class="table-footer">Total: ' + items.length + ' commands</p>';
    document.getElementById('tc-command-list').innerHTML = html;
  }

  function loadAudit() {
    Api.apiGet('/telegram-control/audit?limit=20').then(function(data) {
      if (!data || !data.ok) {
        document.getElementById('tc-audit-content').innerHTML = '<p class="error">Gagal memuat audit.</p>';
        return;
      }
      renderAudit(data.items || []);
    }).catch(function() {
      document.getElementById('tc-audit-content').innerHTML = '<p class="error">Gagal terhubung.</p>';
    });
  }

  function renderAudit(items) {
    if (!items || items.length === 0) {
      document.getElementById('tc-audit-content').innerHTML = '<p class="empty">Belum ada aktivitas.</p>';
      return;
    }

    var html = '<div class="audit-list">';
    items.slice(-10).reverse().forEach(function(entry) {
      var icon = entry.allowed ? '✅' : '🚫';
      var time = entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString() : '';
      html += '<div class="audit-item"><span class="audit-icon">' + icon + '</span> ';
      html += '<span class="audit-cmd">/' + (entry.command || '?') + '</span> ';
      html += '<span class="audit-risk">[' + (entry.riskLevel || '?') + ']</span> ';
      html += '<span class="audit-time">' + time + '</span>';
      if (entry.reason) html += '<br/><span class="audit-reason">' + escapeHtml(entry.reason) + '</span>';
      html += '</div>';
    });
    html += '</div>';
    document.getElementById('tc-audit-content').innerHTML = html;
  }

  function loadProposals() {
    Api.apiGet('/telegram-control/pending-proposals').then(function(data) {
      if (!data || !data.ok) {
        document.getElementById('tc-proposals-content').innerHTML = '<p class="error">Gagal memuat proposal.</p>';
        return;
      }
      renderProposals(data.items || []);
    }).catch(function() {
      document.getElementById('tc-proposals-content').innerHTML = '<p class="error">Gagal terhubung.</p>';
    });
  }

  function renderProposals(items) {
    if (!items || items.length === 0) {
      document.getElementById('tc-proposals-content').innerHTML = '<p class="empty">Tidak ada proposal tertunda.</p>';
      return;
    }

    var html = '<div class="proposal-list">';
    items.forEach(function(p) {
      html += '<div class="proposal-item">';
      html += '<strong>#' + escapeHtml(p.id) + '</strong>';
      html += ' — <code>/' + escapeHtml(p.command || '?') + '</code>';
      html += ' — Risiko: ' + (p.riskLevel || '?');
      html += ' — Status: ' + (p.status || '?');
      html += '</div>';
    });
    html += '</div>';
    document.getElementById('tc-proposals-content').innerHTML = html;
  }

  function testIntent() {
    var text = document.getElementById('tc-intent-input').value.trim();
    if (!text) return;

    var resultDiv = document.getElementById('tc-intent-result');
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = '<p class="loading">Menganalisis...</p>';

    Api.apiPost('/telegram-control/test-intent', { text: text }).then(function(data) {
      if (!data || !data.ok) {
        resultDiv.innerHTML = '<p class="error">Gagal menganalisis.</p>';
        return;
      }
      var c = data.classification || {};
      var r = data.risk || {};
      var route = data.routeResult || {};

      var html = '<div class="result-content">';
      html += '<h4>Hasil Analisis</h4>';
      html += '<div class="result-row"><span class="label">Intent:</span> <span class="value">' + escapeHtml(c.intent) + '</span></div>';
      html += '<div class="result-row"><span class="label">Confidence:</span> <span class="value">' + (c.confidence || 0) + '%</span></div>';
      html += '<div class="result-row"><span class="label">Command:</span> <span class="value">' + (c.command ? '/' + c.command : '-') + '</span></div>';
      html += '<div class="result-row"><span class="label">Blocked:</span> <span class="value">' + (c.blocked ? '🚫 Ya' : 'Tidak') + '</span></div>';
      html += '<div class="result-row"><span class="label">Risk Level:</span> <span class="value">' + (r.level || '-') + '</span></div>';
      html += '<div class="result-row"><span class="label">Requires Approval:</span> <span class="value">' + (r.requiresApproval ? 'Ya' : 'Tidak') + '</span></div>';
      if (data.command) {
        html += '<div class="result-row"><span class="label">Command Detail:</span> <span class="value">' + escapeHtml(data.command.description) + '</span></div>';
      }
      html += '<div class="result-row"><span class="label">Routed Response:</span> <span class="value">' + escapeHtml(route.response || '(none)') + '</span></div>';
      html += '</div>';
      resultDiv.innerHTML = html;
    }).catch(function() {
      resultDiv.innerHTML = '<p class="error">Gagal terhubung.</p>';
    });
  }

  function showHelp() {
    var query = document.getElementById('tc-help-input').value.trim();
    if (!query) return;

    var resultDiv = document.getElementById('tc-help-result');
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = '<p class="loading">Memuat...</p>';
    var url = '/telegram-control/help?command=' + encodeURIComponent(query);

    Api.apiGet(url).then(function(data) {
      if (!data || !data.ok) {
        resultDiv.innerHTML = '<p class="error">Gagal memuat bantuan.</p>';
        return;
      }
      resultDiv.innerHTML = '<div class="result-content"><pre class="help-pre">' + escapeHtml(data.help || 'Tidak ada bantuan.') + '</pre></div>';
    }).catch(function() {
      resultDiv.innerHTML = '<p class="error">Gagal terhubung.</p>';
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function bindEvents() {
    document.getElementById('tc-search').addEventListener('input', debounce(loadCommands, 300));
    document.getElementById('tc-category-filter').addEventListener('change', loadCommands);
    document.getElementById('tc-risk-filter').addEventListener('change', loadCommands);
    document.getElementById('tc-test-intent-btn').addEventListener('click', testIntent);
    document.getElementById('tc-help-btn').addEventListener('click', showHelp);

    document.getElementById('tc-intent-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') testIntent();
    });
    document.getElementById('tc-help-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') showHelp();
    });
  }

  function debounce(fn, delay) {
    var timer = null;
    return function() {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
    };
  }

  if (typeof window.renderTelegramControl === 'undefined') {
    window.renderTelegramControl = renderTelegramControl;
  }
  if (window.UI && typeof window.UI.renderTelegramControl === 'undefined') {
    window.UI.renderTelegramControl = renderTelegramControl;
  }

  init();
  setTimeout(function() {
    var container = document.getElementById('tab-content');
    if (container && DashboardState.getState().activeTab === TAB_ID) {
      renderTelegramControl(container);
    }
  }, 100);
})();
