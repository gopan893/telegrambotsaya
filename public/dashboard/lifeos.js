(function () {
  'use strict';

  const Api = window.Api;
  const UI = window.UI || {};

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  async function apiGet(path) {
    return Api.apiGet(path);
  }

  async function apiPost(path, body) {
    return Api.apiPost(path, body || {});
  }

  function inputValue(id) {
    return document.getElementById(id)?.value?.trim() || '';
  }

  async function lifeAction(action, id) {
    const root = document.getElementById('lifeos-root');
    try {
      if (action === 'daily') await apiPost('/lifeos/daily', { title: 'Daily plan' });
      if (action === 'weekly') await apiPost('/lifeos/weekly', { title: 'Weekly plan' });
      if (action === 'task') await apiPost('/lifeos/tasks', { title: inputValue('life-task-title') || 'Personal task', priority: inputValue('life-task-priority') || 'medium' });
      if (action === 'taskdone') await apiPost(`/lifeos/tasks/${id}/complete`, {});
      if (action === 'habit') await apiPost('/lifeos/habits', { title: inputValue('life-habit-title') || 'Small habit', frequency: 'daily' });
      if (action === 'habitcheck') await apiPost(`/lifeos/habits/${id}/checkin`, { value: true });
      if (action === 'reminder') await apiPost('/lifeos/reminders', { title: inputValue('life-reminder-title') || 'Reminder plan' });
      if (action === 'focus') await apiPost('/lifeos/focus', { title: inputValue('life-focus-title') || 'Focus session', durationMinutes: Number(inputValue('life-focus-minutes') || 25) });
      if (action === 'goal') await apiPost('/lifeos/goals', { title: inputValue('life-goal-title') || 'Personal goal', category: 'personal_growth' });
      if (action === 'mood') await apiPost('/lifeos/mood', { note: inputValue('life-mood-note') || 'Mood note', mood: 'noted' });
      if (action === 'calendar') await apiPost('/lifeos/integration-proposal', { kind: 'calendar', title: inputValue('life-proposal-title') || 'Calendar proposal' });
      if (action === 'gmail') await apiPost('/lifeos/integration-proposal', { kind: 'gmail', title: inputValue('life-proposal-title') || 'Gmail draft proposal' });
      await renderLifeOS(root);
      UI.showToast?.('Life OS updated', 'success');
    } catch (err) {
      UI.showToast?.(err.message || 'Life OS action failed', 'error');
    }
  }

  function renderItems(items, kind) {
    if (!items?.length) return '<p class="muted">Belum ada item.</p>';
    return items.slice(0, 8).map((item) => `
      <div class="list-row">
        <div>
          <strong>${esc(item.title)}</strong>
          <div class="muted">${esc(item.status)} · ${esc(item.priority || item.sensitivity || 'normal')}</div>
        </div>
        <div class="row-actions">
          ${kind === 'task' && !['done', 'archived'].includes(item.status) ? `<button class="btn secondary" onclick="window.lifeAction('taskdone','${esc(item.id)}')">Done</button>` : ''}
          ${kind === 'habit' ? `<button class="btn secondary" onclick="window.lifeAction('habitcheck','${esc(item.id)}')">Check-in</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  async function renderLifeOS(targetEl) {
    if (!targetEl) return;
    targetEl.innerHTML = '<section class="panel"><h2>Life OS</h2><p class="muted">Loading personal planning...</p></section>';
    const [summary, tasks, habits, reminders, focus, goals] = await Promise.all([
      apiGet('/lifeos/report'),
      apiGet('/lifeos/tasks'),
      apiGet('/lifeos/habits'),
      apiGet('/lifeos/reminders'),
      apiGet('/lifeos/focus'),
      apiGet('/lifeos/goals')
    ]);
    const data = summary || {};
    targetEl.innerHTML = `
      <div id="lifeos-root" class="page-grid">
        <section class="panel span-2">
          <div class="section-header">
            <div>
              <h2>Life OS</h2>
              <p class="muted">Daily/weekly planning, habits, focus, mood, and proposal-only external actions.</p>
            </div>
            <div class="button-row">
              <button class="btn" onclick="window.lifeAction('daily')">Create Daily Plan</button>
              <button class="btn secondary" onclick="window.lifeAction('weekly')">Create Weekly Plan</button>
            </div>
          </div>
          <div class="metric-grid">
            <div class="metric-card"><span>Tasks</span><strong>${esc(data.tasks?.length || 0)}</strong></div>
            <div class="metric-card"><span>Habits</span><strong>${esc(data.habits?.active || 0)}/${esc(data.habits?.total || 0)}</strong></div>
            <div class="metric-card"><span>Focus Done</span><strong>${esc(data.focus?.completed || 0)}</strong></div>
            <div class="metric-card"><span>Proposals</span><strong>${esc(data.pendingProposals?.length || 0)}</strong></div>
          </div>
          <p class="callout warning">Calendar/Gmail/routine actions create proposals only. No external write runs without approval.</p>
        </section>

        <section class="panel">
          <h3>Personal Tasks</h3>
          <div class="form-row">
            <input id="life-task-title" class="dashboard-input" placeholder="Task title">
            <select id="life-task-priority" class="dashboard-select"><option>medium</option><option>high</option><option>low</option></select>
            <button class="btn" onclick="window.lifeAction('task')">Add</button>
          </div>
          ${renderItems(tasks.items || [], 'task')}
        </section>

        <section class="panel">
          <h3>Habits</h3>
          <div class="form-row">
            <input id="life-habit-title" class="dashboard-input" placeholder="Habit title">
            <button class="btn" onclick="window.lifeAction('habit')">Add</button>
          </div>
          ${renderItems(habits.items || [], 'habit')}
        </section>

        <section class="panel">
          <h3>Reminders & Focus</h3>
          <div class="form-row"><input id="life-reminder-title" class="dashboard-input" placeholder="Reminder"><button class="btn" onclick="window.lifeAction('reminder')">Plan</button></div>
          <div class="form-row"><input id="life-focus-title" class="dashboard-input" placeholder="Focus title"><input id="life-focus-minutes" class="dashboard-input" placeholder="25"><button class="btn secondary" onclick="window.lifeAction('focus')">Add Focus</button></div>
          ${renderItems((reminders.items || []).concat(focus.items || []), 'reminder')}
        </section>

        <section class="panel">
          <h3>Mood / Energy</h3>
          <textarea id="life-mood-note" class="dashboard-textarea" placeholder="Private note"></textarea>
          <button class="btn" onclick="window.lifeAction('mood')">Save Private Note</button>
          <p class="muted">Supportive planning only, not medical diagnosis.</p>
        </section>

        <section class="panel">
          <h3>Personal Goals</h3>
          <div class="form-row"><input id="life-goal-title" class="dashboard-input" placeholder="Goal title"><button class="btn" onclick="window.lifeAction('goal')">Add Goal</button></div>
          ${renderItems(goals.items || [], 'goal')}
        </section>

        <section class="panel">
          <h3>External Proposals</h3>
          <input id="life-proposal-title" class="dashboard-input" placeholder="Meeting or email draft title">
          <div class="button-row">
            <button class="btn secondary" onclick="window.lifeAction('calendar')">Calendar Proposal</button>
            <button class="btn secondary" onclick="window.lifeAction('gmail')">Gmail Draft Proposal</button>
          </div>
          <p class="muted">No direct Calendar mutation. Gmail send disabled by default.</p>
        </section>
      </div>
    `;
  }

  window.lifeAction = lifeAction;
  window.LIFEOS_DASHBOARD = { renderLifeOS };
  if (window.UI) window.UI.renderLifeOS = renderLifeOS;
})();
