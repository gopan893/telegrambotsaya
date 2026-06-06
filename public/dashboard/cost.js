/* Cost / Budget Dashboard Module */

const COST = {
  async getCostData() {
    return Api.apiGet('/cost');
  },

  async getUsageSummary(period) {
    return Api.apiGet('/cost/summary?period=' + (period || 'daily'));
  },

  async getUsageByAgent() {
    return Api.apiGet('/cost/by-agent');
  },

  async getUsageByModel() {
    return Api.apiGet('/cost/by-model');
  },

  async getUsageByFeature() {
    return Api.apiGet('/cost/by-feature');
  },

  async getBudgetPolicy() {
    return Api.apiGet('/cost/budget');
  },

  async updateBudgetPolicy(policy) {
    return Api.apiPost('/cost/budget', policy);
  },

  async getModelRegistry() {
    return Api.apiGet('/cost/model-registry');
  },

  async updateModelRegistry(action, provider, model, entry) {
    return Api.apiPost('/cost/model-registry', { action, provider, model, entry });
  },

  async runEstimate(params) {
    return Api.apiPost('/cost/estimate', params);
  },

  async getCompressSuggestion(params) {
    return Api.apiPost('/cost/compress-suggestion', params);
  },

  async getAlerts() {
    return Api.apiGet('/cost/alerts');
  }
};

function renderCostTab(targetEl) {
  let html = '<div class="tab-header"><h2>💰 Cost / Budget Governance</h2></div>';
  html += '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">';
  html += '<button class="btn btn-primary btn-sm" onclick="UI._costRefresh()">🔄 Refresh</button>';
  html += '<button class="btn btn-outline btn-sm" onclick="UI._costRefreshSummary(\'daily\')">📅 Daily</button>';
  html += '<button class="btn btn-outline btn-sm" onclick="UI._costRefreshSummary(\'weekly\')">📆 Weekly</button>';
  html += '<button class="btn btn-outline btn-sm" onclick="UI._costRefreshSummary(\'monthly\')">📅 Monthly</button>';
  html += '</div>';
  html += '<div id="cost-content">' + UI.renderLoading('Loading cost data...') + '</div>';
  targetEl.innerHTML = html;
  UI._costRefresh();
}

UI.renderCost = renderCostTab;

