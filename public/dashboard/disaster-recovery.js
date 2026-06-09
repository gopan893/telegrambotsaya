'use strict';

(function registerDisasterRecoveryDashboard() {
  function esc(v) { return window.Utils?.escapeHtml ? Utils.escapeHtml(String(v ?? '')) : String(v ?? ''); }
  function actorId() { return localStorage.getItem('dashboard_actor_id') || localStorage.getItem('last_user_id') || 'dashboard-admin'; }
  function payload(extra = {}) { return { actorId: actorId(), userId: actorId(), workspaceId: localStorage.getItem('dashboard_workspace_id') || 'default', ...extra }; }
  function badge(v) { const c = String(v ?? 'unknown').toLowerCase(); const cls = c === 'blocked' || c === 'high' ? 'danger' : c === 'warning' || c === 'medium' ? 'warning' : 'success'; return `<span class="badge badge-${cls}">${esc(v || 'unknown')}</span>`; }

  async function loadDR() {
    const [drills, integrity, encryption, readiness, report] = await Promise.all([
      Api.apiGet('/disaster-recovery/drills', payload()),
      Api.apiGet('/disaster-recovery/backup-integrity', payload()),
      Api.apiGet('/disaster-recovery/encryption-policy', payload()),
      Api.apiGet('/disaster-recovery/readiness', payload()),
      Api.apiGet('/disaster-recovery/report', payload())
    ]);
    return { drills: drills.data, integrity: integrity.data, encryption: encryption.data, readiness: readiness.data, report: report.data };
  }

  async function renderDisasterRecovery(targetEl) {
    targetEl.innerHTML = '<div class="tab-header"><h2>Disaster Recovery</h2><p>DR drills, restore rehearsal, backup encryption, recovery plans, and readiness gate.</p></div><div id="dr-content">' + window.UI.renderLoading('Loading disaster recovery...') + '</div>';
    const res = await loadDR();
    const c = document.getElementById('dr-content');
    if (!c) return;
    c.innerHTML = `
      <div class="dashboard-card"><div class="card-header"><h3>Readiness Gate: ${badge(res.readiness?.gate?.result || 'unknown')}</h3></div>
        ${(res.readiness?.gate?.checks || []).map(ch => `<div class="gap-item">${badge(ch.status)} ${esc(ch.name)}: ${esc(ch.detail || '')}</div>`).join('') || '<p class="muted">No checks.</p>'}
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Drills <span class="badge badge-info">${(res.drills?.drills || []).length}</span></h3></div>
        ${(res.drills?.drills || []).map(d => `<div class="gap-item"><strong>${esc(d.name)}</strong> [${badge(d.scope)}] Status: ${badge(d.status)} Risk: ${badge(d.riskLevel)}</div>`).join('') || '<p class="muted">No drills. Create one below.</p>'}
        <div class="form-group" style="margin-top:12px;"><label>Drill Name</label><input id="dr-drill-name" class="dashboard-input" placeholder="My DR Drill"></div>
        <div class="form-group"><label>Scope</label><select id="dr-drill-scope" class="dashboard-select"><option value="dashboard_recovery">Dashboard Recovery</option><option value="postgres_recovery">Postgres Recovery</option><option value="redis_recovery">Redis Recovery</option><option value="render_redeploy_recovery">Render Recovery</option><option value="telegram_webhook_recovery">Telegram Recovery</option><option value="github_actions_recovery">GitHub Actions Recovery</option><option value="secret_rotation_rehearsal">Secret Rotation</option><option value="full_ai_os_recovery">Full Recovery</option></select></div>
        <button class="btn btn-outline" id="btn-dr-create-drill">Create Drill</button>
        <button class="btn btn-outline" id="btn-dr-list-drills">Refresh Drills</button>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Backup Integrity</h3></div>
        <pre class="pre-wrap">${esc(JSON.stringify(res.integrity?.integrity || {}, null, 2).slice(0, 1000))}</pre>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Encryption Policy</h3></div>
        <p>Encryption Required: ${badge(res.encryption?.policy?.encryptionRequired)} | Algorithm: ${esc(res.encryption?.policy?.algorithm || 'none')} | Rotation: ${esc(res.encryption?.policy?.rotationRecommendedDays || 0)} days</p>
        <p><strong>Report:</strong> ${esc(res.encryption?.report?.summary || 'N/A')}</p>
      </div>
      <div class="dashboard-card"><div class="card-header"><h3>Actions</h3></div>
        <button class="btn btn-outline" id="btn-dr-recovery-plan">Generate Recovery Plan</button>
        <button class="btn btn-outline" id="btn-dr-restore-rehearsal">Run Restore Rehearsal</button>
        <button class="btn btn-outline" id="btn-dr-encryption-plan">Create Encryption Plan</button>
        <button class="btn btn-outline" id="btn-dr-rotation">Secret Rotation Rehearsal</button>
        <button class="btn btn-outline" id="btn-dr-readiness">Check Readiness</button>
        <div id="dr-result" style="margin-top:12px;"></div>
      </div>`;
    document.getElementById('btn-dr-create-drill')?.addEventListener('click', async () => {
      const name = document.getElementById('dr-drill-name')?.value || 'Untitled Drill';
      const scope = document.getElementById('dr-drill-scope')?.value || 'dashboard_recovery';
      const r = document.getElementById('dr-result');
      if (r) r.innerHTML = window.UI.renderLoading('Creating drill...');
      const res = await Api.apiPost('/disaster-recovery/drills', payload({ name, scope }));
      if (r) r.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-dr-list-drills')?.addEventListener('click', () => renderDisasterRecovery(targetEl));
    document.getElementById('btn-dr-recovery-plan')?.addEventListener('click', async () => {
      const r = document.getElementById('dr-result');
      if (r) r.innerHTML = window.UI.renderLoading('Generating plan...');
      const res = await Api.apiPost('/disaster-recovery/recovery-plan', payload({ scope: 'full' }));
      if (r) r.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-dr-restore-rehearsal')?.addEventListener('click', async () => {
      const r = document.getElementById('dr-result');
      if (r) r.innerHTML = window.UI.renderLoading('Running rehearsal...');
      const res = await Api.apiPost('/disaster-recovery/restore-rehearsal', payload({ scope: 'dashboard' }));
      if (r) r.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-dr-encryption-plan')?.addEventListener('click', async () => {
      const r = document.getElementById('dr-result');
      if (r) r.innerHTML = window.UI.renderLoading('Creating plan...');
      const res = await Api.apiPost('/disaster-recovery/encryption-plan', payload({ scope: 'full' }));
      if (r) r.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-dr-rotation')?.addEventListener('click', async () => {
      const r = document.getElementById('dr-result');
      if (r) r.innerHTML = window.UI.renderLoading('Running rehearsal...');
      const res = await Api.apiPost('/disaster-recovery/secret-rotation-rehearsal', payload({ secretType: 'telegram' }));
      if (r) r.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
    document.getElementById('btn-dr-readiness')?.addEventListener('click', async () => {
      const r = document.getElementById('dr-result');
      if (r) r.innerHTML = window.UI.renderLoading('Checking readiness...');
      const res = await Api.apiGet('/disaster-recovery/readiness', payload());
      if (r) r.innerHTML = '<pre class="pre-wrap">' + esc(JSON.stringify(res.data, null, 2)) + '</pre>';
    });
  }
  window.DISASTER_RECOVERY_DASHBOARD = { renderDisasterRecovery };
  if (window.UI) window.UI.renderDisasterRecovery = renderDisasterRecovery;
})();
