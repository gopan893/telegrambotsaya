/* Project Operator Dashboard Module */

const OPERATOR = {
  async getGoals() { return Api.apiGet('/operator/goals'); },
  async createGoal(data) { return Api.apiPost('/operator/goals', data); },
  async getGoal(id) { return Api.apiGet('/operator/goals/' + id); },
  async analyzeGoal(id) { return Api.apiPost('/operator/goals/' + id + '/analyze', {}); },
  async createPlan(id) { return Api.apiPost('/operator/goals/' + id + '/plan', {}); },
  async createTasks(planId) { return Api.apiPost('/operator/plans/' + planId + '/tasks', {}); },
  async getTasks(filters) {
    const q = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return Api.apiGet('/operator/tasks' + q);
  },
  async runReview(taskId) { return Api.apiPost('/operator/tasks/' + taskId + '/run-review', {}); },
  async evaluateTask(taskId) { return Api.apiPost('/operator/tasks/' + taskId + '/evaluate', {}); },
  async createProposal(taskId) { return Api.apiPost('/operator/tasks/' + taskId + '/create-proposal', {}); },
  async getProgress(goalId) { return Api.apiGet('/operator/goals/' + goalId + '/progress'); },
  async getReport(goalId) { return Api.apiGet('/operator/goals/' + goalId + '/report'); },
  async getNextAction(goalId) { return Api.apiGet('/operator/goals/' + goalId + '/next-action'); }
};

function renderOperatorTab(targetEl) {
  let html = '<div class="tab-header"><h2>🤖 Project Operator</h2></div>';
  html += '<p style="color:var(--muted); margin-bottom:16px;">Semi-autonomous project delivery from goal to deployment proposal.</p>';
  html += '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">';
  html += '<button class="btn btn-primary btn-sm" onclick="UI._opRefresh()">🔄 Refresh</button>';
  html += '<button class="btn btn-outline btn-sm" onclick="UI._opShowNewGoal()">➕ New Goal</button>';
  html += '</div>';
  html += '<div id="operator-new-goal" class="hidden" style="margin-bottom:16px;"></div>';
  html += '<div id="operator-content">' + UI.renderLoading('Loading operator data...') + '</div>';
  targetEl.innerHTML = html;
  UI._opRefresh();
}

UI.renderOperator = renderOperatorTab;

UI._opRefresh = async function() {
  const el = document.getElementById('operator-content');
  if (!el) return;
  el.innerHTML = UI.renderLoading('Loading operator data...');
  try {
    const res = await OPERATOR.getGoals();
    if (!res.ok) { el.innerHTML = UI.renderError('Failed', res.error); return; }
    const goals = res.data.goals || [];
    let html = '<div class="card-grid" style="margin-bottom:20px;">';
    html += '<div class="card"><div class="card-title">📋 Total Goals</div><div class="card-value">' + goals.length + '</div></div>';
    html += '<div class="card"><div class="card-title">🔧 Active</div><div class="card-value">' + (res.data.activeCount || 0) + '</div></div>';
    html += '</div>';

    html += '<h3 style="margin-bottom:12px;">Goals</h3>';
    if (goals.length === 0) {
      html += '<div class="empty-state"><span class="empty-state-emoji">🎯</span><h3>No Goals Yet</h3><p>Create a goal to start planning.</p></div>';
    } else {
      html += '<div style="overflow-x:auto;"><table class="table"><tr><th>Title</th><th>Status</th><th>Category</th><th>Priority</th><th>Actions</th></tr>';
      for (const g of goals) {
        const statusColor = g.status === 'blocked' ? 'var(--color-danger)' : (g.status === 'shipped' ? 'var(--color-success)' : 'var(--color-warning)');
        html += '<tr>';
        html += '<td>' + Utils.escapeHtml(g.title) + '</td>';
        html += '<td><span style="color:' + statusColor + ';">' + Utils.escapeHtml(g.status) + '</span></td>';
        html += '<td>' + Utils.escapeHtml(g.category) + '</td>';
        html += '<td>' + Utils.escapeHtml(g.priority) + '</td>';
        html += '<td><button class="btn btn-outline btn-xs" onclick="UI._opShowGoal(\'' + g.id + '\')">🔍 View</button></td>';
        html += '</tr>';
      }
      html += '</table></div>';
    }
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = UI.renderError('Exception', err.message);
  }
};

