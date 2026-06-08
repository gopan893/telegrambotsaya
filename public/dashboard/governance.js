/* Governance Policy & Capability Control Dashboard */

const Governance = (() => {
  const CACHE_TTL = 30000;
  let cache = {};

  function isCached(key) {
    const entry = cache[key];
    if (!entry) return false;
    if (Date.now() - entry.ts > CACHE_TTL) return false;
    return true;
  }

  function setCache(key, data) {
    cache[key] = { data, ts: Date.now() };
  }

  async function fetchGovernanceStatus() {
    if (isCached('status')) return cache.status.data;
    const res = await Api.get('/api/dashboard/governance');
    if (res.ok) setCache('status', res.data);
    return res.ok ? res.data : null;
  }

  async function fetchCapabilities(filters) {
    const params = new URLSearchParams(filters || {});
    const res = await Api.get(`/api/dashboard/governance/capabilities?${params}`);
    return res.ok ? res.data : [];
  }

  async function fetchCapabilityDetail(id) {
    const res = await Api.get(`/api/dashboard/governance/capabilities/${encodeURIComponent(id)}`);
    return res.ok ? res.data : null;
  }

  async function fetchPolicies() {
    if (isCached('policies')) return cache.policies.data;
    const res = await Api.get('/api/dashboard/governance/policies');
    if (res.ok) setCache('policies', res.data);
    return res.ok ? res.data : null;
  }

  async function fetchAudit(filters) {
    const params = new URLSearchParams(filters || {});
    const res = await Api.get(`/api/dashboard/governance/audit?${params}`);
    return res.ok ? { events: res.data, summary: res.summary } : { events: [], summary: {} };
  }

  async function fetchBlocked() {
    const res = await Api.get('/api/dashboard/governance/blocked');
    return res.ok ? res.data : [];
  }

  async function postSimulate(action, actor, context) {
    const res = await Api.post('/api/dashboard/governance/simulate', { action, actor, context });
    return res.ok ? res.data : null;
  }

  async function postSecretScan(payload) {
    const res = await Api.post('/api/dashboard/governance/secret-scan', { payload });
    return res.ok ? res.data : null;
  }

  async function postValidate(action, actor, context) {
    const res = await Api.post('/api/dashboard/governance/validate', { action, actor, context });
    return res.ok ? { data: res.data, explanation: res.explanation } : null;
  }

  function renderGovernanceTab(container) {
    if (!container) return;
    container.innerHTML = `
      <div style="padding:16px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
          <h2 style="margin:0;">🛡️ Unified Governance Policy Engine</h2>
          <div>
            <button class="btn btn-outline" onclick="Governance.refreshGovernance()" style="margin-right:8px;">⟳ Refresh</button>
            <span id="gov-status-badge" class="badge badge-info">Loading...</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:12px; margin-bottom:20px;">
          <div class="stat-card" style="padding:16px; background:var(--card-bg); border-radius:8px; border:1px solid var(--border);">
            <div class="stat-value" id="gov-stat-capabilities">0</div>
            <div class="stat-label">Capabilities</div>
          </div>
          <div class="stat-card" style="padding:16px; background:var(--card-bg); border-radius:8px; border:1px solid var(--border);">
            <div class="stat-value" id="gov-stat-modules">0</div>
            <div class="stat-label">Modules</div>
          </div>
          <div class="stat-card" style="padding:16px; background:var(--card-bg); border-radius:8px; border:1px solid var(--border);">
            <div class="stat-value" id="gov-stat-blocked">0</div>
            <div class="stat-label">Blocked Actions</div>
          </div>
          <div class="stat-card" style="padding:16px; background:var(--card-bg); border-radius:8px; border:1px solid var(--border);">
            <div class="stat-value" id="gov-stat-audit">0</div>
            <div class="stat-label">Audit Events</div>
          </div>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
          <button class="btn btn-outline" onclick="Governance.showSection('capabilities')">📋 Capabilities</button>
          <button class="btn btn-outline" onclick="Governance.showSection('policies')">📜 Policies</button>
          <button class="btn btn-outline" onclick="Governance.showSection('simulator')">🧪 Simulator</button>
          <button class="btn btn-outline" onclick="Governance.showSection('secret-scan')">🔍 Secret Scan</button>
          <button class="btn btn-outline" onclick="Governance.showSection('audit')">🧾 Audit</button>
          <button class="btn btn-outline" onclick="Governance.showSection('blocked')">⛔ Blocked</button>
        </div>

        <div id="gov-content-area">
          <div class="empty-state">
            <span class="empty-state-emoji">🛡️</span>
            <h3>Governance Center</h3>
            <p>Select a section above to view details.</p>
          </div>
        </div>
      </div>
    `;
    Governance.refreshGovernance();
  }

  async function refreshGovernance() {
    const badge = document.getElementById('gov-status-badge');
    if (badge) badge.textContent = 'Loading...';

    const status = await fetchGovernanceStatus();
    if (!status) {
      if (badge) badge.textContent = 'Offline';
      return;
    }

    if (badge) badge.textContent = 'Online';

    const elCap = document.getElementById('gov-stat-capabilities');
    const elMod = document.getElementById('gov-stat-modules');
    const elBlocked = document.getElementById('gov-stat-blocked');
    const elAudit = document.getElementById('gov-stat-audit');

    if (elCap && status.capabilities) elCap.textContent = status.capabilities.total || 0;
    if (elMod && status.capabilities) elMod.textContent = status.capabilities.modules || 0;
    if (elBlocked && status.audit && status.audit.recentSummary) elBlocked.textContent = status.audit.recentSummary.blocked || 0;
    if (elAudit && status.audit) elAudit.textContent = status.audit.totalEvents || 0;
  }

  async function showSection(section) {
    const area = document.getElementById('gov-content-area');
    if (!area) return;

    switch (section) {
      case 'capabilities':
        await renderCapabilities(area);
        break;
      case 'policies':
        await renderPolicies(area);
        break;
      case 'simulator':
        renderSimulator(area);
        break;
      case 'secret-scan':
        renderSecretScan(area);
        break;
      case 'audit':
        await renderAudit(area);
        break;
      case 'blocked':
        await renderBlocked(area);
        break;
      default:
        area.innerHTML = `<div class="empty-state"><span class="empty-state-emoji">❓</span><h3>Unknown section</h3></div>`;
    }
  }

  async function renderCapabilities(area) {
    area.innerHTML = `<div class="loading">Loading capabilities...</div>`;
    const capabilities = await fetchCapabilities();
    if (!capabilities || !capabilities.length) {
      area.innerHTML = `<div class="empty-state"><span class="empty-state-emoji">📋</span><h3>No capabilities found</h3></div>`;
      return;
    }

    const modules = [...new Set(capabilities.map(c => c.module))];
    let html = `
      <div style="margin-bottom:12px;">
        <label>Filter by module:</label>
        <select id="gov-cap-filter-module" onchange="Governance.filterCapabilities()" style="margin-left:8px; padding:4px 8px; background:var(--input-bg); color:var(--text); border:1px solid var(--border); border-radius:4px;">
          <option value="">All modules</option>
          ${modules.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <label style="margin-left:16px;">Risk level:</label>
        <select id="gov-cap-filter-risk" onchange="Governance.filterCapabilities()" style="margin-left:8px; padding:4px 8px; background:var(--input-bg); color:var(--text); border:1px solid var(--border); border-radius:4px;">
          <option value="">All risks</option>
          <option value="read_only">Read Only</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="danger">Danger</option>
        </select>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table" style="width:100%; font-size:13px;">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Module</th>
              <th>Action Type</th>
              <th>Risk</th>
              <th>External</th>
              <th>Eval</th>
              <th>Approval</th>
              <th>Secret</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="gov-cap-tbody">
            ${capabilities.map(c => `
              <tr>
                <td><a href="#" onclick="Governance.showCapabilityDetail('${c.id}'); return false;" style="color:var(--accent);">${c.name}</a></td>
                <td>${c.module}</td>
                <td><span class="badge badge-info">${c.actionType}</span></td>
                <td><span class="badge ${c.riskLevel === 'danger' ? 'badge-danger' : c.riskLevel === 'high' ? 'badge-warning' : 'badge-info'}">${c.riskLevel}</span></td>
                <td>${c.externalSystem || '-'}</td>
                <td>${c.requiresEvaluation ? '✅' : '❌'}</td>
                <td>${c.requiresExecutorApproval ? '✅' : '❌'}</td>
                <td>${c.requiresSecretScan ? '✅' : '❌'}</td>
                <td>${c.enabled ? '✅ Enabled' : '❌ Disabled'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top:8px; color:var(--text-secondary); font-size:12px;">Total: ${capabilities.length} capabilities</div>
    `;
    area.innerHTML = html;
  }

  async function filterCapabilities() {
    const moduleFilter = document.getElementById('gov-cap-filter-module')?.value || '';
    const riskFilter = document.getElementById('gov-cap-filter-risk')?.value || '';
    const filters = {};
    if (moduleFilter) filters.module = moduleFilter;
    if (riskFilter) filters.riskLevel = riskFilter;

    const area = document.getElementById('gov-content-area');
    if (!area) return;
    area.innerHTML = `<div class="loading">Filtering...</div>`;
    const capabilities = await fetchCapabilities(filters);
    if (!capabilities || !capabilities.length) {
      area.innerHTML = `<div class="empty-state"><span class="empty-state-emoji">📋</span><h3>No capabilities match</h3></div>`;
      return;
    }
    await renderCapabilities(area);
  }

  async function showCapabilityDetail(id) {
    const area = document.getElementById('gov-content-area');
    if (!area) return;
    area.innerHTML = `<div class="loading">Loading detail...</div>`;
    const detail = await fetchCapabilityDetail(id);
    if (!detail) {
      area.innerHTML = `<div class="empty-state"><span class="empty-state-emoji">❌</span><h3>Capability not found</h3></div>`;
      return;
    }

    const cap = detail;
    const contract = detail.contract || {};
    area.innerHTML = `
      <div style="margin-bottom:12px;">
        <button class="btn btn-outline" onclick="Governance.showSection('capabilities')">← Back to capabilities</button>
      </div>
      <div style="background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:20px;">
        <h3 style="margin-top:0;">${cap.id}</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div><strong>Module:</strong> ${cap.module}</div>
          <div><strong>Name:</strong> ${cap.name}</div>
          <div><strong>Action Type:</strong> <span class="badge badge-info">${cap.actionType}</span></div>
          <div><strong>Risk Level:</strong> <span class="badge ${cap.riskLevel === 'danger' ? 'badge-danger' : cap.riskLevel === 'high' ? 'badge-warning' : 'badge-info'}">${cap.riskLevel}</span></div>
          <div><strong>External System:</strong> ${cap.externalSystem || 'None'}</div>
          <div><strong>Enabled:</strong> ${cap.enabled ? '✅ Yes' : '❌ No'}</div>
          <div><strong>Requires Owner:</strong> ${cap.requiresOwner ? '✅' : '❌'}</div>
          <div><strong>Requires Admin:</strong> ${cap.requiresAdmin ? '✅' : '❌'}</div>
          <div><strong>Requires Evaluation:</strong> ${cap.requiresEvaluation ? '✅' : '❌'}</div>
          <div><strong>Requires Approval:</strong> ${cap.requiresExecutorApproval ? '✅' : '❌'}</div>
          <div><strong>Requires Secret Scan:</strong> ${cap.requiresSecretScan ? '✅' : '❌'}</div>
          <div><strong>Requires Cost Guard:</strong> ${cap.requiresCostGuard ? '✅' : '❌'}</div>
        </div>
        ${contract.restrictions ? `
          <div style="margin-top:16px;">
            <strong>Restrictions:</strong>
            <ul style="margin:8px 0;">
              ${contract.restrictions.map(r => `<li>${r}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${cap.description ? `<div style="margin-top:12px;"><strong>Description:</strong> ${cap.description}</div>` : ''}
      </div>
    `;
  }

  async function renderPolicies(area) {
    area.innerHTML = `<div class="loading">Loading policies...</div>`;
    const data = await fetchPolicies();
    if (!data) {
      area.innerHTML = `<div class="empty-state"><span class="empty-state-emoji">📜</span><h3>No policy data</h3></div>`;
      return;
    }

    const rulesEntries = Object.entries(data.rules || {});
    const contracts = data.contracts || [];
    const approvalFlow = data.approvalFlow || [];
    const policy = data.governancePolicy || {};

    area.innerHTML = `
      <div style="display:grid; gap:20px;">
        <div style="background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:16px;">
          <h4 style="margin:0 0 12px;">Governance Policy v${policy.version || '1.0'}</h4>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px,1fr)); gap:6px;">
            ${rulesEntries.map(([key, val]) => `
              <div style="display:flex; align-items:center; gap:6px; font-size:13px;">
                <span style="color:${val ? 'var(--success)' : 'var(--danger)'};">${val ? '✅' : '❌'}</span>
                <span>${key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:16px;">
          <h4 style="margin:0 0 12px;">Approval Flow</h4>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${approvalFlow.map((step, i) => `
              <span class="badge badge-info">${i + 1}. ${step.replace(/_/g, ' ')}</span>
              ${i < approvalFlow.length - 1 ? '<span style="color:var(--text-secondary);">→</span>' : ''}
            `).join('')}
          </div>
        </div>

        <div style="background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:16px;">
          <h4 style="margin:0 0 12px;">Capability Contracts (${contracts.length})</h4>
          <div style="overflow-x:auto;">
            <table class="data-table" style="width:100%; font-size:12px;">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Module</th>
                  <th>Action Type</th>
                  <th>Risk</th>
                  <th>Eval</th>
                  <th>Approval</th>
                  <th>Secret</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Restrictions</th>
                </tr>
              </thead>
              <tbody>
                ${contracts.map(c => `
                  <tr>
                    <td>${c.capabilityId}</td>
                    <td>${c.module}</td>
                    <td><span class="badge badge-info">${c.actionType}</span></td>
                    <td><span class="badge ${c.riskLevel === 'danger' ? 'badge-danger' : c.riskLevel === 'high' ? 'badge-warning' : 'badge-info'}">${c.riskLevel}</span></td>
                    <td>${c.requires.evaluation ? '✅' : '❌'}</td>
                    <td>${c.requires.executorApproval ? '✅' : '❌'}</td>
                    <td>${c.requires.secretScan ? '✅' : '❌'}</td>
                    <td>${c.requires.costGuard ? '✅' : '❌'}</td>
                    <td>${c.enabled ? '✅' : '❌'}</td>
                    <td style="font-size:11px;">${(c.restrictions || []).join(', ') || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderSimulator(area) {
    area.innerHTML = `
      <div style="max-width:800px;">
        <div style="background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:16px;">
          <h4 style="margin:0 0 12px;">🧪 Action Policy Simulator</h4>
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">Simulate any action against governance policy. No action is executed.</p>
          <div class="form-group">
            <label for="gov-sim-action">Action / Command</label>
            <input type="text" id="gov-sim-action" class="form-input dark-input" placeholder="e.g., github.push.propose, deploy.propose, gmail.send" style="width:100%;">
          </div>
          <div class="form-group">
            <label for="gov-sim-context">Context (optional JSON)</label>
            <textarea id="gov-sim-context" class="form-input dark-input" rows="3" placeholder='{"payload": "...", "module": "githubops"}' style="width:100%;"></textarea>
          </div>
          <button class="btn btn-primary" onclick="Governance.runSimulation()">Run Simulation</button>
        </div>
        <div id="gov-sim-result" class="hidden" style="background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:16px;"></div>
      </div>
    `;
  }

  async function runSimulation() {
    const actionInput = document.getElementById('gov-sim-action');
    const contextInput = document.getElementById('gov-sim-context');
    const resultDiv = document.getElementById('gov-sim-result');

    if (!actionInput || !resultDiv) return;
    const action = actionInput.value.trim();
    if (!action) {
      Utils.showToast('Please enter an action to simulate', 'warning');
      return;
    }

    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `<div class="loading">Running simulation...</div>`;

    let context = {};
    try {
      if (contextInput && contextInput.value.trim()) {
        context = JSON.parse(contextInput.value.trim());
      }
    } catch (e) {
      Utils.showToast('Invalid JSON context', 'error');
      return;
    }

    const simulation = await postSimulate(action, null, context);
    if (!simulation) {
      resultDiv.innerHTML = `<div class="empty-state"><span class="empty-state-emoji">❌</span><h3>Simulation failed</h3></div>`;
      return;
    }

    const outcomeIcon = simulation.allowed ? '✅' : '❌';
    const riskIcon = simulation.risk ? (simulation.risk.riskLevel === 'danger' ? '🔴' : simulation.risk.riskLevel === 'high' ? '🟠' : '🟢') : '⚪';

    resultDiv.innerHTML = `
      <h4 style="margin:0 0 12px;">Simulation Result</h4>
      <div style="display:grid; gap:8px; font-size:14px;">
        <div><strong>Action:</strong> ${simulation.action}</div>
        <div><strong>Outcome:</strong> ${outcomeIcon} ${simulation.simulatedOutcome}</div>
        <div><strong>Allowed:</strong> ${simulation.allowed ? '✅ Yes' : '❌ No'}</div>
        <div><strong>Risk:</strong> ${riskIcon} ${simulation.risk.riskLevel} (${Math.round(simulation.risk.riskScore * 100)}%)</div>
        <div><strong>Permission:</strong> ${simulation.permission.allowed ? '✅ Granted' : '❌ Denied'} (${simulation.permission.role})</div>
        <div><strong>Approval Required:</strong> ${simulation.approval.requiresApproval ? '✅ Yes' : '❌ No'}</div>
        <div><strong>Evaluation Required:</strong> ${simulation.evaluation.evaluationRequired ? '✅ Yes' : '❌ No'}</div>
        <div><strong>Secrets Found:</strong> ${simulation.secretScan.hasSecret ? '⚠️ Yes' : '✅ No'}</div>
        ${simulation.reasons && simulation.reasons.length ? `<div><strong>Reasons:</strong> ${simulation.reasons.join('; ')}</div>` : ''}
      </div>
      <div style="margin-top:12px; padding:8px; background:var(--bg-secondary); border-radius:4px; font-size:12px; color:var(--text-secondary);">
        ${simulation.note}
      </div>
    `;
  }

  function renderSecretScan(area) {
    area.innerHTML = `
      <div style="max-width:800px;">
        <div style="background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:16px; margin-bottom:16px;">
          <h4 style="margin:0 0 12px;">🔍 Secret Guard Scanner</h4>
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">Test payload for secrets. No data is stored.</p>
          <div class="form-group">
            <label for="gov-secret-payload">Payload to scan</label>
            <textarea id="gov-secret-payload" class="form-input dark-input" rows="5" placeholder="Paste any text to scan for secrets, tokens, API keys..." style="width:100%; font-family:monospace;"></textarea>
          </div>
          <button class="btn btn-primary" onclick="Governance.runSecretScan()">Scan for Secrets</button>
        </div>
        <div id="gov-secret-result" class="hidden" style="background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:16px;"></div>
      </div>
    `;
  }

  async function runSecretScan() {
    const payloadInput = document.getElementById('gov-secret-payload');
    const resultDiv = document.getElementById('gov-secret-result');
    if (!payloadInput || !resultDiv) return;

    const payload = payloadInput.value;
    if (!payload) {
      Utils.showToast('Please enter a payload to scan', 'warning');
      return;
    }

    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `<div class="loading">Scanning...</div>`;

    const result = await postSecretScan(payload);
    if (!result) {
      resultDiv.innerHTML = `<div class="empty-state"><span class="empty-state-emoji">❌</span><h3>Scan failed</h3></div>`;
      return;
    }

    const safeIcon = result.safe ? '✅' : '⚠️';
    resultDiv.innerHTML = `
      <h4 style="margin:0 0 12px;">Scan Result</h4>
      <div><strong>Safe:</strong> ${safeIcon} ${result.safe ? 'No secrets detected' : 'Secrets found!'}</div>
      ${result.matches && result.matches.length ? `
        <div style="margin-top:8px;"><strong>Matches:</strong></div>
        <ul style="margin:4px 0;">
          ${result.matches.map(m => `<li style="color:var(--danger);">${m.label}</li>`).join('')}
        </ul>
      ` : ''}
      ${!result.safe && result.redacted ? `
        <div style="margin-top:12px;">
          <strong>Redacted version:</strong>
          <pre style="background:var(--bg-secondary); padding:8px; border-radius:4px; overflow-x:auto; font-size:12px; margin-top:4px;">${Utils.escapeHtml(result.redacted)}</pre>
        </div>
      ` : ''}
    `;
  }

  async function renderAudit(area) {
    area.innerHTML = `<div class="loading">Loading audit log...</div>`;
    const { events, summary } = await fetchAudit();
    area.innerHTML = `
      <div style="margin-bottom:16px;">
        <h4 style="margin:0 0 8px;">Governance Audit</h4>
        ${summary ? `
          <div style="display:flex; gap:16px; font-size:13px; color:var(--text-secondary);">
            <span>Total: ${summary.total || 0}</span>
            <span style="color:var(--success);">Allowed: ${summary.allowed || 0}</span>
            <span style="color:var(--danger);">Blocked: ${summary.blocked || 0}</span>
            <span>Proposals: ${summary.proposals || 0}</span>
          </div>
        ` : ''}
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table" style="width:100%; font-size:12px;">
          <thead>
            <tr>
              <th>ID</th>
              <th>Module</th>
              <th>Capability</th>
              <th>Decision</th>
              <th>Risk</th>
              <th>Reasons</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${events.length ? events.map(e => `
              <tr>
                <td style="font-family:monospace; font-size:11px;">${e.id || '-'}</td>
                <td>${e.module || '-'}</td>
                <td>${e.capabilityId || '-'}</td>
                <td><span class="badge ${e.decision === 'BLOCKED' ? 'badge-danger' : e.decision === 'PROPOSAL_REQUIRED' ? 'badge-warning' : 'badge-info'}">${e.decision || '-'}</span></td>
                <td><span class="badge ${e.riskLevel === 'danger' ? 'badge-danger' : ''}">${e.riskLevel || '-'}</span></td>
                <td style="font-size:11px;">${(e.reasons || []).join(', ') || '-'}</td>
                <td style="font-size:11px;">${e.createdAt ? new Date(e.createdAt).toLocaleTimeString() : '-'}</td>
              </tr>
            `).join('') : `
              <tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">No audit events yet</td></tr>
            `}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderBlocked(area) {
    area.innerHTML = `<div class="loading">Loading blocked actions...</div>`;
    const blocked = await fetchBlocked();
    area.innerHTML = `
      <h4 style="margin:0 0 12px;">⛔ Blocked Actions (${blocked.length})</h4>
      ${blocked.length ? `
        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%; font-size:12px;">
            <thead>
              <tr>
                <th>Action</th>
                <th>Risk Level</th>
                <th>Reasons</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              ${blocked.map(b => `
                <tr>
                  <td>${b.actionId || '-'}</td>
                  <td><span class="badge badge-danger">${b.riskLevel || '-'}</span></td>
                  <td style="font-size:11px;">${(b.reasons || []).join(', ')}</td>
                  <td style="font-size:11px;">${b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="empty-state">
          <span class="empty-state-emoji">✅</span>
          <h3>No blocked actions</h3>
        </div>
      `}
    `;
  }

  return {
    renderGovernanceTab,
    refreshGovernance,
    showSection,
    filterCapabilities,
    showCapabilityDetail,
    renderCapabilities,
    renderPolicies,
    renderSimulator,
    runSimulation,
    renderSecretScan,
    runSecretScan,
    renderAudit,
    renderBlocked
  };
})();

window.Governance = Governance;

if (window.UI) {
  UI.renderGovernance = Governance.renderGovernanceTab;
}
