/* Release Candidate Dashboard Tab */

const renderReleaseCandidate = (function () {
  function render(targetEl) {
    targetEl.innerHTML = `
      <div class="tab-content">
        <div class="section-header">
          <h2>🚀 Release Candidate Manager</h2>
          <div class="section-actions">
            <button class="btn btn-primary" id="btn-rc-create">+ Create RC</button>
            <button class="btn btn-outline" id="btn-rc-refresh">🔄 Refresh</button>
          </div>
        </div>

        <div id="rc-freeze-panel" class="card" style="margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Release Freeze</h3>
          <div id="rc-freeze-content">${UI.renderLoading()}</div>
        </div>

        <div id="rc-candidates-panel" class="card" style="margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Release Candidates</h3>
          <div id="rc-candidates-content">${UI.renderLoading()}</div>
        </div>

        <div id="rc-detail-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 id="rc-detail-title" style="margin-bottom:8px;">RC Detail</h3>
          <div id="rc-detail-content"></div>
        </div>

        <div id="rc-readiness-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Module Readiness</h3>
          <div id="rc-readiness-content"></div>
        </div>

        <div id="rc-production-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Production Readiness</h3>
          <div id="rc-production-content"></div>
        </div>

        <div id="rc-compat-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Compatibility</h3>
          <div id="rc-compat-content"></div>
        </div>

        <div id="rc-risk-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Risk Review</h3>
          <div id="rc-risk-content"></div>
        </div>

        <div id="rc-notes-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Release Notes</h3>
          <div id="rc-notes-content"></div>
        </div>

        <div id="rc-changelog-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Changelog</h3>
          <div id="rc-changelog-content"></div>
        </div>

        <div id="rc-env-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Environment Checklist</h3>
          <div id="rc-env-content"></div>
        </div>

        <div id="rc-guide-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Operator Guide</h3>
          <div id="rc-guide-content"></div>
        </div>

        <div id="rc-report-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Release Report</h3>
          <div id="rc-report-content"></div>
        </div>

        <div id="rc-proposal-panel" class="card" style="display:none; margin-bottom:16px;">
          <h3 style="margin-bottom:8px;">Release Proposals</h3>
          <div id="rc-proposal-content"></div>
        </div>
      </div>
    `;

    loadData();
    attachEvents();
  }

  async function loadData() {
    await loadFreezeStatus();
    await loadCandidates();
  }

  async function loadFreezeStatus() {
    const el = $('#rc-freeze-content');
    if (!el) return;

    try {
      const res = await Api.fetch('/api/dashboard/release-candidate/freeze-status');
      const data = res.ok ? res.data : { freezeActive: false };

      if (data && data.freezeActive) {
        el.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <span class="badge badge-danger">FREEZE ACTIVE</span>
            <span>Started: ${Utils.escapeHtml(data.startedAt || data.report?.startedAt || 'unknown')}</span>
            <button class="btn btn-outline btn-sm" id="btn-rc-end-freeze">End Freeze</button>
            <button class="btn btn-outline btn-sm" id="btn-rc-freeze-report">View Report</button>
          </div>
        `;
      } else {
        el.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <span class="badge badge-success">FREEZE INACTIVE</span>
            <button class="btn btn-primary btn-sm" id="btn-rc-start-freeze">Start Release Freeze</button>
          </div>
        `;
      }
    } catch (err) {
      el.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function loadCandidates() {
    const el = $('#rc-candidates-content');
    if (!el) return;

    try {
      const res = await Api.fetch('/api/dashboard/release-candidate');
      const data = res.ok ? res.data : { candidates: [], latest: null };
      const candidates = data.candidates || [];

      if (candidates.length === 0) {
        el.innerHTML = UI.renderEmptyState('📋', 'No Release Candidates', 'Create your first release candidate for v1.0.0-rc.1');
        return;
      }

      let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
      for (const c of candidates) {
        const statusClass = c.status === 'ready' ? 'badge-success' : c.status === 'blocked' ? 'badge-danger' : c.status === 'draft' ? 'badge-warning' : 'badge-info';
        const blockerCount = (c.blockers || []).length;

        html += `
          <div class="card" style="cursor:pointer; padding:12px; border:1px solid var(--border-color);" data-rc-id="${Utils.escapeHtml(c.id)}">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <strong>${Utils.escapeHtml(c.version)}</strong>
                <span style="margin-left:8px;">${Utils.escapeHtml(c.title)}</span>
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <span class="badge ${statusClass}">${Utils.escapeHtml(c.status)}</span>
                ${blockerCount > 0 ? `<span class="badge badge-danger">${blockerCount} blocker(s)</span>` : ''}
              </div>
            </div>
            <div style="margin-top:8px; font-size:12px; color:var(--text-secondary);">
              Created: ${Utils.escapeHtml(c.createdAt || 'unknown')}
              ${c.moduleReadinessStatus ? ' | Readiness: ' + (c.moduleReadinessStatus.score || 'N/A') + '%' : ''}
              ${c.blockers && c.blockers.length > 0 ? ' | Blockers: ' + c.blockers.join(', ') : ''}
            </div>
            <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-sm btn-outline btn-rc-detail" data-rc-id="${Utils.escapeHtml(c.id)}">Detail</button>
              <button class="btn btn-sm btn-outline btn-rc-readiness" data-rc-id="${Utils.escapeHtml(c.id)}">Readiness</button>
              <button class="btn btn-sm btn-outline btn-rc-production" data-rc-id="${Utils.escapeHtml(c.id)}">Prod Gate</button>
              <button class="btn btn-sm btn-outline btn-rc-compat" data-rc-id="${Utils.escapeHtml(c.id)}">Compat</button>
              <button class="btn btn-sm btn-outline btn-rc-risk" data-rc-id="${Utils.escapeHtml(c.id)}">Risk</button>
              <button class="btn btn-sm btn-outline btn-rc-notes" data-rc-id="${Utils.escapeHtml(c.id)}">Notes</button>
              <button class="btn btn-sm btn-outline btn-rc-changelog" data-rc-id="${Utils.escapeHtml(c.id)}">Changelog</button>
              <button class="btn btn-sm btn-outline btn-rc-env" data-rc-id="${Utils.escapeHtml(c.id)}">Env</button>
              <button class="btn btn-sm btn-outline btn-rc-guide" data-rc-id="${Utils.escapeHtml(c.id)}">Guide</button>
              <button class="btn btn-sm btn-outline btn-rc-report" data-rc-id="${Utils.escapeHtml(c.id)}">Report</button>
              <button class="btn btn-sm btn-outline btn-rc-proposal" data-rc-id="${Utils.escapeHtml(c.id)}">Proposal</button>
            </div>
          </div>
        `;
      }
      html += '</div>';
      el.innerHTML = html;
    } catch (err) {
      el.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function loadDetail(id) {
    const panel = $('#rc-detail-panel');
    const content = $('#rc-detail-content');
    if (!panel || !content) return;

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}`);
      const data = res.ok ? res.data : null;
      if (!data || !data.candidate) {
        content.innerHTML = UI.renderError('Not Found', 'Release candidate not found');
        panel.style.display = 'block';
        return;
      }

      const c = data.candidate;
      document.getElementById('rc-detail-title').textContent = `RC Detail: ${c.version}`;

      let html = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div><strong>ID:</strong> ${Utils.escapeHtml(c.id)}</div>
          <div><strong>Version:</strong> ${Utils.escapeHtml(c.version)}</div>
          <div><strong>Title:</strong> ${Utils.escapeHtml(c.title)}</div>
          <div><strong>Status:</strong> <span class="badge badge-${c.status}">${Utils.escapeHtml(c.status)}</span></div>
          <div><strong>Branch:</strong> ${Utils.escapeHtml(c.branch)}</div>
          <div><strong>Commit:</strong> ${Utils.escapeHtml(c.commitSha || 'N/A')}</div>
          <div><strong>Created:</strong> ${Utils.escapeHtml(c.createdAt)}</div>
          <div><strong>Updated:</strong> ${Utils.escapeHtml(c.updatedAt)}</div>
        </div>
      `;

      if (c.blockers && c.blockers.length > 0) {
        html += '<h4 style="margin-top:16px; color:var(--color-danger);">Blockers</h4><ul>';
        for (const b of c.blockers) {
          html += `<li style="color:var(--color-danger);">${Utils.escapeHtml(b)}</li>`;
        }
        html += '</ul>';
      }

      if (c.warnings && c.warnings.length > 0) {
        html += '<h4 style="margin-top:16px; color:var(--color-warning);">Warnings</h4><ul>';
        for (const w of c.warnings) {
          html += `<li style="color:var(--color-warning);">${Utils.escapeHtml(w)}</li>`;
        }
        html += '</ul>';
      }

      content.innerHTML = html;
      panel.style.display = 'block';
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
      panel.style.display = 'block';
    }
  }

  async function runReadiness(id) {
    const panel = $('#rc-readiness-panel');
    const content = $('#rc-readiness-content');
    if (!panel || !content) return;

    content.innerHTML = UI.renderLoading('Running module readiness check...');
    panel.style.display = 'block';

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}/run-readiness`, { method: 'POST' });
      const data = res.ok ? res.data : null;

      if (!data || !data.moduleReadiness) {
        content.innerHTML = UI.renderError('Error', 'Failed to run readiness check');
        return;
      }

      const mr = data.moduleReadiness;
      let html = `
        <div style="margin-bottom:12px;">
          <strong>Score:</strong> ${mr.summary.score}% |
          <strong>Ready:</strong> ${mr.summary.ready} |
          <strong>Degraded:</strong> ${mr.summary.degraded} |
          <strong>Missing (optional):</strong> ${mr.summary.missing_optional} |
          <strong>Blocked:</strong> ${mr.summary.blocked}
          ${mr.summary.allReady ? ' | <span class="badge badge-success">ALL READY</span>' : ' | <span class="badge badge-danger">BLOCKED</span>'}
        </div>
      `;

      if (mr.summary.blockedModules && mr.summary.blockedModules.length > 0) {
        html += '<h4 style="color:var(--color-danger);">Blocked Modules:</h4><ul>';
        for (const m of mr.summary.blockedModules) {
          html += `<li>${Utils.escapeHtml(m)}</li>`;
        }
        html += '</ul>';
      }

      if (mr.details) {
        html += '<table class="data-table" style="margin-top:12px;"><thead><tr><th>Module</th><th>Status</th><th>Optional</th><th>Issues</th></tr></thead><tbody>';
        for (const d of mr.details) {
          const statusClass = d.status === 'ready' ? 'success' : d.status === 'blocked' ? 'danger' : d.status === 'missing_optional' ? 'warning' : 'info';
          html += `<tr><td>${Utils.escapeHtml(d.name)}</td><td><span class="badge badge-${statusClass}">${Utils.escapeHtml(d.status)}</span></td><td>${d.optional ? 'Yes' : 'No'}</td><td>${Utils.escapeHtml(d.errors.join('; ') || d.warnings.join('; ') || '-')}</td></tr>`;
        }
        html += '</tbody></table>';
      }

      if (mr.duplicates && mr.duplicates.length > 0) {
        html += '<h4 style="margin-top:12px;">Duplicate Module Candidates:</h4><ul>';
        for (const d of mr.duplicates) {
          html += `<li>${Utils.escapeHtml(d.a)} <-> ${Utils.escapeHtml(d.b)}: ${Utils.escapeHtml(d.note)}</li>`;
        }
        html += '</ul>';
      }

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function runProductionGate(id) {
    const panel = $('#rc-production-panel');
    const content = $('#rc-production-content');
    if (!panel || !content) return;

    content.innerHTML = UI.renderLoading('Running production readiness gate...');
    panel.style.display = 'block';

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}/run-production-gate`, { method: 'POST' });
      const data = res.ok ? res.data : null;

      if (!data || !data.productionReadiness) {
        content.innerHTML = UI.renderError('Error', 'Failed to run production gate');
        return;
      }

      const pr = data.productionReadiness;
      let html = `
        <div style="margin-bottom:12px;">
          <strong>Average Score:</strong> ${pr.averageScore}% |
          <strong>Gates Passed:</strong> ${pr.releaseGatesPassed ? '<span class="badge badge-success">YES</span>' : '<span class="badge badge-danger">NO</span>'}
          ${pr.allReady ? ' | <span class="badge badge-success">ALL READY</span>' : ' | <span class="badge badge-danger">ISSUES</span>'}
        </div>
      `;

      if (pr.scores) {
        html += '<table class="data-table" style="margin-top:12px;"><thead><tr><th>Gate</th><th>Score</th></tr></thead><tbody>';
        for (const [gate, score] of Object.entries(pr.scores)) {
          const scoreClass = score >= 90 ? 'success' : score >= 50 ? 'warning' : 'danger';
          html += `<tr><td>${Utils.escapeHtml(gate)}</td><td><span class="badge badge-${scoreClass}">${score}%</span></td></tr>`;
        }
        html += '</tbody></table>';
      }

      if (pr.blockers && pr.blockers.length > 0) {
        html += '<h4 style="margin-top:12px; color:var(--color-danger);">Blockers:</h4><ul>';
        for (const b of pr.blockers) {
          html += `<li>${Utils.escapeHtml(typeof b === 'string' ? b : b.message || JSON.stringify(b))}</li>`;
        }
        html += '</ul>';
      }

      if (pr.blockedBy && pr.blockedBy.length > 0) {
        html += '<h4 style="margin-top:12px; color:var(--color-danger);">Critical Blockers:</h4><ul>';
        for (const b of pr.blockedBy) {
          html += `<li>${Utils.escapeHtml(b)}</li>`;
        }
        html += '</ul>';
      }

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function runCompatibility(id) {
    const panel = $('#rc-compat-panel');
    const content = $('#rc-compat-content');
    if (!panel || !content) return;

    content.innerHTML = UI.renderLoading('Running compatibility check...');
    panel.style.display = 'block';

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}/run-compatibility`, { method: 'POST' });
      const data = res.ok ? res.data : null;

      if (!data || !data.compatibility) {
        content.innerHTML = UI.renderError('Error', 'Failed to run compatibility check');
        return;
      }

      const compat = data.compatibility;
      let html = `
        <div style="margin-bottom:12px;">
          <strong>Average Score:</strong> ${compat.averageScore}% |
          <strong>Compatible:</strong> ${compat.compatible ? '<span class="badge badge-success">YES</span>' : '<span class="badge badge-danger">NO</span>'}
        </div>
      `;

      if (compat.scores) {
        html += '<table class="data-table" style="margin-top:12px;"><thead><tr><th>Area</th><th>Score</th></tr></thead><tbody>';
        for (const [area, score] of Object.entries(compat.scores)) {
          const sc = score >= 90 ? 'success' : score >= 50 ? 'warning' : 'danger';
          html += `<tr><td>${Utils.escapeHtml(area)}</td><td><span class="badge badge-${sc}">${score}%</span></td></tr>`;
        }
        html += '</tbody></table>';
      }

      if (compat.issues && compat.issues.length > 0) {
        html += '<h4 style="margin-top:12px; color:var(--color-warning);">Issues:</h4><ul>';
        for (const issue of compat.issues) {
          html += `<li>${Utils.escapeHtml(issue)}</li>`;
        }
        html += '</ul>';
      }

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function runRiskReview(id) {
    const panel = $('#rc-risk-panel');
    const content = $('#rc-risk-content');
    if (!panel || !content) return;

    content.innerHTML = UI.renderLoading('Running risk review...');
    panel.style.display = 'block';

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}/risk-review`, { method: 'POST' });
      const data = res.ok ? res.data : null;

      if (!data || !data.riskSummary) {
        content.innerHTML = UI.renderError('Error', 'Failed to run risk review');
        return;
      }

      const rs = data.riskSummary;
      let html = `
        <div style="margin-bottom:12px;">
          <strong>Total Risks:</strong> ${rs.totalRisks} |
          <strong>Score:</strong> ${rs.averageScore}% |
          <strong>Safe to Release:</strong> ${rs.safeToRelease ? '<span class="badge badge-success">YES</span>' : '<span class="badge badge-danger">NO</span>'}
        </div>
      `;

      const riskCategories = [
        { label: 'Critical', items: rs.critical || [], cls: 'danger' },
        { label: 'High', items: rs.high || [], cls: 'warning' },
        { label: 'Medium', items: rs.medium || [], cls: 'info' },
        { label: 'Low', items: rs.low || [], cls: 'info' }
      ];

      for (const cat of riskCategories) {
        if (cat.items.length > 0) {
          html += `<h4 style="margin-top:12px; color:var(--color-${cat.cls});">${cat.label} Risks:</h4><ul>`;
          for (const risk of cat.items) {
            html += `<li>${Utils.escapeHtml(risk.description || risk.message || JSON.stringify(risk))}</li>`;
          }
          html += '</ul>';
        }
      }

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function loadNotes(id) {
    const panel = $('#rc-notes-panel');
    const content = $('#rc-notes-content');
    if (!panel || !content) return;

    content.innerHTML = UI.renderLoading('Generating release notes...');
    panel.style.display = 'block';

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}/notes`);
      const data = res.ok ? res.data : null;

      if (!data || !data.notes) {
        content.innerHTML = UI.renderError('Error', 'Failed to generate notes');
        return;
      }

      const notes = data.notes;
      let html = `<p><strong>Version:</strong> ${Utils.escapeHtml(notes.version)} | <strong>Date:</strong> ${Utils.escapeHtml(notes.date)}</p>`;

      if (notes.featureSummary) {
        for (const [category, items] of Object.entries(notes.featureSummary)) {
          if (Array.isArray(items) && items.length > 0) {
            html += `<h4 style="margin-top:12px;">${Utils.escapeHtml(category.charAt(0).toUpperCase() + category.slice(1))}</h4><ul>`;
            for (const item of items) {
              html += `<li>${Utils.escapeHtml(item)}</li>`;
            }
            html += '</ul>';
          }
        }
      }

      if (notes.safetySummary) {
        html += '<h4 style="margin-top:12px;">Safety</h4><ul>';
        for (const [, v] of Object.entries(notes.safetySummary)) {
          if (typeof v === 'string') {
            html += `<li>${Utils.escapeHtml(v)}</li>`;
          }
        }
        html += '</ul>';
      }

      if (notes.knownLimitations && notes.knownLimitations.length > 0) {
        html += '<h4 style="margin-top:12px; color:var(--color-warning);">Known Limitations</h4><ul>';
        for (const lim of notes.knownLimitations) {
          html += `<li>${Utils.escapeHtml(lim)}</li>`;
        }
        html += '</ul>';
      }

      if (notes.upgradeNotes && notes.upgradeNotes.length > 0) {
        html += '<h4 style="margin-top:12px;">Upgrade Notes</h4><ul>';
        for (const up of notes.upgradeNotes) {
          html += `<li>${Utils.escapeHtml(up)}</li>`;
        }
        html += '</ul>';
      }

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function loadChangelog(id) {
    const panel = $('#rc-changelog-panel');
    const content = $('#rc-changelog-content');
    if (!panel || !content) return;

    content.innerHTML = UI.renderLoading('Generating changelog...');
    panel.style.display = 'block';

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}/changelog`);
      const data = res.ok ? res.data : null;

      if (!data || !data.changelog) {
        content.innerHTML = UI.renderError('Error', 'Failed to generate changelog');
        return;
      }

      const cl = data.changelog;
      let html = `<p><strong>Version:</strong> ${Utils.escapeHtml(cl.version)} | <strong>Date:</strong> ${Utils.escapeHtml(cl.date)}</p>`;

      if (cl.groupedByPhase && cl.groupedByPhase.length > 0) {
        html += '<h4 style="margin-top:12px;">Phases</h4><div style="max-height:400px; overflow-y:auto;">';
        for (const phase of cl.groupedByPhase) {
          html += `<p><strong>${Utils.escapeHtml(phase.phase)}:</strong> ${Utils.escapeHtml(phase.description)}</p>`;
        }
        html += '</div>';
      }

      if (cl.humanReadable) {
        html += '<h4 style="margin-top:12px;">Changelog</h4><pre style="white-space:pre-wrap; font-size:12px; max-height:400px; overflow-y:auto;">' + Utils.escapeHtml(cl.humanReadable) + '</pre>';
      }

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function loadEnvChecklist(id) {
    const panel = $('#rc-env-panel');
    const content = $('#rc-env-content');
    if (!panel || !content) return;

    content.innerHTML = UI.renderLoading('Generating env checklist...');
    panel.style.display = 'block';

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}/env-checklist`);
      const data = res.ok ? res.data : null;

      if (!data || !data.checklist) {
        content.innerHTML = UI.renderError('Error', 'Failed to generate env checklist');
        return;
      }

      const cl = data.checklist;
      let html = '';

      if (cl.required && cl.required.length > 0) {
        html += '<h4 style="margin-top:12px;">Required</h4><table class="data-table"><thead><tr><th>Name</th><th>Status</th></tr></thead><tbody>';
        for (const env of cl.required) {
          const statusClass = env.configured ? 'success' : 'danger';
          html += `<tr><td><code>${Utils.escapeHtml(env.name)}</code></td><td><span class="badge badge-${statusClass}">${env.configured ? 'Set' : 'Missing'}</span></td></tr>`;
        }
        html += '</tbody></table>';
      }

      if (cl.recommended && cl.recommended.length > 0) {
        html += '<h4 style="margin-top:12px;">Recommended</h4><table class="data-table"><thead><tr><th>Name</th><th>Status</th><th>Expected</th></tr></thead><tbody>';
        for (const env of cl.recommended) {
          const statusClass = env.configured ? 'success' : 'warning';
          html += `<tr><td><code>${Utils.escapeHtml(env.name)}</code></td><td><span class="badge badge-${statusClass}">${env.configured ? 'Set' : 'Not Set'}</span></td><td>${Utils.escapeHtml(env.expectedValue || '-')}</td></tr>`;
        }
        html += '</tbody></table>';
      }

      if (cl.dangerousFlags && cl.dangerousFlags.length > 0) {
        html += '<h4 style="margin-top:12px; color:var(--color-danger);">Dangerous Flags</h4><table class="data-table"><thead><tr><th>Name</th><th>Severity</th><th>Message</th></tr></thead><tbody>';
        for (const flag of cl.dangerousFlags) {
          const sevClass = flag.severity === 'critical' ? 'danger' : flag.severity === 'high' ? 'warning' : 'info';
          html += `<tr><td><code>${Utils.escapeHtml(flag.name)}</code></td><td><span class="badge badge-${sevClass}">${Utils.escapeHtml(flag.severity)}</span></td><td>${Utils.escapeHtml(flag.message)}</td></tr>`;
        }
        html += '</tbody></table>';
      }

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function loadGuide(id) {
    const panel = $('#rc-guide-panel');
    const content = $('#rc-guide-content');
    if (!panel || !content) return;

    content.innerHTML = UI.renderLoading('Loading operator guide...');
    panel.style.display = 'block';

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}/operator-guide`);
      const data = res.ok ? res.data : null;

      if (!data || !data.guides) {
        content.innerHTML = UI.renderError('Error', 'Failed to load operator guide');
        return;
      }

      let html = '';
      for (const [guideName, guide] of Object.entries(data.guides)) {
        html += `<h4 style="margin-top:12px;">${Utils.escapeHtml(guide.title || guideName)}</h4>`;
        if (guide.sections) {
          for (const [section, text] of Object.entries(guide.sections)) {
            html += `<p><strong>${Utils.escapeHtml(section)}:</strong> ${Utils.escapeHtml(text)}</p>`;
          }
        }
        if (guide.categories) {
          for (const [cat, cmds] of Object.entries(guide.categories)) {
            html += `<p><strong>${Utils.escapeHtml(cat)}:</strong> <code>${Utils.escapeHtml(cmds)}</code></p>`;
          }
        }
        if (guide.tabs) {
          for (const [tab, desc] of Object.entries(guide.tabs)) {
            html += `<p><strong>${Utils.escapeHtml(tab)}:</strong> ${Utils.escapeHtml(desc)}</p>`;
          }
        }
        if (guide.flow && Array.isArray(guide.flow)) {
          html += '<ol>';
          for (const step of guide.flow) {
            html += `<li>${Utils.escapeHtml(step)}</li>`;
          }
          html += '</ol>';
        }
        if (guide.rules && Array.isArray(guide.rules)) {
          html += '<ul>';
          for (const rule of guide.rules) {
            html += `<li>${Utils.escapeHtml(rule)}</li>`;
          }
          html += '</ul>';
        }
        if (guide.steps && Array.isArray(guide.steps)) {
          html += '<ol>';
          for (const step of guide.steps) {
            html += `<li>${Utils.escapeHtml(step)}</li>`;
          }
          html += '</ol>';
        }
        if (guide.backup && Array.isArray(guide.backup)) {
          html += '<ul>';
          for (const item of guide.backup) {
            html += `<li>${Utils.escapeHtml(item)}</li>`;
          }
          html += '</ul>';
        }
        if (guide.recovery && Array.isArray(guide.recovery)) {
          html += '<ul>';
          for (const item of guide.recovery) {
            html += `<li>${Utils.escapeHtml(item)}</li>`;
          }
          html += '</ul>';
        }
      }

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function loadReport(id) {
    const panel = $('#rc-report-panel');
    const content = $('#rc-report-content');
    if (!panel || !content) return;

    content.innerHTML = UI.renderLoading('Generating release report...');
    panel.style.display = 'block';

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}/report`);
      const data = res.ok ? res.data : null;

      if (!data || !data.report) {
        content.innerHTML = UI.renderError('Error', 'Failed to generate report');
        return;
      }

      const r = data.report;
      let html = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div><strong>Version:</strong> ${Utils.escapeHtml(r.candidate.version)}</div>
          <div><strong>Status:</strong> <span class="badge badge-${r.candidate.status}">${Utils.escapeHtml(r.candidate.status)}</span></div>
          <div><strong>Blockers:</strong> ${(r.blockers || []).length}</div>
          <div><strong>Warnings:</strong> ${(r.warnings || []).length}</div>
        </div>
      `;

      if (r.readiness) {
        html += '<h4 style="margin-top:12px;">Module Readiness</h4>';
        html += `<p>Score: ${r.readiness.score || 'N/A'}% | All Ready: ${r.readiness.allReady ? 'Yes' : 'No'}</p>`;
      }

      if (r.blockers && r.blockers.length > 0) {
        html += '<h4 style="margin-top:12px; color:var(--color-danger);">Blockers</h4><ul>';
        for (const b of r.blockers) {
          html += `<li>${Utils.escapeHtml(b)}</li>`;
        }
        html += '</ul>';
      }

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
    }
  }

  async function createProposal(id, type) {
    const panel = $('#rc-proposal-panel');
    const content = $('#rc-proposal-content');
    if (!panel || !content) return;

    content.innerHTML = UI.renderLoading('Creating proposal...');
    panel.style.display = 'block';

    try {
      const res = await Api.fetch(`/api/dashboard/release-candidate/${id}/proposal`, {
        method: 'POST',
        body: { type }
      });
      const data = res.ok ? res.data : null;

      if (!data) {
        content.innerHTML = UI.renderError('Error', 'Failed to create proposal');
        return;
      }

      let html = `<div style="margin-bottom:12px;"><strong>Type:</strong> ${Utils.escapeHtml(data.type)}</div>`;

      const proposal = data.proposal || data;
      if (proposal.title) {
        html += `<p><strong>Title:</strong> ${Utils.escapeHtml(proposal.title)}</p>`;
      }
      if (proposal.note) {
        html += `<p style="color:var(--color-warning);">${Utils.escapeHtml(proposal.note)}</p>`;
      }
      if (proposal.manualInstructions) {
        html += `<p><strong>Manual Instructions:</strong> <code>${Utils.escapeHtml(proposal.manualInstructions)}</code></p>`;
      }
      if (proposal.status) {
        html += `<p><strong>Status:</strong> ${Utils.escapeHtml(proposal.status)}</p>`;
      }

      html += '<p style="color:var(--text-secondary); margin-top:12px;">⚠️ This is a proposal only. No external action executed. Requires Evaluation v2 + executor approval to run.</p>';

      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = UI.renderError('Error', err.message);
    }
  }

  function attachEvents() {
    document.addEventListener('click', async (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      const id = target.dataset.rcId;

      if (target.id === 'btn-rc-refresh') {
        await loadData();
      }

      if (target.id === 'btn-rc-create') {
        try {
          const res = await Api.fetch('/api/dashboard/release-candidate/create', { method: 'POST' });
          if (res.ok) {
            await loadData();
            Utils.showToast('Release candidate created', 'success');
          } else {
            Utils.showToast('Failed to create RC', 'error');
          }
        } catch (err) {
          Utils.showToast('Error: ' + err.message, 'error');
        }
      }

      if (target.id === 'btn-rc-start-freeze') {
        try {
          const res = await Api.fetch('/api/dashboard/release-candidate/start-freeze', { method: 'POST' });
          if (res.ok) {
            await loadFreezeStatus();
            Utils.showToast('Release freeze started', 'success');
          }
        } catch (err) {
          Utils.showToast('Error: ' + err.message, 'error');
        }
      }

      if (target.id === 'btn-rc-end-freeze') {
        try {
          const res = await Api.fetch('/api/dashboard/release-candidate/end-freeze', { method: 'POST' });
          if (res.ok) {
            await loadFreezeStatus();
            Utils.showToast('Release freeze ended', 'success');
          }
        } catch (err) {
          Utils.showToast('Error: ' + err.message, 'error');
        }
      }

      if (target.classList.contains('btn-rc-detail') && id) {
        await loadDetail(id);
      }

      if (target.classList.contains('btn-rc-readiness') && id) {
        await runReadiness(id);
      }

      if (target.classList.contains('btn-rc-production') && id) {
        await runProductionGate(id);
      }

      if (target.classList.contains('btn-rc-compat') && id) {
        await runCompatibility(id);
      }

      if (target.classList.contains('btn-rc-risk') && id) {
        await runRiskReview(id);
      }

      if (target.classList.contains('btn-rc-notes') && id) {
        await loadNotes(id);
      }

      if (target.classList.contains('btn-rc-changelog') && id) {
        await loadChangelog(id);
      }

      if (target.classList.contains('btn-rc-env') && id) {
        await loadEnvChecklist(id);
      }

      if (target.classList.contains('btn-rc-guide') && id) {
        await loadGuide(id);
      }

      if (target.classList.contains('btn-rc-report') && id) {
        await loadReport(id);
      }

      if (target.classList.contains('btn-rc-proposal') && id) {
        const types = ['action_plan', 'github_tag', 'github_release', 'deploy'];
        const type = e.shiftKey ? 'github_release' : 'action_plan';
        await createProposal(id, type);
      }
    });
  }

  function $(id) { return document.getElementById(id); }

  return render;
})();

window.renderReleaseCandidate = renderReleaseCandidate;
if (window.UI) window.UI.renderReleaseCandidate = renderReleaseCandidate;