UI._costRefresh = async function() {
  const el = document.getElementById('cost-content');
  if (!el) return;
  el.innerHTML = UI.renderLoading('Loading cost data...');

  try {
    const costRes = await COST.getCostData();
    if (!costRes.ok) {
      el.innerHTML = UI.renderError('Failed to load cost data', costRes.error);
      return;
    }
    const d = costRes.data;
    let html = '';

    html += '<div class="card-grid" style="margin-bottom:20px;">';
    html += '<div class="card"><div class="card-title">💰 Mode</div><div class="card-value" style="font-size:16px;">' + (d.modeLabel ? Utils.escapeHtml(d.modeLabel.icon + ' ' + d.modeLabel.label) : Utils.escapeHtml(d.mode || 'unknown')) + '</div></div>';
    html += '<div class="card"><div class="card-title">📊 Daily Tokens</div><div class="card-value">' + Utils.escapeHtml(UI._fmtTokens(d.daily?.totalTokens)) + '</div><div class="card-subtitle">Cost: ' + Utils.escapeHtml(UI._fmtCost(d.daily?.totalEstimatedCost)) + '</div></div>';
    html += '<div class="card"><div class="card-title">📊 Weekly Tokens</div><div class="card-value">' + Utils.escapeHtml(UI._fmtTokens(d.weekly?.totalTokens)) + '</div><div class="card-subtitle">Cost: ' + Utils.escapeHtml(UI._fmtCost(d.weekly?.totalEstimatedCost)) + '</div></div>';
    html += '<div class="card"><div class="card-title">📊 Monthly Tokens</div><div class="card-value">' + Utils.escapeHtml(UI._fmtTokens(d.monthly?.totalTokens)) + '</div><div class="card-subtitle">Cost: ' + Utils.escapeHtml(UI._fmtCost(d.monthly?.totalEstimatedCost)) + '</div></div>';
    html += '</div>';

    html += '<div style="display:flex; gap:16px; flex-wrap:wrap;">';

    html += '<div class="card" style="flex:1; min-width:280px;"><div class="card-title">Usage by Model</div><div id="cost-by-model" style="margin-top:8px; font-size:13px;">' + UI.renderLoading() + '</div></div>';
    html += '<div class="card" style="flex:1; min-width:280px;"><div class="card-title">Usage by Agent</div><div id="cost-by-agent" style="margin-top:8px; font-size:13px;">' + UI.renderLoading() + '</div></div>';

    html += '</div>';

    html += '<div style="margin-top:16px; display:flex; gap:16px; flex-wrap:wrap;">';
    html += '<div class="card" style="flex:1; min-width:280px;"><div class="card-title">Usage by Feature</div><div id="cost-by-feature" style="margin-top:8px; font-size:13px;">' + UI.renderLoading() + '</div></div>';
    html += '<div class="card" style="flex:1; min-width:280px;"><div class="card-title">Budget Policy</div><div id="cost-budget" style="margin-top:8px; font-size:13px;">' + UI.renderLoading() + '</div></div>';
    html += '</div>';

    html += '<div style="margin-top:16px; display:flex; gap:16px; flex-wrap:wrap;">';
    html += '<div class="card" style="flex:1; min-width:280px;"><div class="card-title">Cost Alerts</div><div id="cost-alerts" style="margin-top:8px; font-size:13px;">' + UI.renderLoading() + '</div></div>';
    html += '<div class="card" style="flex:1; min-width:280px;"><div class="card-title">Model Registry</div><div id="cost-model-registry" style="margin-top:8px; font-size:13px;">' + UI.renderLoading() + '</div></div>';
    html += '</div>';

    html += '<div style="margin-top:16px;">';
    html += '<div class="card"><div class="card-title">Cost Estimate</div>';
    html += '<div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">';
    html += '<input type="text" id="cost-estimate-provider" placeholder="provider (openai)" class="input" style="width:120px;">';
    html += '<input type="text" id="cost-estimate-model" placeholder="model (gpt-4o-mini)" class="input" style="width:140px;">';
    html += '<input type="number" id="cost-estimate-input" placeholder="input tokens" class="input" style="width:100px;">';
    html += '<input type="number" id="cost-estimate-output" placeholder="output tokens" class="input" style="width:100px;">';
    html += '<button class="btn btn-outline btn-sm" onclick="UI._costRunEstimate()">🔮 Estimate</button></div>';
    html += '<div id="cost-estimate-result" style="margin-top:8px; font-family:var(--font-mono); font-size:13px;"></div>';
    html += '</div></div>';

    html += '<div style="margin-top:16px;">';
    html += '<div class="card"><div class="card-title">Prompt Compression Suggestion</div>';
    html += '<div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">';
    html += '<textarea id="cost-compress-text" placeholder="Enter prompt text to compress..." class="input" style="width:100%; min-height:60px;"></textarea>';
    html += '<button class="btn btn-outline btn-sm" onclick="UI._costCompress()">✂️ Compress</button></div>';
    html += '<div id="cost-compress-result" style="margin-top:8px; font-family:var(--font-mono); font-size:13px; white-space:pre-wrap;"></div>';
    html += '</div></div>';

    html += '<div style="margin-top:16px;">';
    html += '<div class="card"><div class="card-title">Trend (Last 7 Days)</div>';
    html += '<div id="cost-trend" style="margin-top:8px; font-size:13px;">' + UI.renderLoading() + '</div></div></div>';

    el.innerHTML = html;

    UI._costLoadByModel();
    UI._costLoadByAgent();
    UI._costLoadByFeature();
    UI._costLoadBudget();
    UI._costLoadAlerts();
    UI._costLoadModelRegistry();
    UI._costLoadTrend();
  } catch (err) {
    el.innerHTML = UI.renderError('Exception', err.message);
  }
};

UI._costRefreshSummary = async function(period) {
  const el = document.getElementById('cost-content');
  if (!el) return;
  try {
    const res = await COST.getUsageSummary(period);
    if (!res.ok) { Utils.showToast('Failed: ' + res.error, 'error'); return; }
    const d = res.data.summary;
    Utils.showToast(period + ' usage: ' + UI._fmtTokens(d.totalTokens) + ' tokens, ' + UI._fmtCost(d.totalEstimatedCost), 'success');
  } catch (err) {
    Utils.showToast('Error: ' + err.message, 'error');
  }
};

UI._costLoadByModel = async function() {
  const el = document.getElementById('cost-by-model');
  if (!el) return;
  const res = await COST.getUsageByModel();
  if (!res.ok) { el.innerHTML = UI.renderError('', res.error); return; }
  const data = res.data.byModel || {};
  const entries = Object.entries(data);
  if (entries.length === 0) { el.innerHTML = '<span class="muted">No data</span>'; return; }
  let html = '<table class="table"><tr><th>Model</th><th>Tokens</th><th>Cost</th></tr>';
  entries.sort((a, b) => b[1].cost - a[1].cost);
  for (const [model, info] of entries.slice(0, 5)) {
    html += '<tr><td>' + Utils.escapeHtml(model || 'unknown') + '</td><td>' + UI._fmtTokens(info.tokens) + '</td><td>' + UI._fmtCost(info.cost) + '</td></tr>';
  }
  html += '</table>';
  el.innerHTML = html;
};

