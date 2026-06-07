/* Dashboard Improvement tab */
/* global Api, UI, Utils */

(function() {
  'use strict';

  const TAB_ID = 'improvement';
  const API_BASE = '/api/dashboard/improvement';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  async function apiGet(path) {
    return Api.apiGet ? Api.apiGet(API_BASE + path) : Api.get(API_BASE + path);
  }

  async function apiPost(path, body) {
    return Api.apiPost ? Api.apiPost(API_BASE + path, body || {}) : Api.post(API_BASE + path, body);
  }

  function renderBadge(status, extraClass) {
    const clean = String(status || '').toLowerCase();
    const base = extraClass || `badge-${clean}`;
    return `<span class="badge ${base}">${esc(status || 'unknown')}</span>`;
  }

  async function renderImprovement(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat Improvement Engine...');
    try {
      const overviewRes = await apiGet('');
      const feedbackRes = await apiGet('/feedback');
      const weaknessesRes = await apiGet('/weaknesses');
      const lessonsRes = await apiGet('/lessons');
      const plansRes = await apiGet('/plans');

      const overview = overviewRes.ok ? (overviewRes.data || overviewRes) : {};
      const feedback = feedbackRes.ok ? (feedbackRes.data || []) : [];
      const weaknesses = weaknessesRes.ok ? (weaknessesRes.data || []) : [];
      const lessons = lessonsRes.ok ? (lessonsRes.data || []) : [];
      const plans = plansRes.ok ? (plansRes.data || []) : [];

      const recentFeedback = feedback.slice(-5).reverse();
      const topWeaknesses = weaknesses.filter(w => w.status === 'open').sort((a, b) => (b.frequency || 0) - (a.frequency || 0)).slice(0, 5);
      const latestLessons = lessons.slice(-5).reverse();
      const activePlans = plans.filter(p => p.status !== 'archived' && p.status !== 'done');

      let html = `<div class="tab-content">
        <div class="section-header">
          <h2>Continuous Improvement Engine</h2>
          <div class="section-actions">
            <button class="btn btn-outline" id="im-refresh-btn">Refresh</button>
          </div>
        </div>

        <div class="card-grid">
          <div class="card">
            <div class="card-title">Feedback</div>
            <div class="card-value">${esc(overview.feedback || 0)}</div>
            <div class="card-subtitle">Total entries</div>
          </div>
          <div class="card">
            <div class="card-title">Outcomes</div>
            <div class="card-value">${esc(overview.outcomes || 0)}</div>
            <div class="card-subtitle">Total outcomes</div>
          </div>
          <div class="card">
            <div class="card-title">Weaknesses</div>
            <div class="card-value" style="color:${(overview.weaknesses || 0) > 0 ? 'var(--color-warning)' : 'var(--color-success)'}">${esc(overview.weaknesses || 0)}</div>
            <div class="card-subtitle">${topWeaknesses.length} open</div>
          </div>
          <div class="card">
            <div class="card-title">Lessons</div>
            <div class="card-value">${esc(overview.lessons || 0)}</div>
            <div class="card-subtitle">Learned</div>
          </div>
          <div class="card">
            <div class="card-title">Plans</div>
            <div class="card-value">${esc(overview.plans || 0)}</div>
            <div class="card-subtitle">${activePlans.length} active</div>
          </div>
        </div>`;

      if (recentFeedback.length > 0) {
        html += `<div class="section-header"><h3>Recent Feedback</h3></div>
          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>ID</th><th>Category</th><th>Sentiment</th><th>Summary</th><th>Status</th></tr></thead>
              <tbody>`;
        for (const f of recentFeedback) {
          html += `<tr>
            <td><code>${esc(f.id || '').slice(0, 16)}</code></td>
            <td>${renderBadge(f.category)}</td>
            <td>${renderBadge(f.sentiment)}</td>
            <td>${esc((f.summary || '').slice(0, 80))}</td>
            <td>${renderBadge(f.status)}</td>
          </tr>`;
        }
        html += `</tbody></table></div>`;
      }

      if (topWeaknesses.length > 0) {
        html += `<div class="section-header"><h3>Top Open Weaknesses</h3></div>
          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>Title</th><th>Module</th><th>Severity</th><th>Frequency</th></tr></thead>
              <tbody>`;
        for (const w of topWeaknesses) {
          html += `<tr>
            <td>${esc(w.title || '')}</td>
            <td>${esc(w.module || '')}</td>
            <td>${renderBadge(w.severity)}</td>
            <td>${esc(w.frequency || 1)}</td>
          </tr>`;
        }
        html += `</tbody></table></div>`;
      }

      if (latestLessons.length > 0) {
        html += `<div class="section-header"><h3>Latest Lessons</h3></div>
          <div class="card-grid-wide">`;
        for (const l of latestLessons) {
          html += `<div class="card">
            <div class="card-title">${esc(l.title || '')}</div>
            <div class="card-subtitle">${esc((l.summary || '').slice(0, 120))}</div>
            <div style="margin-top:8px">${renderBadge(l.category)} ${renderBadge(l.status)}</div>
          </div>`;
        }
        html += `</div>`;
      }

      if (activePlans.length > 0) {
        html += `<div class="section-header"><h3>Active Improvement Plans</h3></div>
          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>Title</th><th>Risk</th><th>Status</th><th>Agent</th></tr></thead>
              <tbody>`;
        for (const p of activePlans) {
          html += `<tr>
            <td>${esc(p.title || '')}</td>
            <td>${renderBadge(p.riskLevel)}</td>
            <td>${renderBadge(p.status)}</td>
            <td>${esc(p.recommendedAgent || '-')}</td>
          </tr>`;
        }
        html += `</tbody></table></div>`;
      }

      html += `<div style="margin-top:24px; display:flex; gap:12px; flex-wrap:wrap;">
        <button class="btn btn-primary" data-im-tab="feedback">Feedback</button>
        <button class="btn btn-primary" data-im-tab="outcomes">Outcomes</button>
        <button class="btn btn-primary" data-im-tab="weaknesses">Weaknesses</button>
        <button class="btn btn-primary" data-im-tab="lessons">Lessons</button>
        <button class="btn btn-primary" data-im-tab="regression">Regression Cases</button>
        <button class="btn btn-primary" data-im-tab="plans">Plans</button>
        <button class="btn btn-primary" data-im-tab="report">Report</button>
        <button class="btn btn-outline" data-im-tab="proposals">Proposals</button>
      </div></div>`;

      targetEl.innerHTML = html;

      document.getElementById('im-refresh-btn')?.addEventListener('click', () => renderImprovement(targetEl));
      document.querySelectorAll('[data-im-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.dataset.imTab;
          switch (tab) {
            case 'feedback': renderImprovementFeedback(targetEl); break;
            case 'outcomes': renderImprovementOutcomes(targetEl); break;
            case 'weaknesses': renderImprovementWeaknesses(targetEl); break;
            case 'lessons': renderImprovementLessons(targetEl); break;
            case 'regression': renderImprovementRegressionCases(targetEl); break;
            case 'plans': renderImprovementPlans(targetEl); break;
            case 'report': renderImprovementReport(targetEl); break;
            case 'proposals': renderImprovementProposals(targetEl); break;
            default: renderImprovementOverview(targetEl); break;
          }
        });
      });
    } catch (err) {
      targetEl.innerHTML = UI.renderError('Failed to load', err.message || 'Improvement dashboard error');
    }
  }

  async function renderImprovementOverview(targetEl) {
    return renderImprovement(targetEl);
  }

  async function renderImprovementFeedback(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat feedback...');
    try {
      const statusFilter = document.getElementById('im-feedback-status')?.value || '';
      const catFilter = document.getElementById('im-feedback-category')?.value || '';
      let path = '/feedback';
      const params = [];
      if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`);
      if (catFilter) params.push(`category=${encodeURIComponent(catFilter)}`);
      if (params.length) path += '?' + params.join('&');

      const res = await apiGet(path);
      const feedback = res.ok ? (res.data || []) : [];

      let html = `<div class="section-header">
        <h2>Feedback</h2>
        <div class="section-actions">
          <button class="btn btn-outline" id="im-feedback-back">Back</button>
          <button class="btn btn-primary" id="im-feedback-submit-btn">Submit Feedback</button>
        </div>
      </div>
      <div class="filter-bar">
        <div class="filter-group">
          <label for="im-feedback-status">Status</label>
          <select id="im-feedback-status">
            <option value="">All</option>
            <option value="new" ${statusFilter === 'new' ? 'selected' : ''}>New</option>
            <option value="reviewed" ${statusFilter === 'reviewed' ? 'selected' : ''}>Reviewed</option>
            <option value="addressed" ${statusFilter === 'addressed' ? 'selected' : ''}>Addressed</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="im-feedback-category">Category</label>
          <select id="im-feedback-category">
            <option value="">All</option>
            <option value="answer_quality" ${catFilter === 'answer_quality' ? 'selected' : ''}>Answer Quality</option>
            <option value="dashboard_bug" ${catFilter === 'dashboard_bug' ? 'selected' : ''}>Dashboard Bug</option>
            <option value="deploy_failure" ${catFilter === 'deploy_failure' ? 'selected' : ''}>Deploy Failure</option>
            <option value="cost_too_high" ${catFilter === 'cost_too_high' ? 'selected' : ''}>Cost</option>
            <option value="slow_response" ${catFilter === 'slow_response' ? 'selected' : ''}>Slow Response</option>
            <option value="user_preference" ${catFilter === 'user_preference' ? 'selected' : ''}>Preference</option>
          </select>
        </div>
        <button class="btn btn-primary" id="im-feedback-filter-btn">Filter</button>
      </div>
      <div id="im-feedback-submit-container"></div>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>ID</th><th>Category</th><th>Sentiment</th><th>Summary</th><th>Status</th></tr></thead>
          <tbody>`;

      if (feedback.length === 0) {
        html += `<tr><td colspan="5" class="text-center muted">No feedback found.</td></tr>`;
      } else {
        for (const f of feedback) {
          html += `<tr>
            <td><code>${esc(f.id || '').slice(0, 16)}</code></td>
            <td>${renderBadge(f.category)}</td>
            <td>${renderBadge(f.sentiment)}</td>
            <td>${esc((f.summary || '').slice(0, 100))}</td>
            <td>${renderBadge(f.status)}</td>
          </tr>`;
        }
      }

      html += `</tbody></table></div>`;
      targetEl.innerHTML = html;

      document.getElementById('im-feedback-back')?.addEventListener('click', () => renderImprovement(targetEl));
      document.getElementById('im-feedback-filter-btn')?.addEventListener('click', () => renderImprovementFeedback(targetEl));
      document.getElementById('im-feedback-submit-btn')?.addEventListener('click', () => {
        const text = prompt('Enter feedback text:');
        if (!text || !text.trim()) return;
        apiPost('/feedback', { text: text.trim() }).then(r => {
          if (r.ok) { UI.showToast?.('Feedback submitted', 'success'); renderImprovementFeedback(targetEl); }
          else { UI.showToast?.(r.error || 'Submit failed', 'error'); }
        });
      });
    } catch (err) {
      targetEl.innerHTML = UI.renderError('Failed to load', err.message);
    }
  }

  async function renderImprovementOutcomes(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat outcomes...');
    try {
      const typeFilter = document.getElementById('im-outcome-type')?.value || '';
      const statusFilter = document.getElementById('im-outcome-status')?.value || '';
      let path = '/outcomes';
      const params = [];
      if (typeFilter) params.push(`type=${encodeURIComponent(typeFilter)}`);
      if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`);
      if (params.length) path += '?' + params.join('&');

      const res = await apiGet(path);
      const outcomes = res.ok ? (res.data || []) : [];

      let html = `<div class="section-header">
        <h2>Outcomes</h2>
        <div class="section-actions">
          <button class="btn btn-outline" id="im-outcome-back">Back</button>
        </div>
      </div>
      <div class="filter-bar">
        <div class="filter-group">
          <label for="im-outcome-type">Type</label>
          <select id="im-outcome-type">
            <option value="">All</option>
            <option value="github_action" ${typeFilter === 'github_action' ? 'selected' : ''}>GitHub Action</option>
            <option value="render_deploy" ${typeFilter === 'render_deploy' ? 'selected' : ''}>Deploy</option>
            <option value="executor_proposal" ${typeFilter === 'executor_proposal' ? 'selected' : ''}>Proposal</option>
            <option value="operating_loop" ${typeFilter === 'operating_loop' ? 'selected' : ''}>Operating Loop</option>
            <option value="evaluation_suite" ${typeFilter === 'evaluation_suite' ? 'selected' : ''}>Evaluation</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="im-outcome-status">Status</label>
          <select id="im-outcome-status">
            <option value="">All</option>
            <option value="success" ${statusFilter === 'success' ? 'selected' : ''}>Success</option>
            <option value="failed" ${statusFilter === 'failed' ? 'selected' : ''}>Failed</option>
          </select>
        </div>
        <button class="btn btn-primary" id="im-outcome-filter-btn">Filter</button>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Summary</th></tr></thead>
          <tbody>`;

      if (outcomes.length === 0) {
        html += `<tr><td colspan="4" class="text-center muted">No outcomes found.</td></tr>`;
      } else {
        for (const o of outcomes) {
          html += `<tr>
            <td><code>${esc(o.id || '').slice(0, 16)}</code></td>
            <td>${renderBadge(o.outcomeType || o.type)}</td>
            <td>${renderBadge(o.status)}</td>
            <td>${esc((o.summary || '').slice(0, 100))}</td>
          </tr>`;
        }
      }

      html += `</tbody></table></div>`;
      targetEl.innerHTML = html;

      document.getElementById('im-outcome-back')?.addEventListener('click', () => renderImprovement(targetEl));
      document.getElementById('im-outcome-filter-btn')?.addEventListener('click', () => renderImprovementOutcomes(targetEl));
    } catch (err) {
      targetEl.innerHTML = UI.renderError('Failed to load', err.message);
    }
  }

  async function renderImprovementWeaknesses(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat weaknesses...');
    try {
      const res = await apiGet('/weaknesses');
      const weaknesses = res.ok ? (res.data || []) : [];

      let html = `<div class="section-header">
        <h2>Weaknesses</h2>
        <div class="section-actions">
          <button class="btn btn-outline" id="im-weakness-back">Back</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>Title</th><th>Module</th><th>Severity</th><th>Frequency</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>`;

      if (weaknesses.length === 0) {
        html += `<tr><td colspan="6" class="text-center muted">No weaknesses detected.</td></tr>`;
      } else {
        for (const w of weaknesses) {
          html += `<tr>
            <td>${esc(w.title || '')}</td>
            <td>${esc(w.module || '')}</td>
            <td>${renderBadge(w.severity)}</td>
            <td>${esc(w.frequency || 1)}</td>
            <td>${renderBadge(w.status)}</td>
            <td>
              <button class="btn btn-sm btn-primary im-weakness-lesson-btn" data-weakness-id="${esc(w.id)}">Create Lesson</button>
            </td>
          </tr>`;
        }
      }

      html += `</tbody></table></div>`;
      targetEl.innerHTML = html;

      document.getElementById('im-weakness-back')?.addEventListener('click', () => renderImprovement(targetEl));
      document.querySelectorAll('.im-weakness-lesson-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.weaknessId;
          btn.disabled = true;
          btn.textContent = 'Creating...';
          try {
            const r = await apiPost(`/weaknesses/${esc(id)}/lesson`, {});
            if (r.ok) { UI.showToast?.('Lesson created', 'success'); renderImprovementWeaknesses(targetEl); }
            else { UI.showToast?.(r.error || 'Failed', 'error'); btn.disabled = false; btn.textContent = 'Create Lesson'; }
          } catch (err) {
            UI.showToast?.(err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Create Lesson';
          }
        });
      });
    } catch (err) {
      targetEl.innerHTML = UI.renderError('Failed to load', err.message);
    }
  }

  async function renderImprovementLessons(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat lessons...');
    try {
      const searchQuery = document.getElementById('im-lesson-search')?.value || '';
      const path = searchQuery ? `/lessons?q=${encodeURIComponent(searchQuery)}` : '/lessons';
      const res = await apiGet(path);
      const lessons = res.ok ? (res.data || []) : [];

      let html = `<div class="section-header">
        <h2>Lessons Learned</h2>
        <div class="section-actions">
          <button class="btn btn-outline" id="im-lesson-back">Back</button>
          <button class="btn btn-primary" id="im-lesson-create-btn">Create Lesson</button>
        </div>
      </div>
      <div class="filter-bar">
        <div class="filter-group">
          <label for="im-lesson-search">Search Lessons</label>
          <input type="text" id="im-lesson-search" value="${esc(searchQuery)}" placeholder="Search by title, summary...">
        </div>
        <button class="btn btn-primary" id="im-lesson-search-btn">Search</button>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>Title</th><th>Category</th><th>Summary</th><th>Status</th></tr></thead>
          <tbody>`;

      if (lessons.length === 0) {
        html += `<tr><td colspan="4" class="text-center muted">No lessons found.</td></tr>`;
      } else {
        for (const l of lessons) {
          html += `<tr>
            <td>${esc(l.title || '')}</td>
            <td>${renderBadge(l.category)}</td>
            <td>${esc((l.summary || '').slice(0, 80))}</td>
            <td>${renderBadge(l.status)}</td>
          </tr>`;
        }
      }

      html += `</tbody></table></div>`;
      targetEl.innerHTML = html;

      document.getElementById('im-lesson-back')?.addEventListener('click', () => renderImprovement(targetEl));
      document.getElementById('im-lesson-search-btn')?.addEventListener('click', () => renderImprovementLessons(targetEl));
      document.getElementById('im-lesson-create-btn')?.addEventListener('click', () => {
        const title = prompt('Lesson title:');
        if (!title || !title.trim()) return;
        const summary = prompt('Lesson summary:') || '';
        apiPost('/lessons', { title: title.trim(), summary: summary.trim() }).then(r => {
          if (r.ok) { UI.showToast?.('Lesson created', 'success'); renderImprovementLessons(targetEl); }
          else { UI.showToast?.(r.error || 'Failed', 'error'); }
        });
      });
      document.getElementById('im-lesson-search')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') renderImprovementLessons(targetEl);
      });
    } catch (err) {
      targetEl.innerHTML = UI.renderError('Failed to load', err.message);
    }
  }

  async function renderImprovementRegressionCases(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat regression cases...');
    try {
      const res = await apiGet('/regression-cases');
      const data = res.ok ? (res.data || {}) : {};
      const cases = Array.isArray(data) ? data : (data.data || []);
      const suggestions = data.suggestions || [];

      let html = `<div class="section-header">
        <h2>Regression Cases</h2>
        <div class="section-actions">
          <button class="btn btn-outline" id="im-regression-back">Back</button>
        </div>
      </div>`;

      if (suggestions.length > 0) {
        html += `<div class="section-header"><h3>Suggested from Open Weaknesses</h3></div>
          <div class="table-responsive">
            <table class="table">
              <thead><tr><th>Weakness</th><th>Module</th><th>Actions</th></tr></thead>
              <tbody>`;
        for (const s of suggestions) {
          html += `<tr>
            <td>${esc(s.title || '')}</td>
            <td>${esc(s.module || '')}</td>
            <td><button class="btn btn-sm btn-primary im-gen-regression-btn" data-weakness-id="${esc(s.weaknessId)}">Generate Case</button></td>
          </tr>`;
        }
        html += `</tbody></table></div>`;
      }

      html += `<div class="section-header"><h3>Existing Cases</h3></div>
        <div class="table-responsive">
          <table class="table">
            <thead><tr><th>Title</th><th>Module</th><th>Risk</th></tr></thead>
            <tbody>`;

      if (cases.length === 0) {
        html += `<tr><td colspan="3" class="text-center muted">No regression cases yet.</td></tr>`;
      } else {
        for (const c of cases) {
          html += `<tr>
            <td>${esc(c.title || '')}</td>
            <td>${esc(c.targetModule || '')}</td>
            <td>${renderBadge(c.riskLevel)}</td>
          </tr>`;
        }
      }

      html += `</tbody></table></div>`;
      targetEl.innerHTML = html;

      document.getElementById('im-regression-back')?.addEventListener('click', () => renderImprovement(targetEl));
      document.querySelectorAll('.im-gen-regression-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.weaknessId;
          btn.disabled = true;
          btn.textContent = 'Generating...';
          try {
            const r = await apiPost('/regression-cases', { weaknessId: id });
            if (r.ok) { UI.showToast?.('Regression case generated', 'success'); renderImprovementRegressionCases(targetEl); }
            else { UI.showToast?.(r.error || 'Failed', 'error'); btn.disabled = false; btn.textContent = 'Generate Case'; }
          } catch (err) {
            UI.showToast?.(err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Generate Case';
          }
        });
      });
    } catch (err) {
      targetEl.innerHTML = UI.renderError('Failed to load', err.message);
    }
  }

  async function renderImprovementPlans(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat plans...');
    try {
      const res = await apiGet('/plans');
      const plans = res.ok ? (res.data || []) : [];

      let html = `<div class="section-header">
        <h2>Improvement Plans</h2>
        <div class="section-actions">
          <button class="btn btn-outline" id="im-plans-back">Back</button>
          <button class="btn btn-primary" id="im-plans-create-btn">Create Plan</button>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>Title</th><th>Risk</th><th>Status</th><th>Agent</th><th>Actions</th></tr></thead>
          <tbody>`;

      if (plans.length === 0) {
        html += `<tr><td colspan="5" class="text-center muted">No improvement plans.</td></tr>`;
      } else {
        for (const p of plans) {
          html += `<tr>
            <td>${esc(p.title || '')}</td>
            <td>${renderBadge(p.riskLevel)}</td>
            <td>${renderBadge(p.status)}</td>
            <td>${esc(p.recommendedAgent || '-')}</td>
            <td>
              <button class="btn btn-sm btn-outline im-plan-prompt-btn" data-plan-id="${esc(p.id)}">Prompt</button>
              <button class="btn btn-sm btn-primary im-plan-proposal-btn" data-plan-id="${esc(p.id)}">Propose</button>
            </td>
          </tr>`;
        }
      }

      html += `</tbody></table></div>
        <div id="im-plan-result"></div>`;
      targetEl.innerHTML = html;

      document.getElementById('im-plans-back')?.addEventListener('click', () => renderImprovement(targetEl));
      document.getElementById('im-plans-create-btn')?.addEventListener('click', () => {
        const title = prompt('Plan title:');
        if (!title || !title.trim()) return;
        const summary = prompt('Plan summary:') || '';
        apiPost('/plans', { title: title.trim(), summary: summary.trim() }).then(r => {
          if (r.ok) { UI.showToast?.('Plan created', 'success'); renderImprovementPlans(targetEl); }
          else { UI.showToast?.(r.error || 'Failed', 'error'); }
        });
      });

      document.querySelectorAll('.im-plan-prompt-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.planId;
          const agent = prompt('Agent (codex/opencode/hermes/security/regression):', 'codex') || 'codex';
          btn.disabled = true;
          btn.textContent = 'Generating...';
          try {
            const r = await apiPost(`/plans/${esc(id)}/prompt`, { agent });
            if (r.ok) {
              const promptData = r.data || {};
              const container = document.getElementById('im-plan-result');
              container.innerHTML = `<div class="panel" style="margin-top:16px;">
                <h3 class="panel-title">Generated Prompt</h3>
                <pre style="max-height:400px; overflow:auto; background:var(--bg-primary); padding:12px; border-radius:6px; font-size:12px; white-space:pre-wrap;">${esc(JSON.stringify(promptData, null, 2))}</pre>
              </div>`;
              UI.showToast?.('Prompt generated', 'success');
            } else {
              UI.showToast?.(r.error || 'Failed', 'error');
            }
            btn.disabled = false;
            btn.textContent = 'Prompt';
          } catch (err) {
            UI.showToast?.(err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Prompt';
          }
        });
      });

      document.querySelectorAll('.im-plan-proposal-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.planId;
          btn.disabled = true;
          btn.textContent = 'Proposing...';
          try {
            const r = await apiPost(`/plans/${esc(id)}/proposal`, {});
            if (r.ok) {
              UI.showToast?.('Proposal created', 'success');
              const container = document.getElementById('im-plan-result');
              const proposal = r.data || {};
              container.innerHTML = `<div class="panel" style="margin-top:16px;">
                <h3 class="panel-title">Proposal Created</h3>
                <pre style="max-height:300px; overflow:auto; background:var(--bg-primary); padding:12px; border-radius:6px; font-size:12px; white-space:pre-wrap;">${esc(JSON.stringify(proposal, null, 2))}</pre>
              </div>`;
            } else {
              UI.showToast?.(r.error || 'Failed', 'error');
            }
            btn.disabled = false;
            btn.textContent = 'Propose';
          } catch (err) {
            UI.showToast?.(err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Propose';
          }
        });
      });
    } catch (err) {
      targetEl.innerHTML = UI.renderError('Failed to load', err.message);
    }
  }

  async function renderImprovementReport(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Generating report...');
    try {
      const res = await apiGet('/report');
      const report = res.ok ? (res.data || {}) : {};

      let html = `<div class="section-header">
        <h2>Improvement Report</h2>
        <div class="section-actions">
          <button class="btn btn-outline" id="im-report-back">Back</button>
          <button class="btn btn-primary" id="im-report-refresh">Refresh</button>
        </div>
      </div>
      <div class="panel">
        <h3 class="panel-title">${esc(report.title || 'Improvement Report')}</h3>
        <p class="text-muted" style="font-size:12px;">Generated: ${esc(report.generatedAt || '')}</p>
      </div>`;

      if (report.sections && report.sections.length > 0) {
        for (const section of report.sections) {
          html += `<div class="panel" style="margin-top:16px;">
            <h3 class="panel-title">${esc(section.heading || '')}</h3>
            <pre style="white-space:pre-wrap; font-size:13px; background:var(--bg-primary); padding:12px; border-radius:6px; margin:0;">${esc(section.content || 'None')}</pre>
          </div>`;
        }
      } else {
        html += `<div class="panel" style="margin-top:16px;">
          <p class="muted">No report sections available. The improvement module may not be fully loaded.</p>
        </div>`;
      }

      targetEl.innerHTML = html;
      document.getElementById('im-report-back')?.addEventListener('click', () => renderImprovement(targetEl));
      document.getElementById('im-report-refresh')?.addEventListener('click', () => renderImprovementReport(targetEl));
    } catch (err) {
      targetEl.innerHTML = UI.renderError('Failed to generate report', err.message);
    }
  }

  async function renderImprovementProposals(targetEl) {
    targetEl.innerHTML = UI.renderLoading('Memuat proposals...');
    try {
      const plansRes = await apiGet('/plans');
      const plans = plansRes.ok ? (plansRes.data || []) : [];
      const proposals = plans.filter(p => p.linkedProposalIds && p.linkedProposalIds.length > 0);

      let html = `<div class="section-header">
        <h2>Linked Proposals</h2>
        <div class="section-actions">
          <button class="btn btn-outline" id="im-proposals-back">Back</button>
        </div>
      </div>`;

      if (proposals.length === 0) {
        html += `<div class="panel"><p class="muted">No plans with linked proposals found. Create a proposal from an improvement plan first.</p></div>`;
      } else {
        for (const p of proposals) {
          html += `<div class="panel" style="margin-top:12px;">
            <h3 class="panel-title">${esc(p.title || '')}</h3>
            <div class="kv-list">
              <div class="kv-item">
                <span class="kv-key">Plan ID</span>
                <span class="kv-value"><code>${esc(p.id || '')}</code></span>
              </div>
              <div class="kv-item">
                <span class="kv-key">Linked Proposals</span>
                <span class="kv-value">${esc((p.linkedProposalIds || []).length)}</span>
              </div>
              <div class="kv-item">
                <span class="kv-key">Proposal IDs</span>
                <span class="kv-value" style="font-size:11px;">${(p.linkedProposalIds || []).map(id => `<code>${esc(id)}</code>`).join(', ')}</span>
              </div>
            </div>
          </div>`;
        }
      }

      targetEl.innerHTML = html;
      document.getElementById('im-proposals-back')?.addEventListener('click', () => renderImprovement(targetEl));
    } catch (err) {
      targetEl.innerHTML = UI.renderError('Failed to load proposals', err.message);
    }
  }

  window.UI.renderImprovement = renderImprovement;
  window.UI.renderImprovementOverview = renderImprovementOverview;
  window.UI.renderImprovementFeedback = renderImprovementFeedback;
  window.UI.renderImprovementOutcomes = renderImprovementOutcomes;
  window.UI.renderImprovementWeaknesses = renderImprovementWeaknesses;
  window.UI.renderImprovementLessons = renderImprovementLessons;
  window.UI.renderImprovementRegressionCases = renderImprovementRegressionCases;
  window.UI.renderImprovementPlans = renderImprovementPlans;
  window.UI.renderImprovementReport = renderImprovementReport;
  window.UI.renderImprovementProposals = renderImprovementProposals;
  window.IMPROVEMENT_DASHBOARD = {
    renderImprovement, renderImprovementOverview, renderImprovementFeedback,
    renderImprovementOutcomes, renderImprovementWeaknesses, renderImprovementLessons,
    renderImprovementRegressionCases, renderImprovementPlans, renderImprovementReport,
    renderImprovementProposals
  };
})();
