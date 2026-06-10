/* Post-V2 Watch Dashboard Renderer */

(function() {
  const API = '/api/dashboard/post-v2';

  UI.renderPostV2 = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading Post-V2 watch...');
    try {
      const statusRes = await Api.fetch(API);
      let watchData = null;
      let reportData = null;
      if (statusRes.ok && statusRes.data) {
        watchData = statusRes.data;
      }
      try {
        const reportRes = await Api.fetch(API + '/' + (watchData ? watchData.id : '') + '/report');
        if (reportRes.ok) reportData = reportRes.data;
      } catch (_) {}

      let html = '';
      html += '<div class="section-header"><h2>Post-V2 Watch</h2></div>';

      html += buildActiveWatchSection(watchData);
      html += buildStartWatchButton(watchData);
      html += buildHealthWindowSection(reportData);
      html += buildRegressionSection(reportData);
      html += buildStatusSections(reportData);
      html += buildPerformanceSection(reportData);
      html += buildSecurityPrivacySection(reportData);
      html += buildReliabilityScorecardSection(reportData);
      html += buildIncidentsSection(reportData);
      html += buildRollbackAdvisorSection(reportData);

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-outline" onclick="UI.renderPostV2(document.getElementById(\'tab-content\'))">Refresh</button>';
      if (watchData && watchData.id) {
        html += '<button class="btn btn-primary" onclick="runPostV2Cycle(\'' + Utils.escapeHtml(watchData.id) + '\')">Run Cycle</button>';
      }
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('Post-V2 Watch Error', err.message);
    }
  };

  function buildActiveWatchSection(data) {
    if (!data) return UI.renderEmptyState('', 'Active Watch', 'No active watch. Start a new watch to begin.');
    const status = data.status || 'idle';
    const badgeColors = {
      watching: 'var(--color-success)',
      checking: 'var(--color-info)',
      warning: 'var(--color-warning)',
      blocked: 'var(--color-danger)',
      idle: 'var(--color-info)'
    };
    const color = badgeColors[status] || 'var(--color-warning)';
    let html = '<div class="section-header" style="margin-top:16px;"><h3>Active Watch Status</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<span class="badge" style="background:' + color + ';color:#fff;font-size:14px;padding:4px 12px;">' + Utils.escapeHtml(status.toUpperCase()) + '</span>';
    html += '<div class="stat-label" style="margin-top:8px;">Watch Status</div>';
    html += '</div></div>';
    if (data.version) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value">' + Utils.escapeHtml(data.version) + '</div>';
      html += '<div class="stat-label">Version</div>';
      html += '</div></div>';
    }
    if (data.incidents !== undefined) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="color:' + (data.incidents > 0 ? 'var(--color-danger)' : 'var(--color-success)') + ';">' + data.incidents + '</div>';
      html += '<div class="stat-label">Incidents</div>';
      html += '</div></div>';
    }
    if (data.releaseId) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="font-size:14px;">' + Utils.escapeHtml(data.releaseId) + '</div>';
      html += '<div class="stat-label">Release ID</div>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function buildStartWatchButton(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Start Watch</h3></div>';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">';
    html += '<button class="btn btn-primary" onclick="startPostV2Watch()">Start New Watch</button>';
    html += '</div>';
    return html;
  }

  function buildHealthWindowSection(reportData) {
    if (!reportData || !reportData.watch) return '';
    const hw = reportData.watch.healthWindow;
    if (!hw) return '';
    const color = hw.status === 'open' ? 'var(--color-success)' : 'var(--color-info)';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Health Window</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + color + ';">' + Utils.escapeHtml(hw.status.toUpperCase()) + '</div>';
    html += '<div class="stat-label">Window Status</div>';
    html += '</div></div>';
    return html;
  }

  function buildRegressionSection(reportData) {
    if (!reportData || !reportData.regressions) return '';
    const reg = reportData.regressions;
    const healthy = reg.healthy;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Regression Watchdog</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (healthy) {
      html += '<p style="color:var(--color-success);font-weight:600;">No regressions detected</p>';
    } else {
      html += '<p style="color:var(--color-danger);font-weight:600;">' + Utils.escapeHtml(reg.severity.toUpperCase()) + ' - ' + (reg.regressions ? reg.regressions.length : 0) + ' regression(s)</p>';
      if (reg.regressions) {
        reg.regressions.forEach(function(r) {
          html += '<p style="font-size:13px;margin-top:4px;">' + Utils.escapeHtml(r.module) + ': ' + Utils.escapeHtml(JSON.stringify(r.issues || [])) + '</p>';
        });
      }
    }
    html += '</div></div>';
    return html;
  }

  function buildStatusSections(reportData) {
    if (!reportData) return '';
    const sections = [
      { key: 'dashboard', label: 'Dashboard', data: reportData.dashboard },
      { key: 'api', label: 'API', data: reportData.api },
      { key: 'telegram', label: 'Telegram', data: reportData.telegram },
      { key: 'pwa', label: 'PWA', data: reportData.pwa }
    ];
    let html = '';
    for (const sec of sections) {
      if (!sec.data) continue;
      const passed = sec.data.passed;
      const color = passed ? 'var(--color-success)' : 'var(--color-danger)';
      html += '<div class="section-header" style="margin-top:16px;"><h3>' + Utils.escapeHtml(sec.label) + ' Status</h3></div>';
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="color:' + color + ';font-size:16px;">' + (passed ? 'PASSED' : 'FAILED') + '</div>';
      html += '<div class="stat-label">' + Utils.escapeHtml(sec.label) + ' Watchdog</div>';
      if (sec.data.issues && sec.data.issues.length > 0) {
        html += '<ul style="margin-top:8px;font-size:12px;color:var(--color-danger);">';
        sec.data.issues.forEach(function(issue) {
          html += '<li>' + Utils.escapeHtml(issue.detail || issue.type || JSON.stringify(issue)) + '</li>';
        });
        html += '</ul>';
      }
      html += '</div></div>';
    }
    return html;
  }

  function buildPerformanceSection(reportData) {
    if (!reportData || !reportData.performance) return '';
    const perf = reportData.performance;
    const score = perf.score || 0;
    const color = score >= 90 ? 'var(--color-success)' : score >= 70 ? 'var(--color-warning)' : 'var(--color-danger)';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Performance Score</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + color + ';">' + score + '/100</div>';
    html += '<div class="stat-label">' + Utils.escapeHtml(perf.level || 'unknown') + '</div>';
    html += '</div></div>';
    return html;
  }

  function buildSecurityPrivacySection(reportData) {
    if (!reportData || !reportData.securityPrivacy) return '';
    const sec = reportData.securityPrivacy;
    const passed = sec.passed;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Security & Privacy</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + (passed ? 'var(--color-success)' : 'var(--color-danger)') + ';">' + (passed ? 'SECURE' : 'ISSUES DETECTED') + '</div>';
    html += '<div class="stat-label">Security/Privacy Status</div>';
    if (sec.issues && sec.issues.length > 0) {
      html += '<ul style="margin-top:8px;font-size:12px;color:var(--color-danger);">';
      sec.issues.forEach(function(issue) {
        html += '<li>' + Utils.escapeHtml(issue.type + ': ' + (issue.key || issue.path || issue.sample || '')) + '</li>';
      });
      html += '</ul>';
    }
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:8px;">No secrets exposed.</p>';
    html += '</div></div>';
    return html;
  }

  function buildReliabilityScorecardSection(reportData) {
    if (!reportData || !reportData.scorecard) return '';
    const sc = reportData.scorecard;
    const overall = sc.overall || 0;
    const color = overall >= 90 ? 'var(--color-success)' : overall >= 80 ? 'var(--color-warning)' : 'var(--color-danger)';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Reliability Scorecard</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + color + ';">' + overall + '/100</div>';
    html += '<div class="stat-label">Overall Reliability</div>';
    html += '</div></div>';
    if (sc.subscores) {
      for (const [key, val] of Object.entries(sc.subscores)) {
        html += '<div class="card"><div class="card-body">';
        html += '<div class="stat-value" style="font-size:18px;">' + val + '</div>';
        html += '<div class="stat-label">' + Utils.escapeHtml(key.charAt(0).toUpperCase() + key.slice(1)) + '</div>';
        html += '</div></div>';
      }
    }
    html += '</div>';
    return html;
  }

  function buildIncidentsSection(reportData) {
    if (!reportData || !reportData.watch) return '';
    const watch = reportData.watch;
    const incidentCount = watch.incidents || 0;
    const warningCount = watch.warnings || 0;
    if (incidentCount === 0 && warningCount === 0) return '';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Incidents & Warnings</h3></div>';
    html += '<div class="card-grid">';
    if (incidentCount > 0) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="color:var(--color-danger);">' + incidentCount + '</div>';
      html += '<div class="stat-label">Incidents</div>';
      html += '</div></div>';
    }
    if (warningCount > 0) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="color:var(--color-warning);">' + warningCount + '</div>';
      html += '<div class="stat-label">Warnings</div>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function buildRollbackAdvisorSection(reportData) {
    if (!reportData || !reportData.rollbackAdvisor) return '';
    const ra = reportData.rollbackAdvisor;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Rollback Advisor</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (ra.rollbackNeeded) {
      html += '<p style="color:var(--color-danger);font-weight:600;">Rollback recommended: ' + Utils.escapeHtml(ra.reason || '') + '</p>';
    } else {
      html += '<p style="color:var(--color-success);">No rollback needed</p>';
    }
    html += '<p style="font-size:11px;color:var(--text-muted);font-style:italic;margin-top:8px;">PROPOSAL ONLY — No direct rollback. Submit through Evaluation v2 for approval.</p>';
    html += '</div></div>';
    return html;
  }

  window.startPostV2Watch = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Starting Post-V2 watch...');
    try {
      const res = await Api.fetch(API + '/start', { method: 'POST' });
      if (res.ok) {
        UI.renderPostV2(container);
        Utils.showToast('Post-V2 watch started', 'success');
      } else {
        Utils.showToast('Failed to start watch', 'error');
        UI.renderPostV2(container);
      }
    } catch (err) {
      Utils.showToast('Error: ' + err.message, 'error');
      UI.renderPostV2(container);
    }
  };

  window.runPostV2Cycle = async function(watchId) {
    const container = document.getElementById('tab-content');
    if (!container || !watchId) return;
    container.innerHTML = UI.renderLoading('Running Post-V2 watch cycle...');
    try {
      const res = await Api.fetch(API + '/' + watchId + '/cycle', { method: 'POST' });
      if (res.ok) {
        UI.renderPostV2(container);
        Utils.showToast('Cycle completed', 'success');
      } else {
        Utils.showToast('Cycle failed', 'error');
        UI.renderPostV2(container);
      }
    } catch (err) {
      Utils.showToast('Error: ' + err.message, 'error');
      UI.renderPostV2(container);
    }
  };
})();