UI._costLoadByAgent = async function() {
  const el = document.getElementById('cost-by-agent');
  if (!el) return;
  const res = await COST.getUsageByAgent();
  if (!res.ok) { el.innerHTML = UI.renderError('', res.error); return; }
  const data = res.data.byAgent || {};
  const entries = Object.entries(data);
  if (entries.length === 0) { el.innerHTML = '<span class="muted">No data</span>'; return; }
  let html = '<table class="table"><tr><th>Agent</th><th>Tokens</th><th>Cost</th></tr>';
  entries.sort((a, b) => b[1].cost - a[1].cost);
  for (const [agent, info] of entries.slice(0, 5)) {
    html += '<tr><td>' + Utils.escapeHtml(agent || 'unknown') + '</td><td>' + UI._fmtTokens(info.tokens) + '</td><td>' + UI._fmtCost(info.cost) + '</td></tr>';
  }
  html += '</table>';
  el.innerHTML = html;
};

UI._costLoadByFeature = async function() {
  const el = document.getElementById('cost-by-feature');
  if (!el) return;
  const res = await COST.getUsageByFeature();
  if (!res.ok) { el.innerHTML = UI.renderError('', res.error); return; }
  const data = res.data.byFeature || {};
  const entries = Object.entries(data);
  if (entries.length === 0) { el.innerHTML = '<span class="muted">No data</span>'; return; }
  let html = '<table class="table"><tr><th>Feature</th><th>Count</th><th>Tokens</th><th>Cost</th></tr>';
  entries.sort((a, b) => b[1].cost - a[1].cost);
  for (const [feature, info] of entries.slice(0, 5)) {
    html += '<tr><td>' + Utils.escapeHtml(feature || 'unknown') + '</td><td>' + info.count + '</td><td>' + UI._fmtTokens(info.tokens) + '</td><td>' + UI._fmtCost(info.cost) + '</td></tr>';
  }
  html += '</table>';
  el.innerHTML = html;
};

UI._costLoadBudget = async function() {
  const el = document.getElementById('cost-budget');
  if (!el) return;
  const res = await COST.getBudgetPolicy();
  if (!res.ok) { el.innerHTML = UI.renderError('', res.error); return; }
  const policy = res.data.policy;
  let html = '<div style="font-size:13px;">';
  html += '<div>Daily Token Limit: <b>' + UI._fmtTokens(policy.dailyTokenLimit) + '</b></div>';
  html += '<div>Daily Cost Limit: <b>' + UI._fmtCost(policy.dailyCostLimit) + '</b></div>';
  html += '<div>Weekly Token Limit: <b>' + UI._fmtTokens(policy.weeklyTokenLimit) + '</b></div>';
  html += '<div>Monthly Token Limit: <b>' + UI._fmtTokens(policy.monthlyTokenLimit) + '</b></div>';
  html += '<div>Warning Threshold: <b>' + (policy.warningThresholdPercent || 80) + '%</b></div>';
  html += '<div>Hard Limit: <b>' + (policy.hardLimitEnabled ? 'ENABLED' : 'DISABLED') + '</b></div>';
  html += '<div>Overage with Approval: <b>' + (policy.allowedOverageWithApproval ? 'Yes' : 'No') + '</b></div>';
  html += '</div>';
  el.innerHTML = html;
};

UI._costLoadAlerts = async function() {
  const el = document.getElementById('cost-alerts');
  if (!el) return;
  const res = await COST.getAlerts();
  if (!res.ok) { el.innerHTML = UI.renderError('', res.error); return; }
  const alerts = res.data.alerts || [];
  if (alerts.length === 0) { el.innerHTML = '<span class="muted">No alerts</span>'; return; }
  let html = '<div style="font-size:13px; max-height:200px; overflow-y:auto;">';
  for (const a of alerts.slice(0, 10)) {
    const sevColor = a.severity === 'critical' ? 'var(--color-danger)' : (a.severity === 'warning' ? 'var(--color-warning)' : 'var(--muted)');
    html += '<div style="padding:4px 0; border-bottom:1px solid var(--border);"><span style="color:' + sevColor + ';">●</span> <b>' + Utils.escapeHtml(a.title) + '</b>: ' + Utils.escapeHtml(a.message) + ' <span class="muted">' + new Date(a.createdAt).toLocaleString() + '</span></div>';
  }
  html += '</div>';
  el.innerHTML = html;
};

