/* CI/CD Pipeline frontend additions */

const CicdUI = (() => {
  async function loadReleases(targetEl) {
    const res = await Api.apiGet('/cicd/releases');
    if (!res.ok) return;
    const releases = res.data.releases || [];
    let html = '<div class="panel"><h3 class="panel-title">Release History</h3><div class="table-responsive"><table><thead><tr><th>Version</th><th>Status</th><th>Created</th></tr></thead><tbody>';
    releases.forEach(r => {
      html += `<tr><td>${Utils.escapeHtml(r.version)}</td><td>${UI.renderBadge(r.status)}</td><td>${Utils.formatDate(r.createdAt)}</td></tr>`;
    });
    html += '</tbody></table></div></div>';
    if (targetEl) targetEl.innerHTML = html;
    return releases;
  }

  async function loadProposals(targetEl) {
    const res = await Api.apiGet('/cicd/proposals');
    if (!res.ok) return;
    const proposals = res.data.proposals || [];
    let html = '<div class="panel"><h3 class="panel-title">CI/CD Proposals</h3><div class="table-responsive"><table><thead><tr><th>ID</th><th>Version</th><th>Status</th><th>Created</th></tr></thead><tbody>';
    proposals.forEach(p => {
      html += `<tr><td style="font-family:var(--font-mono);font-size:11px;">${Utils.escapeHtml(p.id)}</td><td>${Utils.escapeHtml(p.version || '-')}</td><td>${UI.renderBadge(p.status)}</td><td>${Utils.formatDate(p.createdAt)}</td></tr>`;
    });
    html += '</tbody></table></div></div>';
    if (targetEl) targetEl.innerHTML = html;
    return proposals;
  }

  async function loadPipelines(targetEl) {
    const res = await Api.apiGet('/cicd/pipelines');
    if (!res.ok) return;
    const pipelines = res.data.pipelines || [];
    let html = '<div class="panel"><h3 class="panel-title">Pipelines</h3><div class="table-responsive"><table><thead><tr><th>ID</th><th>Status</th><th>Created</th></tr></thead><tbody>';
    pipelines.forEach(p => {
      html += `<tr><td style="font-family:var(--font-mono);font-size:11px;">${Utils.escapeHtml(p.id)}</td><td>${UI.renderBadge(p.status)}</td><td>${Utils.formatDate(p.createdAt)}</td></tr>`;
    });
    html += '</tbody></table></div></div>';
    if (targetEl) targetEl.innerHTML = html;
    return pipelines;
  }

  return { loadReleases, loadProposals, loadPipelines };
})();

window.CicdUI = CicdUI;
