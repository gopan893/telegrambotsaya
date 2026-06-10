/* Devices Dashboard Renderer */

(function() {
  const API = '/api/dashboard/devices';

  UI.renderDevices = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading Devices...');
    try {
      const res = await Api.fetch(API);
      let data = null;
      if (res.ok && res.data) data = res.data;

      let html = '';
      html += '<div class="section-header"><h2>Multi-Device Control & Local Nodes</h2></div>';
      html += buildDeviceRegistrySection(data);
      html += buildDeviceHealthSection(data);
      html += buildDevicePairingSection(data);
      html += buildLocalNodeSection(data);
      html += buildLocalAiSection(data);
      html += buildNasSection(data);
      html += buildTunnelSection(data);
      html += buildFileSyncSection(data);
      html += buildDeviceCapabilitiesSection(data);
      html += buildActionSimulatorSection(data);
      html += buildProposalLinksSection(data);

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-outline" onclick="UI.renderDevices(document.getElementById(\'tab-content\'))">Refresh</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('Devices Error', err.message);
    }
  };

  function buildDeviceRegistrySection(data) {
    if (!data || !data.stats) return UI.renderEmptyState('', 'Device Registry', 'No device data available.');
    const s = data.stats;
    let html = '<div class="section-header" style="margin-top:16px;"><h3>Device Registry</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-info);">' + (s.total || 0) + '</div>';
    html += '<div class="stat-label">Total Devices</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (s.byStatus && s.byStatus.paired || 0) + '</div>';
    html += '<div class="stat-label">Paired</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (s.byStatus && s.byStatus.pending || 0) + '</div>';
    html += '<div class="stat-label">Pending</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (s.byStatus && s.byStatus.unreachable || 0) + '</div>';
    html += '<div class="stat-label">Unreachable</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildDeviceHealthSection(data) {
    if (!data || !data.healthStats) return '';
    const h = data.healthStats;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Device Health</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (h.healthy || 0) + '</div>';
    html += '<div class="stat-label">Healthy</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (h.degraded || 0) + '</div>';
    html += '<div class="stat-label">Degraded</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (h.unhealthy || 0) + '</div>';
    html += '<div class="stat-label">Unhealthy</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">' + (h.healthyPercentage || 0) + '%</div>';
    html += '<div class="stat-label">Healthy %</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildDevicePairingSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Device Pairing</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">Pairing requests managed via Proposal flow</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Pair, approve, or reject device pairing requests.</p>';
    html += '</div></div>';
    return html;
  }

  function buildLocalNodeSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Local Node Status</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-info);">' + (data && data.nodeCount || 0) + '</div>';
    html += '<div class="stat-label">Registered Nodes</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildLocalAiSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Local AI Endpoint</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (data && data.aiStatus) {
      html += '<div class="stat-value" style="font-size:14px;">' + (data.aiStatus.available || 0) + ' available, ' + (data.aiStatus.unavailable || 0) + ' unavailable</div>';
    } else {
      html += '<div class="stat-value" style="font-size:14px;">No local AI nodes registered</div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildNasSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>NAS Node</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (data && data.nasStatus) {
      html += '<div class="stat-value" style="font-size:14px;">' + (data.nasStatus.total || 0) + ' NAS node(s)</div>';
    } else {
      html += '<div class="stat-value" style="font-size:14px;">No NAS nodes registered</div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildTunnelSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Tunnel Status</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (data && data.tunnelStatus) {
      html += '<div class="stat-value" style="font-size:14px;">' + (data.tunnelStatus.active || 0) + ' active, ' + (data.tunnelStatus.closed || 0) + ' closed</div>';
    } else {
      html += '<div class="stat-value" style="font-size:14px;">No tunnels configured</div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildFileSyncSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>File Sync</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (data && data.syncStatus) {
      html += '<div class="stat-value" style="font-size:14px;">' + (data.syncStatus.synced || 0) + ' synced, ' + (data.syncStatus.error || 0) + ' errors</div>';
    } else {
      html += '<div class="stat-value" style="font-size:14px;">No sync targets</div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildDeviceCapabilitiesSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Device Capabilities</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">Capability registry active</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">View and manage device capabilities.</p>';
    html += '</div></div>';
    return html;
  }

  function buildActionSimulatorSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Action Simulator</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">Simulate device actions safely</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">READ-ONLY — Simulation only. No real actions executed.</p>';
    html += '</div></div>';
    return html;
  }

  function buildProposalLinksSection(data) {
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Proposal Links</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="font-size:14px;">Device actions go through proposal flow</div>';
    html += '<p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Write/external actions require approval via Evaluation v2.</p>';
    html += '</div></div>';
    return html;
  }
})();
