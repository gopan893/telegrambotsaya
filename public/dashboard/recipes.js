'use strict';

(function registerRecipesDashboard() {
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
    const cls = clean.includes('disabled') || clean === 'false' ? 'danger' : clean.includes('warning') || clean === 'skipped' ? 'warning' : 'success';
    return `<span class="badge badge-${cls}">${esc(value || 'unknown')}</span>`;
  }

  async function loadRecipes() {
    const [list, triggers, actions, templates, logs, schedules] = await Promise.all([
      Api.apiGet('/recipes/list'),
      Api.apiGet('/recipes/triggers'),
      Api.apiGet('/recipes/actions'),
      Api.apiGet('/recipes/templates'),
      Api.apiGet('/recipes/logs'),
      Api.apiGet('/recipes/schedules')
    ]);
    return { recipes: list.data, triggers: triggers.data, actions: actions.data, templates: templates.data, logs: logs.data, schedules: schedules.data };
  }

  async function renderRecipes(targetEl) {
    targetEl.innerHTML = '<div class="tab-header"><h2>Automation Recipe Builder</h2><p>Create, test, and schedule automation recipes with triggers, conditions, and actions.</p></div><div id="recipes-content">' + window.UI.renderLoading('Loading recipes...') + '</div>';
    const res = await loadRecipes();
    const content = document.getElementById('recipes-content');
    if (!content) return;
    content.innerHTML = `
      <div class="dashboard-card">
        <div class="card-header"><h3>Recipes <span class="badge badge-info">${res.recipes?.count || 0}</span></h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Name</th><th>Trigger</th><th>Actions</th><th>Conditions</th><th>Enabled</th><th>Last Run</th><th>Run Count</th><th>Actions</th></tr></thead>
          <tbody>${(res.recipes?.recipes || []).map(r => `<tr><td><strong>${esc(r.name)}</strong></td><td>${esc(r.trigger?.type || 'manual')}</td><td>${r.actions?.length || 0}</td><td>${r.conditions?.length || 0}</td><td>${badge(r.enabled)}</td><td>${esc((r.lastRun || '').slice(0, 16) || '-')}</td><td>${r.runCount || 0}</td><td><button class="btn btn-sm btn-outline" onclick="runRecipe('${esc(r.id)}')">Run</button> <button class="btn btn-sm ${r.enabled ? 'btn-warning' : 'btn-success'}" onclick="toggleRecipe('${esc(r.id)}')">${r.enabled ? 'Disable' : 'Enable'}</button></td></tr>`).join('') || '<tr><td colspan="8" class="muted">No recipes. Create one from a template below.</td></tr>'}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Templates</h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Template</th><th>Description</th><th>Trigger</th><th>Actions</th><th>Tags</th><th></th></tr></thead>
          <tbody>${(res.templates?.templates || []).map(t => `<tr><td><strong>${esc(t.name)}</strong></td><td>${esc(t.description)}</td><td>${esc(t.trigger?.type)}</td><td>${t.actions?.length || 0}</td><td>${esc((t.tags || []).join(', '))}</td><td><button class="btn btn-sm btn-outline" onclick="applyTemplate('${esc(t.id)}')">Apply</button></td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Available Triggers</h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Type</th><th>Name</th><th>Category</th><th>Description</th></tr></thead>
          <tbody>${(res.triggers?.triggers || []).map(t => `<tr><td><code>${esc(t.id)}</code></td><td>${esc(t.name)}</td><td>${esc(t.category)}</td><td>${esc(t.description)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Available Actions</h3></div>
        <div class="table-wrapper"><table class="data-table">
          <thead><tr><th>Type</th><th>Name</th><th>Category</th><th>Description</th></tr></thead>
          <tbody>${(res.actions?.actions || []).map(a => `<tr><td><code>${esc(a.id)}</code></td><td>${esc(a.name)}</td><td>${esc(a.category)}</td><td>${esc(a.description)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Execution Log <span class="badge badge-info">${res.logs?.logs?.length || 0}</span></h3></div>
        ${(res.logs?.logs || []).slice(-10).reverse().map(l => `<div class="gap-item"><strong>${esc(l.recipeId)}</strong>: ${esc(l.event)} <span class="muted">${esc((l.timestamp || '').slice(0, 19))}</span></div>`).join('') || '<p class="muted">No execution logs yet.</p>'}
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Schedules</h3></div>
        ${(res.schedules?.schedules || []).map(s => `<div class="gap-item">${esc(s.recipeId)} — <code>${esc(s.cron)}</code> ${badge(s.active ? 'active' : 'paused')}</div>`).join('') || '<p class="muted">No schedules.</p>'}
      </div>

      <div class="dashboard-card">
        <div class="card-header"><h3>Create Recipe</h3></div>
        <div class="form-group"><label>Name</label><input id="recipe-name" class="dashboard-input" placeholder="My Recipe"></div>
        <div class="form-group"><label>Trigger Type</label><select id="recipe-trigger" class="dashboard-select"><option value="manual">Manual</option><option value="schedule">Schedule</option><option value="webhook">Webhook</option></select></div>
        <div class="form-group"><label>Action Type</label><select id="recipe-action" class="dashboard-select"><option value="send_message">Send Message</option><option value="create_memory">Create Memory</option><option value="run_health_check">Run Health Check</option><option value="log_event">Log Event</option></select></div>
        <button class="btn btn-outline" id="btn-recipe-create">Create Recipe</button>
        <button class="btn btn-outline" id="btn-recipe-dry-run">Dry Run Last Created</button>
        <div id="recipes-result" style="margin-top:12px;"></div>
      </div>`;
    document.getElementById('btn-recipe-create')?.addEventListener('click', async () => {
      const name = document.getElementById('recipe-name')?.value || 'Untitled Recipe';
      const triggerType = document.getElementById('recipe-trigger')?.value || 'manual';
      const actionType = document.getElementById('recipe-action')?.value || 'send_message';
      const result = document.getElementById('recipes-result');
      if (result) result.innerHTML = window.UI.renderLoading('Creating...');
      const res = await Api.apiPost('/recipes/create', payload({ name, trigger: { type: triggerType }, actions: [{ type: actionType, params: { text: 'Hello from recipe!' } }] }));
      if (result) result.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-recipe-dry-run')?.addEventListener('click', async () => {
      const result = document.getElementById('recipes-result');
      const list = await Api.apiGet('/recipes/list');
      const recipes = list.data?.recipes || [];
      if (recipes.length === 0) { if (result) result.innerHTML = '<p class="muted">No recipes to dry run.</p>'; return; }
      const lastId = recipes[recipes.length - 1].id;
      if (result) result.innerHTML = window.UI.renderLoading('Dry running...');
      const res = await Api.apiPost('/recipes/dry-run', payload({ recipeId: lastId }));
      if (result) result.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
  }

  window.runRecipe = async function(recipeId) {
    const res = await Api.apiPost('/recipes/run', payload({ recipeId }));
    alert('Recipe run result: ' + JSON.stringify(res.data));
  };
  window.toggleRecipe = async function(recipeId) {
    const res = await Api.apiPost('/recipes/' + recipeId + '/toggle', payload());
    renderRecipes(document.getElementById('tab-content'));
  };
  window.applyTemplate = async function(templateId) {
    const res = await Api.apiPost('/recipes/templates/apply', payload({ templateId }));
    if (res.data?.ok) renderRecipes(document.getElementById('tab-content'));
    else alert('Error: ' + JSON.stringify(res.data));
  };

  window.RECIPES_DASHBOARD = { renderRecipes };
  if (window.UI) window.UI.renderRecipes = renderRecipes;
})();
