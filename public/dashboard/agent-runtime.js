/* Agent Runtime Dashboard Renderer */

(function() {
  const API = '/api/dashboard/agent-runtime';

  UI.renderAgentRuntime = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading Agent Runtime...');
    try {
      const res = await Api.fetch(API);
      let data = null;
      if (res.ok && res.data) data = res.data;

      let html = '';
      html += '<div class="section-header"><h2>Agent Runtime</h2></div>';
      html += buildAgentRuntimeProfileSection(data);
      html += buildAgentLoadSection(data);
      html += buildTaskPrioritizationSection(data);
      html += buildResponseQualitySection(data);
      html += buildCouncilCostSection(data);
      html += buildAgentRuntimeHealthSection(data);
      html += buildModelStrategySection(data);
      html += buildModelFallbackSection(data);
      html += buildModelCostSection(data);
      html += buildModelLatencySection(data);
      html += buildModelQualitySection(data);
      html += buildPrivacyGuardSection(data);
      html += buildBudgetGovernorSection(data);
      html += buildBenchmarkPlansSection(data);

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-outline" onclick="UI.renderAgentRuntime(document.getElementById(\'tab-content\'))">Refresh</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('Agent Runtime Error', err.message);
    }
  };

  function buildAgentRuntimeProfileSection(data) {
    if (!data || !data.runtimeProfile) return UI.renderEmptyState('', 'Agent Runtime Profile', 'No runtime profile data available.');
    const rp = data.runtimeProfile;
    let html = '<div class="section-header" style="margin-top:16px;"><h3>Agent Runtime Profile</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (rp.activeAgents || 0) + '</div>';
    html += '<div class="stat-label">Active Agents</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (rp.avgLatency !== undefined ? rp.avgLatency.toFixed(0) + 'ms' : '-') + '</div>';
    html += '<div class="stat-label">Avg Latency</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (rp.avgCost !== undefined ? '$' + rp.avgCost.toFixed(4) : '-') + '</div>';
    html += '<div class="stat-label">Avg Cost</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildAgentLoadSection(data) {
    if (!data || !data.agentLoad) return '';
    const al = data.agentLoad;
    const loadColor = al.loadLevel === 'high' ? 'var(--color-danger)' : al.loadLevel === 'medium' ? 'var(--color-warning)' : 'var(--color-success)';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Agent Load</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + loadColor + ';font-size:14px;">' + Utils.escapeHtml(al.loadLevel || 'unknown') + '</div>';
    html += '<div class="stat-label">Load Level</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (al.p0 || 0) + '</div>';
    html += '<div class="stat-label">P0 Tasks</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (al.p1 || 0) + '</div>';
    html += '<div class="stat-label">P1 Tasks</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (al.p2 || 0) + '</div>';
    html += '<div class="stat-label">P2 Tasks</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (al.p3 || 0) + '</div>';
    html += '<div class="stat-label">P3 Tasks</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (al.p4 || 0) + '</div>';
    html += '<div class="stat-label">P4 Tasks</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildTaskPrioritizationSection(data) {
    if (!data || !data.taskPrioritization) return '';
    const tp = data.taskPrioritization;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Task Prioritization</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (tp.distribution) {
      html += '<div class="stat-value" style="font-size:14px;">Priority Distribution</div>';
      for (const [level, count] of Object.entries(tp.distribution)) {
        html += '<p style="font-size:12px;margin-top:4px;">' + Utils.escapeHtml(level.toUpperCase()) + ': ' + count + '</p>';
      }
    } else {
      html += '<div class="stat-value" style="font-size:14px;">No priority data</div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildResponseQualitySection(data) {
    if (!data || !data.responseQuality) return '';
    const rq = data.responseQuality;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Response Quality</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    const scoreColor = (rq.avgScore || 0) >= 80 ? 'var(--color-success)' : (rq.avgScore || 0) >= 60 ? 'var(--color-warning)' : 'var(--color-danger)';
    html += '<div class="stat-value" style="color:' + scoreColor + ';">' + (rq.avgScore !== undefined ? rq.avgScore.toFixed(1) : '-') + '</div>';
    html += '<div class="stat-label">Avg Quality Score</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (rq.lowQualityCount || 0) + '</div>';
    html += '<div class="stat-label">Low Quality Count</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildCouncilCostSection(data) {
    if (!data || !data.councilCost) return '';
    const cc = data.councilCost;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Council Cost</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (cc.totalEstimated !== undefined ? '$' + cc.totalEstimated.toFixed(2) : '-') + '</div>';
    html += '<div class="stat-label">Total Estimated</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (cc.budgetRemaining !== undefined ? '$' + cc.budgetRemaining.toFixed(2) : '-') + '</div>';
    html += '<div class="stat-label">Budget Remaining</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildAgentRuntimeHealthSection(data) {
    if (!data || !data.runtimeHealth) return '';
    const rh = data.runtimeHealth;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Agent Runtime Health</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (rh.healthy || 0) + '</div>';
    html += '<div class="stat-label">Healthy</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (rh.degraded || 0) + '</div>';
    html += '<div class="stat-label">Degraded</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (rh.critical || 0) + '</div>';
    html += '<div class="stat-label">Critical</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (rh.loopRisks || 0) + '</div>';
    html += '<div class="stat-label">Loop Risks</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildModelStrategySection(data) {
    if (!data || !data.modelStrategy) return '';
    const ms = data.modelStrategy;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Model Strategy</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (ms.distribution) {
      html += '<div class="stat-value" style="font-size:14px;">Strategy Distribution</div>';
      for (const [strategy, count] of Object.entries(ms.distribution)) {
        html += '<p style="font-size:12px;margin-top:4px;">' + Utils.escapeHtml(strategy) + ': ' + count + '</p>';
      }
    }
    if (ms.commonRoutes && ms.commonRoutes.length > 0) {
      html += '<div class="stat-value" style="font-size:14px;margin-top:12px;">Common Routes</div>';
      ms.commonRoutes.forEach(function(route) {
        html += '<p style="font-size:12px;margin-top:4px;">' + Utils.escapeHtml(route) + '</p>';
      });
    }
    html += '</div></div>';
    return html;
  }

  function buildModelFallbackSection(data) {
    if (!data || !data.modelFallback) return '';
    const mf = data.modelFallback;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Model Fallback</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (mf.fallbackUsage || 0) + '</div>';
    html += '<div class="stat-label">Fallback Usage</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    const degColor = (mf.degradationRate || 0) > 10 ? 'var(--color-danger)' : 'var(--color-success)';
    html += '<div class="stat-value" style="color:' + degColor + ';">' + (mf.degradationRate !== undefined ? mf.degradationRate.toFixed(1) + '%' : '-') + '</div>';
    html += '<div class="stat-label">Degradation Rate</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildModelCostSection(data) {
    if (!data || !data.modelCost) return '';
    const mc = data.modelCost;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Model Cost</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (mc.estimatedMonthly !== undefined ? '$' + mc.estimatedMonthly.toFixed(2) : '-') + '</div>';
    html += '<div class="stat-label">Estimated Monthly</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">' + Utils.escapeHtml(mc.budgetMode || 'unknown') + '</div>';
    html += '<div class="stat-label">Budget Mode</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildModelLatencySection(data) {
    if (!data || !data.modelLatency) return '';
    const ml = data.modelLatency;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Model Latency</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (ml.avgLatency !== undefined ? ml.avgLatency.toFixed(0) + 'ms' : '-') + '</div>';
    html += '<div class="stat-label">Avg Latency</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + ((ml.regressionAlerts || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)') + ';">' + (ml.regressionAlerts || 0) + '</div>';
    html += '<div class="stat-label">Regression Alerts</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildModelQualitySection(data) {
    if (!data || !data.modelQuality) return '';
    const mq = data.modelQuality;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Model Quality</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (mq.avgQuality !== undefined ? mq.avgQuality.toFixed(1) : '-') + '</div>';
    html += '<div class="stat-label">Avg Quality</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + ((mq.regressionAlerts || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)') + ';">' + (mq.regressionAlerts || 0) + '</div>';
    html += '<div class="stat-label">Regression Alerts</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildPrivacyGuardSection(data) {
    if (!data || !data.privacyGuard) return '';
    const pg = data.privacyGuard;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Privacy Guard</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + ((pg.blockedRoutes || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)') + ';">' + (pg.blockedRoutes || 0) + '</div>';
    html += '<div class="stat-label">Blocked Routes</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (pg.redactedPrompts || 0) + '</div>';
    html += '<div class="stat-label">Redacted Prompts</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildBudgetGovernorSection(data) {
    if (!data || !data.budgetGovernor) return '';
    const bg = data.budgetGovernor;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Budget Governor</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">' + Utils.escapeHtml(bg.currentMode || 'unknown') + '</div>';
    html += '<div class="stat-label">Current Mode</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    const usageColor = (bg.usagePercent || 0) > 90 ? 'var(--color-danger)' : (bg.usagePercent || 0) > 70 ? 'var(--color-warning)' : 'var(--color-success)';
    html += '<div class="stat-value" style="color:' + usageColor + ';">' + (bg.usagePercent !== undefined ? bg.usagePercent.toFixed(1) + '%' : '-') + '</div>';
    html += '<div class="stat-label">Usage %</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildBenchmarkPlansSection(data) {
    if (!data || !data.benchmarkPlans) return '';
    const bp = data.benchmarkPlans;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Benchmark Plans</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (bp.activePlansCount || 0) + '</div>';
    html += '<div class="stat-label">Active Plans</div>';
    html += '</div></div>';
    return html;
  }
})();
