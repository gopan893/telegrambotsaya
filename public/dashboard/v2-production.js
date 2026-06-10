/* V2 Production Release Dashboard Renderer */

(function() {
  const API = '/api/dashboard/v2-production';

  UI.renderV2Production = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading V2 production release...');
    try {
      const statusRes = await Api.fetch(API);
      let releaseData = null;
      if (statusRes.ok && statusRes.data) {
        releaseData = statusRes.data;
      }

      let html = '';
      html += '<div class="section-header"><h2>V2 Production Release</h2></div>';

      html += buildReleaseStatusSection(releaseData);
      html += buildCreateReleaseSection(releaseData);
      html += buildReadinessGateSection(releaseData);
      html += buildRolloutPlanSection(releaseData);
      html += buildGitHubProposalSection(releaseData);
      html += buildDeployProposalSection(releaseData);
      html += buildVerificationSection(releaseData);
      html += buildRollbackPlanSection(releaseData);
      html += buildAnnouncementSection(releaseData);

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-outline" onclick="UI.renderV2Production(document.getElementById(\'tab-content\'))">Refresh</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('V2 Production Error', err.message);
    }
  };

  function buildReleaseStatusSection(data) {
    if (!data) return UI.renderEmptyState('', 'Production Release', 'No production release data. Create a new release to begin.');
    const status = data.status || 'draft';
    const badgeColors = {
      ready: 'var(--color-success)',
      blocked: 'var(--color-danger)',
      warning: 'var(--color-warning)',
      draft: 'var(--color-info)',
      checking: 'var(--color-info)'
    };
    const color = badgeColors[status] || 'var(--color-warning)';
    let html = '<div class="section-header" style="margin-top:16px;"><h3>Release Status</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<span class="badge" style="background:' + color + ';color:#fff;font-size:14px;padding:4px 12px;">' + Utils.escapeHtml(status.toUpperCase()) + '</span>';
    html += '<div class="stat-label" style="margin-top:8px;">Release Status</div>';
    html += '</div></div>';
    if (data.version) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value">' + Utils.escapeHtml(data.version) + '</div>';
      html += '<div class="stat-label">Version</div>';
      html += '</div></div>';
    }
    if (data.blockerCount !== undefined) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="color:' + (data.blockerCount > 0 ? 'var(--color-danger)' : 'var(--color-success)') + ';">' + data.blockerCount + '</div>';
      html += '<div class="stat-label">Blockers</div>';
      html += '</div></div>';
    }
    if (data.warningCount !== undefined) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="color:' + (data.warningCount > 0 ? 'var(--color-warning)' : 'var(--color-success)') + ';">' + data.warningCount + '</div>';
      html += '<div class="stat-label">Warnings</div>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function buildCreateReleaseSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Create Release</h3></div>';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">';
    html += '<button class="btn btn-primary" onclick="createV2ProductionRelease()">Create New Production Release</button>';
    html += '<span style="font-size:12px;color:var(--text-muted);">Checks Phase 65.5 RC stabilization readiness first.</span>';
    html += '</div>';
    return html;
  }

  function buildReadinessGateSection(data) {
    if (!data) return '';
    const readyStatus = data.readinessStatus;
    if (!readyStatus) return '';
    const color = readyStatus === 'ready' ? 'var(--color-success)' : readyStatus === 'blocked' ? 'var(--color-danger)' : 'var(--color-warning)';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Readiness Gate</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + color + ';">' + Utils.escapeHtml(readyStatus.toUpperCase()) + '</div>';
    html += '<div class="stat-label">Readiness Status</div>';
    html += '</div></div>';
    return html;
  }

  function buildRolloutPlanSection(data) {
    if (!data) return '';
    const rolloutStatus = data.rolloutStatus;
    if (!rolloutStatus) return '';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Rollout Plan</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + Utils.escapeHtml(rolloutStatus) + '</div>';
    html += '<div class="stat-label">Rollout Status</div>';
    html += '</div></div>';
    return html;
  }

  function buildGitHubProposalSection(data) {
    if (!data) return '';
    const ghId = data.githubReleaseProposalId;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>GitHub Tag/Release Proposal</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (ghId) {
      html += '<p style="color:var(--color-warning);">Proposal created: ' + Utils.escapeHtml(ghId) + '</p>';
    } else {
      html += '<p>No proposal created yet.</p>';
    }
    html += '<p style="font-size:12px;color:var(--text-muted);font-style:italic;">PROPOSAL ONLY — No GitHub tag or release was created.</p>';
    html += '</div></div>';
    return html;
  }

  function buildDeployProposalSection(data) {
    if (!data) return '';
    const depId = data.deployProposalId;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Deploy Proposal</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (depId) {
      html += '<p style="color:var(--color-warning);">Proposal created: ' + Utils.escapeHtml(depId) + '</p>';
    } else {
      html += '<p>No deploy proposal created yet.</p>';
    }
    html += '<p style="font-size:12px;color:var(--text-muted);font-style:italic;">PROPOSAL ONLY — No direct deploy was triggered.</p>';
    html += '</div></div>';
    return html;
  }

  function buildVerificationSection(data) {
    if (!data) return '';
    const verStatus = data.verificationStatus;
    if (!verStatus) return '';
    const color = verStatus === 'passed' ? 'var(--color-success)' : 'var(--color-danger)';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Verification</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + color + ';">' + Utils.escapeHtml(verStatus.toUpperCase()) + '</div>';
    html += '<div class="stat-label">Verification Status</div>';
    html += '</div></div>';
    return html;
  }

  function buildRollbackPlanSection(data) {
    if (!data) return '';
    const rlId = data.rollbackProposalId;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Rollback Plan</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (rlId) {
      html += '<p style="color:var(--color-warning);">Rollback proposal: ' + Utils.escapeHtml(rlId) + '</p>';
    } else {
      html += '<p>No rollback proposal created yet.</p>';
    }
    html += '<p style="font-size:12px;color:var(--text-muted);font-style:italic;">PROPOSAL ONLY — No direct rollback was executed.</p>';
    html += '</div></div>';
    return html;
  }

  function buildAnnouncementSection(data) {
    if (!data) return '';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Release Announcement</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<p>Generate announcement via the API to preview release notes, operator summary, and known limitations.</p>';
    html += '</div></div>';
    return html;
  }

  window.createV2ProductionRelease = async function() {
    const container = document.getElementById('tab-content');
    if (!container) return;
    container.innerHTML = UI.renderLoading('Creating production release...');
    try {
      const res = await Api.fetch(API + '/create', { method: 'POST' });
      if (res.ok) {
        UI.renderV2Production(container);
        Utils.showToast('Production release created', 'success');
      } else {
        Utils.showToast('Failed: ' + (res.error || 'Phase 65.5 not ready'), 'error');
        UI.renderV2Production(container);
      }
    } catch (err) {
      Utils.showToast('Error: ' + err.message, 'error');
      UI.renderV2Production(container);
    }
  };
})();
