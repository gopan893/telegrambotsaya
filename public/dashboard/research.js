'use strict';

(function registerResearchDashboard() {
  function esc(value) {
    return window.Utils?.escapeHtml ? Utils.escapeHtml(String(value ?? '')) : String(value ?? '');
  }

  function actorId() {
    return localStorage.getItem('dashboard_actor_id') || localStorage.getItem('last_user_id') || 'dashboard-admin';
  }

  function workspaceId() {
    return localStorage.getItem('dashboard_workspace_id') || 'default';
  }

  function payload(extra = {}) {
    return { actorId: actorId(), userId: actorId(), workspaceId: workspaceId(), ...extra };
  }

  function badge(value) {
    const clean = String(value || 'unknown').toLowerCase();
    const cls = clean.includes('blocked') || clean.includes('danger') ? 'danger' : clean.includes('degraded') || clean.includes('warning') ? 'warning' : 'success';
    return `<span class="badge badge-${cls}">${esc(value || 'unknown')}</span>`;
  }

  async function loadResearch() {
    const query = new URLSearchParams(payload()).toString();
    return Api.apiGet(`/research?${query}`);
  }

  function renderTasks(tasks = []) {
    if (!tasks.length) return '<div class="empty-state"><h3>Belum ada research task</h3><p>Buat task riset dari form di atas.</p></div>';
    return `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Task</th><th>Scope</th><th>Status</th><th>Evidence</th><th>Action</th></tr></thead>
          <tbody>
            ${tasks.map((task) => `
              <tr>
                <td><strong>${esc(task.topic)}</strong><br><span class="muted">${esc(task.id)}</span></td>
                <td>${esc(task.scope)}</td>
                <td>${badge(task.status)}</td>
                <td>${esc((task.evidence || []).length)} item<br>${esc((task.sources || []).length)} source</td>
                <td>
                  <button class="btn btn-sm btn-outline" data-research-action="analyze" data-task-id="${esc(task.id)}">Analyze</button>
                  <button class="btn btn-sm btn-outline" data-research-action="report" data-task-id="${esc(task.id)}">Report</button>
                  <button class="btn btn-sm btn-outline" data-research-action="link" data-task-id="${esc(task.id)}">Link KG</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDocsGaps(items = []) {
    return `<ul class="compact-list">${items.slice(0, 8).map((item) => `<li><strong>${esc(item.topic)}</strong>: ${esc(item.reason || '-')}${item.needsUpdate ? ' ' + badge('needs_review') : ''}</li>`).join('') || '<li>No major docs gap.</li>'}</ul>`;
  }

  async function createTask(targetEl) {
    const topic = document.getElementById('research-topic')?.value || '';
    const question = document.getElementById('research-question')?.value || topic;
    const scope = document.getElementById('research-scope')?.value || '';
    const resultEl = document.getElementById('research-result');
    if (resultEl) resultEl.innerHTML = UI.renderLoading('Membuat research task...');
    const res = await Api.apiPost('/research/tasks', payload({ topic, question, scope }));
    if (!res.ok) {
      if (resultEl) resultEl.innerHTML = UI.renderError(res.data?.reason || 'Research task gagal');
      return;
    }
    if (resultEl) resultEl.innerHTML = `<pre class="pre-wrap">${esc(JSON.stringify(res.data.task, null, 2))}</pre>`;
    await renderResearch(targetEl);
  }

  async function createDocsDraft() {
    const topic = document.getElementById('docs-topic')?.value || 'Environment documentation';
    const resultEl = document.getElementById('docs-result');
    if (resultEl) resultEl.innerHTML = UI.renderLoading('Membuat docs draft...');
    const res = await Api.apiPost('/research/docs/draft', payload({ topic, question: topic }));
    const data = res.data || {};
    if (!res.ok) {
      if (resultEl) resultEl.innerHTML = UI.renderError(data.reason || 'Docs draft gagal');
      return;
    }
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="dashboard-card">
          <h3>Draft Preview</h3>
          <pre class="pre-wrap">${esc(data.draft?.body || '')}</pre>
          <button class="btn btn-outline" id="btn-docs-update-plan">Create Update Plan</button>
        </div>
      `;
      document.getElementById('btn-docs-update-plan')?.addEventListener('click', async () => {
        const plan = await Api.apiPost('/research/docs/update-plan', payload({ draft: data.draft }));
        const proposal = plan.ok ? await Api.apiPost('/research/docs/proposal', payload({ updatePlan: plan.data.updatePlan })) : null;
        resultEl.innerHTML += `<pre class="pre-wrap">${esc(JSON.stringify({ updatePlan: plan.data, proposal: proposal?.data }, null, 2))}</pre>`;
      });
    }
  }

  async function runTaskAction(action, taskId, targetEl) {
    const resultEl = document.getElementById('research-result');
    if (resultEl) resultEl.innerHTML = UI.renderLoading(`Running ${action}...`);
    const path = action === 'report'
      ? `/research/tasks/${encodeURIComponent(taskId)}/report?${new URLSearchParams(payload()).toString()}`
      : action === 'link'
        ? `/research/tasks/${encodeURIComponent(taskId)}/link-knowledge`
        : `/research/tasks/${encodeURIComponent(taskId)}/analyze`;
    const res = action === 'report' ? await Api.apiGet(path) : await Api.apiPost(path, payload());
    if (resultEl) resultEl.innerHTML = res.ok ? `<pre class="pre-wrap">${esc(JSON.stringify(res.data, null, 2))}</pre>` : UI.renderError(res.data?.reason || 'Action failed');
    if (action !== 'report') await renderResearch(targetEl);
  }

  async function renderResearch(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat Research / Docs...');
    const res = await loadResearch();
    const data = res.data || {};
    const tasks = data.tasks || [];
    targetEl.innerHTML = `
      <div class="tab-header">
        <h2>🔎 Research / Docs</h2>
        <p>Evidence-grounded research dan documentation draft. Tidak ada file write langsung; docs update tetap proposal/approval.</p>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Create Research Task</h3>${badge('read-only')}</div>
        <div class="grid grid-3">
          <div class="form-group"><label>Topic</label><input id="research-topic" class="dashboard-input" placeholder="contoh: deploy Render Node.js"></div>
          <div class="form-group"><label>Question</label><input id="research-question" class="dashboard-input" placeholder="apa yang perlu diverifikasi?"></div>
          <div class="form-group"><label>Scope</label><select id="research-scope" class="dashboard-select"><option value="">auto</option><option value="deployment">deployment</option><option value="project_docs">project_docs</option><option value="api_docs">api_docs</option><option value="security">security</option><option value="architecture">architecture</option></select></div>
        </div>
        <button class="btn btn-primary" id="btn-create-research">Create Task</button>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Research Tasks</h3><span class="muted">${esc(tasks.length)} item(s)</span></div>
        ${renderTasks(tasks)}
      </div>

      <div class="grid grid-2">
        <div class="dashboard-card">
          <div class="card-header"><h3>Documentation Gap Report</h3>${badge(data.docsGaps?.ok ? 'ready' : 'unknown')}</div>
          ${renderDocsGaps(data.docsGaps?.items || [])}
        </div>
        <div class="dashboard-card">
          <div class="card-header"><h3>Docs Draft</h3>${badge('draft-only')}</div>
          <div class="form-group"><label>Topic</label><input id="docs-topic" class="dashboard-input" placeholder="buat dokumentasi env project ini"></div>
          <button class="btn btn-outline" id="btn-docs-draft">Generate Draft</button>
        </div>
      </div>

      <div id="research-result" style="margin-top:16px;"></div>
      <div id="docs-result" style="margin-top:16px;"></div>
    `;
    document.getElementById('btn-create-research')?.addEventListener('click', () => createTask(targetEl));
    document.getElementById('btn-docs-draft')?.addEventListener('click', createDocsDraft);
    targetEl.querySelectorAll('[data-research-action]').forEach((button) => {
      button.addEventListener('click', () => runTaskAction(button.dataset.researchAction, button.dataset.taskId, targetEl));
    });
  }

  window.RESEARCH_DASHBOARD = { renderResearch };
  if (window.UI) window.UI.renderResearch = renderResearch;
})();