UI._opShowNewGoal = function() {
  const el = document.getElementById('operator-new-goal');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="card">
      <div class="card-title">Create New Goal</div>
      <div style="margin-top:8px;">
        <input type="text" id="op-goal-title" placeholder="Goal title (e.g., 'Selesaikan AI OS sampai production')" class="input" style="width:100%; margin-bottom:8px;">
        <textarea id="op-goal-desc" placeholder="Description / details..." class="input" style="width:100%; min-height:60px; margin-bottom:8px;"></textarea>
        <button class="btn btn-primary btn-sm" onclick="UI._opCreateGoal()">🚀 Create & Analyze</button>
        <button class="btn btn-outline btn-sm" onclick="UI._opCancelNewGoal()">Cancel</button>
      </div>
    </div>
  `;
};

UI._opCancelNewGoal = function() {
  const el = document.getElementById('operator-new-goal');
  if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
};

UI._opCreateGoal = async function() {
  const title = document.getElementById('op-goal-title')?.value;
  const desc = document.getElementById('op-goal-desc')?.value || '';
  if (!title) { Utils.showToast('Title required', 'error'); return; }
  const res = await OPERATOR.createGoal({ title, description: desc });
  if (!res.ok) { Utils.showToast('Failed: ' + (res.error || res.data?.error), 'error'); return; }
  Utils.showToast('Goal created! ID: ' + res.data.goal.id, 'success');
  UI._opCancelNewGoal();
  UI._opShowGoal(res.data.goal.id);
};

UI._opShowGoal = async function(goalId) {
  const el = document.getElementById('operator-content');
  if (!el) return;
  el.innerHTML = UI.renderLoading('Loading goal...');
  try {
    const res = await OPERATOR.getGoal(goalId);
    if (!res.ok) { el.innerHTML = UI.renderError('Error', res.error); return; }
    const d = res.data;
    const goal = d.goal;
    let html = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">';
    html += '<button class="btn btn-outline btn-sm" onclick="UI._opRefresh()">⬅ Back</button>';
    html += '<button class="btn btn-outline btn-sm" onclick="UI._opAnalyzeGoal(\'' + goalId + '\')">🔍 Analyze</button>';
    html += '<button class="btn btn-outline btn-sm" onclick="UI._opCreatePlan(\'' + goalId + '\')">📋 Create Plan</button>';
    html += '<button class="btn btn-outline btn-sm" onclick="UI._opShowProgress(\'' + goalId + '\')">📊 Progress</button>';
    html += '<button class="btn btn-outline btn-sm" onclick="UI._opShowNextAction(\'' + goalId + '\')">🎯 Next Action</button>';
    html += '<button class="btn btn-outline btn-sm" onclick="UI._opShowReport(\'' + goalId + '\')">📄 Report</button>';
    html += '</div>';

    html += '<div class="card"><div class="card-title">' + Utils.escapeHtml(goal.title) + '</div>';
    html += '<div style="margin-top:8px; font-size:13px;">';
    html += '<div>Status: <b>' + Utils.escapeHtml(goal.status) + '</b> | Category: <b>' + Utils.escapeHtml(goal.category) + '</b> | Priority: <b>' + Utils.escapeHtml(goal.priority) + '</b></div>';
    html += '<div>Description: ' + Utils.escapeHtml(goal.description || '(none)') + '</div>';
    if (goal.successCriteria && goal.successCriteria.length > 0) {
      html += '<div>Criteria: ' + goal.successCriteria.map(c => Utils.escapeHtml(c)).join(', ') + '</div>';
    }
    html += '</div></div>';

    const plans = d.plans || [];
    if (plans.length > 0) {
      html += '<h3 style="margin:16px 0 8px;">Plans</h3>';
      for (const p of plans) {
        html += '<div class="card" style="margin-bottom:8px;"><div class="card-title">' + Utils.escapeHtml(p.title) + '</div>';
        html += '<div style="font-size:13px;">Status: <b>' + Utils.escapeHtml(p.status) + '</b> | Phases: ' + (p.phases || []).length + '</div>';
        html += '<button class="btn btn-outline btn-xs" onclick="UI._opCreateTasks(\'' + p.id + '\')">📋 Generate Tasks</button></div>';
      }
    }

    const tasks = d.tasks || [];
    if (tasks.length > 0) {
      html += '<h3 style="margin:16px 0 8px;">Tasks (' + tasks.length + ')</h3>';
      html += '<div style="overflow-x:auto;"><table class="table"><tr><th>Title</th><th>Type</th><th>Status</th><th>Risk</th><th>Actions</th></tr>';
      for (const t of tasks) {
        html += '<tr><td>' + Utils.escapeHtml(t.title) + '</td><td>' + Utils.escapeHtml(t.type) + '</td><td>' + Utils.escapeHtml(t.status) + '</td><td>' + Utils.escapeHtml(t.riskLevel) + '</td>';
        html += '<td>';
        html += '<button class="btn btn-outline btn-xs" onclick="UI._opRunReview(\'' + t.id + '\')">🔍 Review</button> ';
        html += '<button class="btn btn-outline btn-xs" onclick="UI._opEvaluate(\'' + t.id + '\')">✅ Evaluate</button> ';
        html += '<button class="btn btn-outline btn-xs" onclick="UI._opCreateProposal(\'' + t.id + '\')">📨 Proposal</button>';
        html += '</td></tr>';
      }
      html += '</table></div>';
    }

    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = UI.renderError('Exception', err.message);
  }
};

UI._opAnalyzeGoal = async function(goalId) {
  const res = await OPERATOR.analyzeGoal(goalId);
  if (!res.ok) { Utils.showToast('Analysis failed: ' + (res.error || res.data?.error), 'error'); return; }
  Utils.showToast('Analysis: ' + JSON.stringify(res.data.analysis), 'info', 5000);
};

UI._opCreatePlan = async function(goalId) {
  const res = await OPERATOR.createPlan(goalId);
  if (!res.ok) { Utils.showToast('Plan failed: ' + (res.error || res.data?.error), 'error'); return; }
  Utils.showToast('Plan created!', 'success');
  UI._opShowGoal(goalId);
};

UI._opCreateTasks = async function(planId) {
  const res = await OPERATOR.createTasks(planId);
  if (!res.ok) { Utils.showToast('Tasks failed: ' + (res.error || res.data?.error), 'error'); return; }
  Utils.showToast(res.data.tasks.length + ' tasks created!', 'success');
  const plan = res.data.tasks[0];
  if (plan) UI._opShowGoal(plan.goalId);
};

UI._opRunReview = async function(taskId) {
  const res = await OPERATOR.runReview(taskId);
  if (!res.ok) { Utils.showToast('Review failed', 'error'); return; }
  Utils.showToast('Review: ' + JSON.stringify(res.data.riskReview), 'info', 5000);
};

UI._opEvaluate = async function(taskId) {
  const el = document.getElementById('operator-content');
  if (!el) return;
  const res = await OPERATOR.evaluateTask(taskId);
  if (!res.ok) { Utils.showToast('Evaluation failed', 'error'); return; }
  Utils.showToast('Evaluation: ' + res.data.evaluation.summary, res.data.evaluation.ok ? 'success' : 'warning', 5000);
};

UI._opCreateProposal = async function(taskId) {
  const res = await OPERATOR.createProposal(taskId);
  if (!res.ok) { Utils.showToast('Proposal failed: ' + (res.error || res.data?.error || (res.data?.evaluation ? res.data.evaluation.summary : '')), 'error'); return; }
  Utils.showToast('Proposal created! ID: ' + res.data.proposal.id, 'success');
};

UI._opShowProgress = async function(goalId) {
  const res = await OPERATOR.getProgress(goalId);
  if (!res.ok) { Utils.showToast('Failed to load progress', 'error'); return; }
  Utils.showToast('Progress: ' + res.data.progress.percent + '% (' + res.data.progress.tasksDone + '/' + res.data.progress.tasksTotal + ' tasks)', 'info', 5000);
};

UI._opShowNextAction = async function(goalId) {
  const res = await OPERATOR.getNextAction(goalId);
  if (!res.ok) { Utils.showToast('Failed', 'error'); return; }
  const d = res.data.decision;
  Utils.showToast('Next: ' + (d.topRecommendation ? d.topRecommendation.action + ' - ' + d.topRecommendation.description : 'No recommendation'), 'info', 5000);
};

UI._opShowReport = async function(goalId) {
  const res = await OPERATOR.getReport(goalId);
  if (!res.ok) { Utils.showToast('Failed', 'error'); return; }
  Utils.showToast('Report generated', 'info', 3000);
};
