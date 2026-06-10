/* Workflow Studio Dashboard Renderer */

(function() {
  const API = '/api/dashboard/workflow-studio';

  UI.renderWorkflowStudio = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading Workflow Studio...');
    try {
      const res = await Api.fetch(API);
      let data = null;
      if (res.ok && res.data) data = res.data;

      let html = '';
      html += '<div class="section-header"><h2>User Workflow Studio</h2></div>';
      html += buildWorkflowTemplatesSection(data);
      html += buildNaturalLanguageParserSection(data);
      html += buildWorkflowDraftsSection(data);
      html += buildStepEditorSection(data);
      html += buildRiskSimulationSection(data);
      html += buildApprovalMapSection(data);
      html += buildDryRunResultSection(data);
      html += buildSchedulePlanSection(data);
      html += buildRunHistorySection(data);
      html += buildProposalLinksSection(data);
      html += buildBridgeSection(data);

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-outline" onclick="UI.renderWorkflowStudio(document.getElementById(\'tab-content\'))">Refresh</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('Workflow Studio Error', err.message);
    }
  };

  function buildWorkflowTemplatesSection(data) {
    let html = '<div class="section-header" style="margin-top:16px;"><h3>Workflow Templates</h3></div>';
    html += '<div class="card-grid">';
    const templates = [
      { name: 'Daily Summary', desc: 'Daily system summary' },
      { name: 'Error Alert', desc: 'Alert on errors' },
      { name: 'Weekly Review', desc: 'Weekly performance review' },
      { name: 'Deploy Check', desc: 'Pre-deploy validation' },
      { name: 'Backup Workflow', desc: 'System backup' },
      { name: 'Health Monitor', desc: 'Health monitoring' }
    ];
    for (const t of templates) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="font-size:14px;">' + Utils.escapeHtml(t.name) + '</div>';
      html += '<div class="stat-label">' + Utils.escapeHtml(t.desc) + '</div>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function buildNaturalLanguageParserSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Natural Language Parser</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">Convert natural language to workflow steps</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Enter a description to parse into workflow actions.</p>';
    html += '</div></div>';
    return html;
  }

  function buildWorkflowDraftsSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Workflow Drafts</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">' + (data && data.workflowCount || 0) + ' workflow(s)</div>';
    html += '<div class="stat-label">Total workflows in draft</div>';
    html += '</div></div>';
    return html;
  }

  function buildStepEditorSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Step Editor</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">Add, remove, and configure workflow steps</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Step types: read, analyze, notify, device_action, plugin_action, rag_search, model_route.</p>';
    html += '</div></div>';
    return html;
  }

  function buildRiskSimulationSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Risk Simulation</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">Simulate workflow risk before execution</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">READ-ONLY — Risk simulation only.</p>';
    html += '</div></div>';
    return html;
  }

  function buildApprovalMapSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Approval Map</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">View required approvals per workflow</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Owner, admin, and evaluation approvals.</p>';
    html += '</div></div>';
    return html;
  }

  function buildDryRunResultSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Dry-Run Result</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">Preview workflow execution without side effects</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">READ-ONLY — No real actions executed.</p>';
    html += '</div></div>';
    return html;
  }

  function buildSchedulePlanSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Schedule Plan</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">Configure workflow scheduling (cron)</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Set recurring workflow execution schedules.</p>';
    html += '</div></div>';
    return html;
  }

  function buildRunHistorySection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Run History</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">View past workflow executions</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Track workflow run status and outcomes.</p>';
    html += '</div></div>';
    return html;
  }

  function buildProposalLinksSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Proposal Links</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">Workflow actions go through proposal flow</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Write/external actions require approval via Evaluation v2.</p>';
    html += '</div></div>';
    return html;
  }

  function buildBridgeSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Integration Bridges</h3></div>';
    html += '<div class="card-grid">';
    const bridges = [
      { name: 'Recipe Bridge', desc: 'Convert recipes to workflows' },
      { name: 'Device Bridge', desc: 'Device action steps' },
      { name: 'Plugin Bridge', desc: 'Plugin action steps' },
      { name: 'RAG Bridge', desc: 'RAG search steps' },
      { name: 'Model Bridge', desc: 'Model routing steps' },
      { name: 'Operating Loop', desc: 'Loop integration' }
    ];
    for (const b of bridges) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="font-size:14px;">' + Utils.escapeHtml(b.name) + '</div>';
      html += '<div class="stat-label">' + Utils.escapeHtml(b.desc) + '</div>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }
})();