UI._costLoadModelRegistry = async function() {
  const el = document.getElementById('cost-model-registry');
  if (!el) return;
  const res = await COST.getModelRegistry();
  if (!res.ok) { el.innerHTML = UI.renderError('', res.error); return; }
  const models = res.data.models || [];
  if (models.length === 0) { el.innerHTML = '<span class="muted">No models</span>'; return; }
  let html = '<table class="table" style="font-size:11px;"><tr><th>Provider</th><th>Model</th><th>Input $/M</th><th>Output $/M</th><th>Enabled</th></tr>';
  for (const m of models) {
    html += '<tr><td>' + Utils.escapeHtml(m.provider) + '</td><td>' + Utils.escapeHtml(m.model) + '</td><td>' + Utils.escapeHtml(m.inputCostPerMillionTokens) + '</td><td>' + Utils.escapeHtml(m.outputCostPerMillionTokens) + '</td><td>' + (m.enabled ? '✅' : '❌') + '</td></tr>';
  }
  html += '</table>';
  el.innerHTML = html;
};

UI._costLoadTrend = async function() {
  const el = document.getElementById('cost-trend');
  if (!el) return;
  const res = await COST.getUsageSummary('daily');
  if (!res.ok) { el.innerHTML = UI.renderError('', res.error); return; }
  const trend = res.data.trend || [];
  if (trend.length === 0) { el.innerHTML = '<span class="muted">No trend data</span>'; return; }
  let html = '<table class="table" style="font-size:12px;"><tr><th>Date</th><th>Tokens</th><th>Cost</th><th>Events</th></tr>';
  for (const t of trend) {
    html += '<tr><td>' + Utils.escapeHtml(t.date) + '</td><td>' + UI._fmtTokens(t.tokens) + '</td><td>' + UI._fmtCost(t.cost) + '</td><td>' + t.events + '</td></tr>';
  }
  html += '</table>';
  el.innerHTML = html;
};

UI._costRunEstimate = async function() {
  const el = document.getElementById('cost-estimate-result');
  if (!el) return;
  const provider = document.getElementById('cost-estimate-provider')?.value || 'openai';
  const model = document.getElementById('cost-estimate-model')?.value || 'gpt-4o-mini';
  const inputTokens = parseInt(document.getElementById('cost-estimate-input')?.value) || 0;
  const outputTokens = parseInt(document.getElementById('cost-estimate-output')?.value) || 0;
  const res = await COST.runEstimate({ provider, model, inputTokens, outputTokens });
  if (!res.ok) { el.innerHTML = 'Error: ' + res.error; return; }
  const est = res.data.estimate;
  el.innerHTML = '<pre style="background:var(--bg-secondary); padding:8px; border-radius:4px;">' + Utils.escapeHtml(JSON.stringify(est, null, 2)) + '</pre>';
};

UI._costCompress = async function() {
  const el = document.getElementById('cost-compress-result');
  if (!el) return;
  const text = document.getElementById('cost-compress-text')?.value || '';
  if (!text) { el.innerHTML = 'Please enter text'; return; }
  const res = await COST.getCompressSuggestion({ text });
  if (!res.ok) { el.innerHTML = 'Error: ' + res.error; return; }
  const sug = res.data.suggestion;
  let html = '<div style="background:var(--bg-secondary); padding:8px; border-radius:4px;">';
  html += '<div>Original: <b>' + UI._fmtTokens(sug.originalTokens) + '</b> tokens</div>';
  html += '<div>Compressed: <b>' + UI._fmtTokens(sug.compressedTokens) + '</b> tokens</div>';
  html += '<div>Saved: <b>' + UI._fmtTokens(sug.savedTokens) + '</b> tokens (ratio: ' + (sug.ratio * 100).toFixed(0) + '%)</div>';
  html += '<div style="margin-top:4px; padding:8px; background:var(--bg-primary); border-radius:4px; max-height:150px; overflow-y:auto;"><pre style="margin:0; white-space:pre-wrap; font-size:11px;">' + Utils.escapeHtml(sug.compressed) + '</pre></div>';
  html += '</div>';
  el.innerHTML = html;
};

UI._fmtTokens = function(tokens) {
  if (tokens === null || tokens === undefined || isNaN(tokens)) return '0';
  const n = Number(tokens);
  if (n < 1000) return String(n);
  if (n < 1000000) return (n / 1000).toFixed(1) + 'K';
  return (n / 1000000).toFixed(2) + 'M';
};

UI._fmtCost = function(cost) {
  if (cost === null || cost === undefined || cost === 'unknown') return 'unknown';
  const n = Number(cost);
  if (isNaN(n)) return 'unknown';
  if (n < 0.0001) return '$' + n.toExponential(2);
  if (n < 1) return '$' + n.toFixed(6);
  return '$' + n.toFixed(4);
};
