'use strict';

(function () {
  var API_PREFIX = '/api/dashboard/privacy';
  var PENDING = [];

  // --- Helpers ---
  function esc(text) {
    if (window.Utils && Utils.escapeHtml) return Utils.escapeHtml(text);
    return String(text ?? '').replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function statusBadge(status) {
    var clean = String(status || 'unknown').toLowerCase();
    var cls = 'badge-info';
    if (['pass', 'passed', 'safe', 'healthy', 'ok', 'success', 'none', 'compliant', 'allowed', 'granted', 'active', 'completed', 'approved'].indexOf(clean) !== -1) cls = 'badge-passed';
    else if (['fail', 'failed', 'danger', 'critical', 'blocked', 'high', 'denied', 'breach', 'open', 'rejected'].indexOf(clean) !== -1) cls = 'badge-danger';
    else if (['warning', 'warn', 'medium', 'degraded', 'suspicious', 'attention', 'partial', 'review'].indexOf(clean) !== -1) cls = 'badge-warning';
    return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
  }

  function apiGet(path) {
    if (Api.apiGet) return Api.apiGet(path);
    return Api.get(path);
  }

  function apiPost(path, body) {
    if (body === void 0) body = {};
    if (Api.apiPost) return Api.apiPost(path, body);
    return Api.post(path, body);
  }

  function extractData(res) {
    if (res && typeof res === 'object' && 'ok' in res) {
      return res.ok ? res.data : null;
    }
    return res;
  }

  // --- Main render entry ---
  window.renderPrivacy = function renderPrivacy() {
    var container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = buildPrivacyUI();
    attachPrivacyHandlers();
    loadPrivacyOverview();
  };

  function buildPrivacyUI() {
    return '<div class="section-header"><h2>\uD83D\uDD10 Privacy & Data Control</h2></div>' +
      '<div class="action-bar" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">' +
        '<button class="btn btn-primary" data-action="inventory-scan">\uD83D\uDCCB Inventory Scan</button>' +
        '<button class="btn btn-outline" data-action="classify">\uD83C\uDFF7\uFE0F Classify</button>' +
        '<button class="btn btn-outline" data-action="retention-candidates">\uD83D\uDDD1\uFE0F Retention Candidates</button>' +
        '<button class="btn btn-outline" data-action="report">\uD83D\uDCC4 Report</button>' +
      '</div>' +
      '<div id="privacy-overview" class="card-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:16px;">' +
        '<div class="card"><div class="card-body">Loading...</div></div>' +
      '</div>' +
      '<div class="tabs" style="display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid var(--border);">' +
        '<button class="tab-btn active" data-tab="inventory">\uD83D\uDCCB Inventory</button>' +
        '<button class="tab-btn" data-tab="policies">\uD83D\uDCDC Policies</button>' +
        '<button class="tab-btn" data-tab="retention">\u23F3 Retention</button>' +
        '<button class="tab-btn" data-tab="export">\uD83D\uDCE4 Export</button>' +
        '<button class="tab-btn" data-tab="archive">\uD83D\uDDC4\uFE0F Archive</button>' +
        '<button class="tab-btn" data-tab="delete">\uD83D\uDDD1\uFE0F Delete</button>' +
        '<button class="tab-btn" data-tab="audit">\uD83D\uDCDD Audit</button>' +
      '</div>' +
      '<div id="privacy-content"></div>';
  }

  function attachPrivacyHandlers() {
    var container = document.getElementById('tab-content');
    if (!container) return;

    container.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.action;
        switch (action) {
          case 'inventory-scan': runInventoryScan(btn); break;
          case 'classify': runClassification(btn); break;
          case 'retention-candidates': loadRetentionCandidates(); break;
          case 'report': runReport(btn); break;
        }
      });
    });

    container.querySelectorAll('.tab-btn').forEach(function (tab) {
      tab.addEventListener('click', function () {
        container.querySelectorAll('.tab-btn').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        var tabName = tab.dataset.tab;
        switch (tabName) {
          case 'inventory': loadInventory(); break;
          case 'policies': loadPolicies(); break;
          case 'retention': loadRetention(); break;
          case 'export': showExportForm(); break;
          case 'archive': showArchiveForm(); break;
          case 'delete': showDeleteForm(); break;
          case 'audit': loadAudit(); break;
        }
      });
    });
  }

  function setTabContent(html) {
    var area = document.getElementById('privacy-content');
    if (area) area.innerHTML = html;
  }

  function runInventoryScan(button) {
    var originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '\u23F3 Scanning...';
    apiPost(API_PREFIX + '/inventory-scan').then(function (res) {
      var data = extractData(res);
      if (!data) { Utils.showToast('Inventory scan failed', 'danger'); return; }
      Utils.showToast('Inventory scan completed', 'success');
      loadInventory();
    }).catch(function (err) {
      Utils.showToast('Scan error: ' + (err.message || 'Unknown'), 'danger');
    }).finally(function () {
      button.disabled = false;
      button.innerHTML = originalText;
    });
  }

  function runClassification(button) {
    var originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '\u23F3 Classifying...';
    apiPost(API_PREFIX + '/classify').then(function (res) {
      var data = extractData(res);
      if (!data) { Utils.showToast('Classification failed', 'danger'); return; }
      renderClassificationResults(data);
      Utils.showToast('Classification completed', 'success');
    }).catch(function (err) {
      Utils.showToast('Classification error: ' + (err.message || 'Unknown'), 'danger');
    }).finally(function () {
      button.disabled = false;
      button.innerHTML = originalText;
    });
  }

  function runReport(button) {
    var originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '\u23F3 Generating...';
    apiGet(API_PREFIX + '/report').then(function (res) {
      var data = extractData(res);
      if (!data) { Utils.showToast('Report generation failed', 'danger'); return; }
      renderReport(data);
      Utils.showToast('Report generated', 'success');
    }).catch(function (err) {
      Utils.showToast('Report error: ' + (err.message || 'Unknown'), 'danger');
    }).finally(function () {
      button.disabled = false;
      button.innerHTML = originalText;
    });
  }

  function loadPrivacyOverview() {
    apiGet(API_PREFIX).then(function (res) {
      var data = extractData(res);
      var area = document.getElementById('privacy-overview');
      if (!area) return;
      if (!data) {
        area.innerHTML = '<div class="card"><div class="card-body">Failed to load overview</div></div>';
        return;
      }
      var overview = data.overview || data;
      var cards = [
        { label: 'Data Categories', value: overview.totalCategories ?? overview.total ?? '-' },
        { label: 'Sensitive', value: overview.sensitiveCount ?? '-' },
        { label: 'Private', value: overview.privateCount ?? '-' },
        { label: 'Exportable', value: overview.exportableCount ?? '-' }
      ];
      area.innerHTML = cards.map(function (c) {
        return '<div class="card" style="padding:16px;text-align:center;">' +
          '<div class="card-value" style="font-size:24px;">' + esc(c.value) + '</div>' +
          '<div class="card-title" style="margin-top:4px;">' + esc(c.label) + '</div>' +
        '</div>';
      }).join('');
    }).catch(function () {
      var area = document.getElementById('privacy-overview');
      if (area) area.innerHTML = '<div class="card"><div class="card-body">Load error</div></div>';
    });
  }

  function loadInventory() {
    setTabContent('<div class="loading" style="text-align:center;padding:32px;"><div class="spinner"></div><p>Loading inventory...</p></div>');
    apiGet(API_PREFIX + '/inventory').then(function (res) {
      var categories = extractData(res);
      if (!categories || !Array.isArray(categories)) { setTabContent('<div class="empty-state"><span class="empty-state-emoji">\u274C</span><h3>No inventory data</h3></div>'); return; }
      var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDCCB Data Inventory</h3>' +
        '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:12px;">' +
        '<thead><tr><th>Category</th><th>Source</th><th>Sensitivity</th><th>Exportable</th><th>Archiveable</th><th>Deletable</th><th>Owner Only</th></tr></thead><tbody>';
      categories.forEach(function (c) {
        html += '<tr>' +
          '<td>' + esc(c.category || c.name || '-') + '</td>' +
          '<td>' + esc(c.sourceModule || c.source || '-') + '</td>' +
          '<td>' + statusBadge(c.sensitivity || 'internal') + '</td>' +
          '<td>' + (c.exportable ? '\u2705' : '\u274C') + '</td>' +
          '<td>' + (c.archiveable ? '\u2705' : '\u274C') + '</td>' +
          '<td>' + (c.deletable ? '\u2705' : '\u274C') + '</td>' +
          '<td>' + (c.ownerOnly ? '\uD83D\uDD12' : '-') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div></div>';
      setTabContent(html);
    }).catch(function () {
      setTabContent('<div class="empty-state"><span class="empty-state-emoji">\u26A0\uFE0F</span><h3>Failed to load inventory</h3></div>');
    });
  }

  function loadPolicies() {
    setTabContent('<div class="loading" style="text-align:center;padding:32px;"><div class="spinner"></div><p>Loading policies...</p></div>');
    apiGet(API_PREFIX + '/policies').then(function (res) {
      var data = extractData(res);
      var policies = data && data.policies ? data.policies : (Array.isArray(data) ? data : []);
      if (!policies.length) { setTabContent('<div class="empty-state"><span class="empty-state-emoji">\uD83D\uDCDC</span><h3>No policies configured</h3></div>'); return; }
      var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDCDC Privacy Policies</h3>' +
        '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:12px;">' +
        '<thead><tr><th>Category</th><th>Allowed Roles</th><th>Owner Only</th><th>Agent Access</th><th>Dashboard Access</th><th>Export</th><th>Archive</th><th>Delete Request</th></tr></thead><tbody>';
      policies.forEach(function (p) {
        var pol = p.policy || p;
        var roles = (pol.allowedRoles || []).join(', ');
        html += '<tr>' +
          '<td>' + esc(p.category || pol.dataCategory || '-') + '</td>' +
          '<td>' + esc(roles || '-') + '</td>' +
          '<td>' + (pol.ownerOnly ? '\uD83D\uDD12' : '-') + '</td>' +
          '<td>' + (pol.allowAgentAccess ? '\u2705' : '\u274C') + '</td>' +
          '<td>' + (pol.allowDashboardAccess ? '\u2705' : '\u274C') + '</td>' +
          '<td>' + (pol.allowExport ? '\u2705' : '\u274C') + '</td>' +
          '<td>' + (pol.allowArchive ? '\u2705' : '\u274C') + '</td>' +
          '<td>' + (pol.allowDeleteRequest ? '\u2705' : '\u274C') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div></div>';
      setTabContent(html);
    }).catch(function () {
      setTabContent('<div class="empty-state"><span class="empty-state-emoji">\u26A0\uFE0F</span><h3>Failed to load policies</h3></div>');
    });
  }

  function loadRetention() {
    setTabContent('<div class="loading" style="text-align:center;padding:32px;"><div class="spinner"></div><p>Loading retention policies...</p></div>');
    apiGet(API_PREFIX + '/retention').then(function (res) {
      var data = extractData(res);
      var policies = data && data.policies ? data.policies : (Array.isArray(data) ? data : []);
      if (!policies.length) { setTabContent('<div class="empty-state"><span class="empty-state-emoji">\u23F3</span><h3>No retention policies</h3></div>'); return; }
      var html = '<div class="panel"><h3 class="panel-title">\u23F3 Retention Policies</h3>' +
        '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:12px;">' +
        '<thead><tr><th>Category</th><th>Retention Days</th><th>Archive After</th><th>Delete After</th><th>Hard Delete</th><th>Requires Approval</th><th>Default Action</th></tr></thead><tbody>';
      policies.forEach(function (p) {
        var pol = p.policy || p;
        html += '<tr>' +
          '<td>' + esc(p.category || pol.dataCategory || '-') + '</td>' +
          '<td>' + esc(pol.retentionDays ?? '-') + '</td>' +
          '<td>' + esc(pol.archiveAfterDays ?? '-') + '</td>' +
          '<td>' + esc(pol.deleteAfterDays ?? '-') + '</td>' +
          '<td>' + (pol.hardDeleteAllowed ? '\u2705' : '\u274C') + '</td>' +
          '<td>' + (pol.requiresApprovalForDelete ? '\u2705' : '\u274C') + '</td>' +
          '<td>' + statusBadge(pol.defaultAction || 'keep') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div></div>';
      setTabContent(html);
    }).catch(function () {
      setTabContent('<div class="empty-state"><span class="empty-state-emoji">\u26A0\uFE0F</span><h3>Failed to load retention policies</h3></div>');
    });
  }

  function loadRetentionCandidates() {
    setTabContent('<div class="loading" style="text-align:center;padding:32px;"><div class="spinner"></div><p>Finding retention candidates...</p></div>');
    apiGet(API_PREFIX + '/retention-candidates').then(function (res) {
      var data = extractData(res);
      if (!data) { setTabContent('<div class="empty-state"><span class="empty-state-emoji">\u274C</span><h3>No candidates found</h3></div>'); return; }
      var candidates = data.candidates || [];
      var plan = data.plan || {};
      var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDDD1\uFE0F Retention Candidates</h3>';
      if (plan.id) {
        html += '<div style="margin-bottom:12px;font-size:12px;color:var(--text-secondary);">Plan ID: <code>' + esc(plan.id) + '</code></div>';
      }
      if (!candidates.length) {
        html += '<div class="empty-state" style="padding:16px;"><span class="empty-state-emoji">\u2705</span><h3>No retention candidates at this time</h3></div>';
      } else {
        html += '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:12px;">' +
          '<thead><tr><th>Category</th><th>Stale Count</th><th>Retention (days)</th><th>Default Action</th></tr></thead><tbody>';
        candidates.forEach(function (c) {
          var pol = c.policy || {};
          html += '<tr>' +
            '<td>' + esc(c.category || '-') + '</td>' +
            '<td>' + esc(c.staleCount ?? 0) + '</td>' +
            '<td>' + esc(pol.retentionDays ?? '-') + '</td>' +
            '<td>' + statusBadge(pol.defaultAction || 'keep') + '</td>' +
          '</tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div>';
      if (plan.candidates && plan.candidates.length) {
        html += '<div class="panel" style="margin-top:12px;"><h3 class="panel-title">\uD83D\uDCCB Action Plan</h3>' +
          '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:12px;">' +
          '<thead><tr><th>Category</th><th>Action</th><th>Count</th></tr></thead><tbody>';
        plan.candidates.forEach(function (pc) {
          html += '<tr><td>' + esc(pc.category || '-') + '</td><td>' + statusBadge(pc.action || 'keep') + '</td><td>' + esc(pc.count ?? 0) + '</td></tr>';
        });
        html += '</tbody></table></div></div>';
      }
      setTabContent(html);
    }).catch(function () {
      setTabContent('<div class="empty-state"><span class="empty-state-emoji">\u26A0\uFE0F</span><h3>Failed to load retention candidates</h3></div>');
    });
  }

  function showExportForm() {
    var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDCE4 Request Data Export</h3>' +
      '<form id="export-form" style="display:grid;gap:12px;max-width:500px;">' +
        '<label style="font-size:13px;">Categories (comma-separated)</label>' +
        '<input type="text" id="export-categories" class="form-input" placeholder="e.g. telegram_messages, lifeos_tasks" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);">' +
        '<label style="font-size:13px;">Reason for export</label>' +
        '<textarea id="export-reason" class="form-textarea" rows="3" placeholder="Describe why this export is needed..." style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);"></textarea>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<input type="checkbox" id="export-include-sensitive" style="accent-color:var(--color-primary);">' +
          '<label for="export-include-sensitive" style="font-size:13px;">Include sensitive data (owner only)</label>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary" style="width:fit-content;">\uD83D\uDCE4 Submit Export Request</button>' +
      '</form></div>' +
      '<div id="export-results" style="margin-top:12px;"></div>';
    setTabContent(html);

    var form = document.getElementById('export-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitExportRequest();
      });
    }

    loadExportRequests();
  }

  function submitExportRequest() {
    var categoriesInput = document.getElementById('export-categories');
    var reasonInput = document.getElementById('export-reason');
    var sensitiveCheck = document.getElementById('export-include-sensitive');
    if (!categoriesInput) return;
    var categories = categoriesInput.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!categories.length) { Utils.showToast('Enter at least one category', 'warning'); return; }
    var body = { categories: categories, reason: reasonInput ? reasonInput.value : '', includeSensitive: sensitiveCheck ? sensitiveCheck.checked : false };
    apiPost(API_PREFIX + '/export-request', body).then(function (res) {
      if (res && res.ok) {
        Utils.showToast('Export request submitted', 'success');
        categoriesInput.value = '';
        if (reasonInput) reasonInput.value = '';
        if (sensitiveCheck) sensitiveCheck.checked = false;
        loadExportRequests();
      } else {
        Utils.showToast('Export request failed: ' + (res?.error || 'Unknown'), 'danger');
      }
    }).catch(function (err) {
      Utils.showToast('Export error: ' + (err.message || 'Unknown'), 'danger');
    });
  }

  function loadExportRequests() {
    var area = document.getElementById('export-results');
    if (!area) return;
    apiGet(API_PREFIX + '/export-requests').then(function (res) {
      var data = extractData(res);
      var exports = data && data.exports ? data.exports : (Array.isArray(data) ? data : []);
      if (!exports.length) { area.innerHTML = '<div class="empty-state" style="padding:16px;"><span class="empty-state-emoji">\uD83D\uDCE4</span><h3>No export requests yet</h3></div>'; return; }
      var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDCCB Recent Export Requests</h3>' +
        '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:12px;">' +
        '<thead><tr><th>ID</th><th>Categories</th><th>Status</th><th>Created</th></tr></thead><tbody>';
      exports.forEach(function (e) {
        html += '<tr>' +
          '<td><code>' + esc(e.id || '-').slice(0, 12) + '</code></td>' +
          '<td>' + esc((e.categories || []).join(', ')) + '</td>' +
          '<td>' + statusBadge(e.status || 'pending') + '</td>' +
          '<td>' + (e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '-') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div></div>';
      area.innerHTML = html;
    }).catch(function () {
      // silent
    });
  }

  function showArchiveForm() {
    var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDDC4\uFE0F Create Archive Plan</h3>' +
      '<form id="archive-form" style="display:grid;gap:12px;max-width:500px;">' +
        '<label style="font-size:13px;">Categories to archive (comma-separated)</label>' +
        '<input type="text" id="archive-categories" class="form-input" placeholder="e.g. telegram_messages, agent_memory" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);">' +
        '<label style="font-size:13px;">Notes</label>' +
        '<textarea id="archive-notes" class="form-textarea" rows="2" placeholder="Optional notes..." style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);"></textarea>' +
        '<button type="submit" class="btn btn-primary" style="width:fit-content;">\uD83D\uDDC4\uFE0F Create Archive Plan</button>' +
      '</form></div>' +
      '<div id="archive-results" style="margin-top:12px;"></div>';
    setTabContent(html);

    var form = document.getElementById('archive-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitArchivePlan();
      });
    }

    loadArchivePlans();
  }

  function submitArchivePlan() {
    var categoriesInput = document.getElementById('archive-categories');
    var notesInput = document.getElementById('archive-notes');
    if (!categoriesInput) return;
    var categories = categoriesInput.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!categories.length) { Utils.showToast('Enter at least one category', 'warning'); return; }
    var body = { categories: categories, notes: notesInput ? notesInput.value : '' };
    apiPost(API_PREFIX + '/archive-plan', body).then(function (res) {
      if (res && res.ok) {
        Utils.showToast('Archive plan created', 'success');
        categoriesInput.value = '';
        if (notesInput) notesInput.value = '';
        loadArchivePlans();
      } else {
        Utils.showToast('Archive plan failed: ' + (res?.error || 'Unknown'), 'danger');
      }
    }).catch(function (err) {
      Utils.showToast('Archive error: ' + (err.message || 'Unknown'), 'danger');
    });
  }

  function loadArchivePlans() {
    var area = document.getElementById('archive-results');
    if (!area) return;
    apiGet(API_PREFIX + '/archive-plans').then(function (res) {
      var data = extractData(res);
      var plans = data && data.plans ? data.plans : (Array.isArray(data) ? data : []);
      if (!plans.length) { area.innerHTML = '<div class="empty-state" style="padding:16px;"><span class="empty-state-emoji">\uD83D\uDDC4\uFE0F</span><h3>No archive plans yet</h3></div>'; return; }
      var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDCCB Archive Plans</h3>' +
        '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:12px;">' +
        '<thead><tr><th>ID</th><th>Categories</th><th>Status</th><th>Created</th></tr></thead><tbody>';
      plans.forEach(function (p) {
        html += '<tr>' +
          '<td><code>' + esc(p.id || '-').slice(0, 12) + '</code></td>' +
          '<td>' + esc((p.categories || []).join(', ')) + '</td>' +
          '<td>' + statusBadge(p.status || 'draft') + '</td>' +
          '<td>' + (p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div></div>';
      area.innerHTML = html;
    }).catch(function () {
      // silent
    });
  }

  function showDeleteForm() {
    var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDDD1\uFE0F Request Data Deletion</h3>' +
      '<div style="margin-bottom:12px;padding:8px 12px;background:var(--bg-primary);border-radius:8px;font-size:12px;color:var(--text-secondary);">' +
        'Only soft delete is available from the dashboard. Hard delete requests require owner approval.' +
      '</div>' +
      '<form id="delete-form" style="display:grid;gap:12px;max-width:500px;">' +
        '<label style="font-size:13px;">Categories to delete (comma-separated)</label>' +
        '<input type="text" id="delete-categories" class="form-input" placeholder="e.g. lifeos_mood_energy, personal_goals" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);">' +
        '<label style="font-size:13px;">Reason for deletion</label>' +
        '<textarea id="delete-reason" class="form-textarea" rows="3" placeholder="Why should this data be deleted?" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);"></textarea>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<input type="checkbox" id="delete-hard" style="accent-color:var(--color-danger);">' +
          '<label for="delete-hard" style="font-size:13px;color:var(--color-danger);">Request hard delete (owner only, requires approval)</label>' +
        '</div>' +
        '<button type="submit" class="btn btn-danger" style="width:fit-content;background:var(--color-danger);color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;">\u26A0\uFE0F Submit Delete Request</button>' +
      '</form></div>' +
      '<div id="delete-results" style="margin-top:12px;"></div>';
    setTabContent(html);

    var form = document.getElementById('delete-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitDeleteRequest();
      });
    }

    loadDeleteRequests();
  }

  function submitDeleteRequest() {
    var categoriesInput = document.getElementById('delete-categories');
    var reasonInput = document.getElementById('delete-reason');
    var hardCheck = document.getElementById('delete-hard');
    if (!categoriesInput) return;
    var categories = categoriesInput.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!categories.length) { Utils.showToast('Enter at least one category', 'warning'); return; }
    var body = { categories: categories, reason: reasonInput ? reasonInput.value : '', hardDeleteRequested: hardCheck ? hardCheck.checked : false };
    apiPost(API_PREFIX + '/delete-request', body).then(function (res) {
      if (res && res.ok) {
        Utils.showToast('Delete request submitted', 'success');
        categoriesInput.value = '';
        if (reasonInput) reasonInput.value = '';
        if (hardCheck) hardCheck.checked = false;
        loadDeleteRequests();
      } else {
        Utils.showToast('Delete request failed: ' + (res?.error || 'Unknown'), 'danger');
      }
    }).catch(function (err) {
      Utils.showToast('Delete error: ' + (err.message || 'Unknown'), 'danger');
    });
  }

  function loadDeleteRequests() {
    var area = document.getElementById('delete-results');
    if (!area) return;
    apiGet(API_PREFIX + '/delete-requests').then(function (res) {
      var data = extractData(res);
      var requests = data && data.deleteRequests ? data.deleteRequests : (Array.isArray(data) ? data : []);
      if (!requests.length) { area.innerHTML = '<div class="empty-state" style="padding:16px;"><span class="empty-state-emoji">\uD83D\uDDD1\uFE0F</span><h3>No delete requests yet</h3></div>'; return; }
      var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDCCB Delete Requests</h3>' +
        '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:12px;">' +
        '<thead><tr><th>ID</th><th>Categories</th><th>Type</th><th>Status</th><th>Created</th></tr></thead><tbody>';
      requests.forEach(function (r) {
        html += '<tr>' +
          '<td><code>' + esc(r.id || '-').slice(0, 12) + '</code></td>' +
          '<td>' + esc((r.categories || []).join(', ')) + '</td>' +
          '<td>' + (r.hardDeleteRequested ? '<span class="badge badge-danger">Hard</span>' : '<span class="badge badge-warning">Soft</span>') + '</td>' +
          '<td>' + statusBadge(r.status || 'pending') + '</td>' +
          '<td>' + (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div></div>';
      area.innerHTML = html;
    }).catch(function () {
      // silent
    });
  }

  function loadAudit() {
    setTabContent('<div class="loading" style="text-align:center;padding:32px;"><div class="spinner"></div><p>Loading audit log...</p></div>');
    apiGet(API_PREFIX + '/audit').then(function (res) {
      var data = extractData(res);
      if (!data) { setTabContent('<div class="empty-state"><span class="empty-state-emoji">\u274C</span><h3>Failed to load audit log</h3></div>'); return; }
      var events = data.events || (Array.isArray(data) ? data : []);
      var summary = data.summary || {};
      var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDCDD Privacy Audit Log</h3>';
      if (summary.total !== undefined) {
        html += '<div style="display:flex;gap:16px;margin-bottom:12px;font-size:13px;">' +
          '<span><strong>Total:</strong> ' + esc(summary.total) + '</span>';
        if (summary.byType) {
          Object.keys(summary.byType).forEach(function (t) {
            html += '<span><strong>' + esc(t.replace(/_/g, ' ')) + ':</strong> ' + esc(summary.byType[t]) + '</span>';
          });
        }
        html += '</div>';
      }
      if (!events.length) {
        html += '<div class="empty-state" style="padding:16px;"><span class="empty-state-emoji">\uD83D\uDCDD</span><h3>No audit events recorded</h3></div>';
      } else {
        html += '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:12px;">' +
          '<thead><tr><th>ID</th><th>Type</th><th>User</th><th>Details</th><th>Timestamp</th></tr></thead><tbody>';
        events.forEach(function (e) {
          html += '<tr>' +
            '<td><code>' + esc(e.id || '-').slice(0, 10) + '</code></td>' +
            '<td>' + statusBadge(e.type || 'unknown') + '</td>' +
            '<td>' + esc(e.userId || e.user || '-') + '</td>' +
            '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(JSON.stringify(e.details || {})) + '</td>' +
            '<td style="white-space:nowrap;">' + (e.timestamp ? new Date(e.timestamp).toLocaleString() : '-') + '</td>' +
          '</tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div>';
      setTabContent(html);
    }).catch(function () {
      setTabContent('<div class="empty-state"><span class="empty-state-emoji">\u26A0\uFE0F</span><h3>Failed to load audit log</h3></div>');
    });
  }

  function renderClassificationResults(data) {
    var results = data.results || [];
    var summary = data.summary || {};
    var html = '<div class="panel"><h3 class="panel-title">\uD83C\uDFF7\uFE0F Classification Results</h3>';
    if (summary.total !== undefined) {
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;font-size:13px;">' +
        '<span><strong>Total:</strong> ' + esc(summary.total) + '</span>';
      if (summary.counts) {
        Object.keys(summary.counts).forEach(function (k) {
          html += '<span>' + statusBadge(k) + ' <strong>' + esc(summary.counts[k]) + '</strong></span>';
        });
      }
      html += '</div>';
    }
    if (!results.length) {
      html += '<div class="empty-state" style="padding:16px;"><span class="empty-state-emoji">\uD83C\uDFF7\uFE0F</span><h3>No classification data</h3></div>';
    } else {
      html += '<div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:12px;">' +
        '<thead><tr><th>Category</th><th>Classification</th></tr></thead><tbody>';
      results.forEach(function (r) {
        html += '<tr>' +
          '<td>' + esc(r.category || '-') + '</td>' +
          '<td>' + statusBadge(r.classification || 'internal') + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
    setTabContent(html);
  }

  function renderReport(data) {
    var report = data.report || data;
    var html = '<div class="panel"><h3 class="panel-title">\uD83D\uDCC4 Privacy Report</h3>' +
      '<div class="kv-list">';
    Object.keys(report).forEach(function (k) {
      if (k === 'id' || k === 'type') return;
      var val = report[k];
      if (typeof val === 'object') val = JSON.stringify(val);
      html += '<div class="kv-item"><span class="kv-key">' + esc(k.replace(/_/g, ' ')) + '</span><span class="kv-value">' + esc(val) + '</span></div>';
    });
    html += '</div></div>';
    setTabContent(html);
  }

  // Register
  if (window.UI) window.UI.renderPrivacy = window.renderPrivacy;
})();
