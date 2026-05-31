/* 
   =========================================
   Telegram AI OS Dashboard - Charts Module
   =========================================
*/

const Charts = {
  getContainer(containerOrId) {
    return typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
  },

  renderSparkline(containerId, values, color = '#3b82f6') {
    const container = this.getContainer(containerId);
    if (!container) return;

    if (!Array.isArray(values) || values.length === 0) {
      container.innerHTML = '<span class="text-muted">Tidak ada data tren</span>';
      return;
    }

    const width = 120;
    const height = 40;
    const padding = 2;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min === 0 ? 1 : max - min;

    const points = values.map((val, idx) => {
      const x = (idx / (values.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((val - min) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    }).join(' ');

    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
        <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
      </svg>
    `;
    container.innerHTML = svg;
  },

  renderProgressCircle(containerId, percentage, label = '', color = '#3b82f6') {
    const container = this.getContainer(containerId);
    if (!container) return;

    const val = Math.min(100, Math.max(0, percentage));
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (val / 100) * circumference;

    const svg = `
      <div style="position: relative; width: 90px; height: 90px; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto;">
        <svg width="90" height="90" viewBox="0 0 90 90" style="transform: rotate(-90deg);">
          <circle cx="45" cy="45" r="${radius}" stroke="rgba(255, 255, 255, 0.05)" stroke-width="6" fill="transparent" />
          <circle cx="45" cy="45" r="${radius}" stroke="${color}" stroke-width="6" fill="transparent" 
            stroke-dasharray="${circumference}" 
            stroke-dashoffset="${strokeDashoffset}" 
            stroke-linecap="round"
            style="transition: stroke-dashoffset 0.8s ease-in-out;"
          />
        </svg>
        <div style="position: absolute; font-family: var(--font-mono); font-size: 16px; font-weight: 700; color: var(--text-primary);">
          ${Math.round(val)}%
        </div>
      </div>
      <div style="text-align: center; font-size: 12px; color: var(--text-secondary); margin-top: 8px;">${label}</div>
    `;
    container.innerHTML = svg;
  },

  renderLineChart(containerId, points = [], options = {}) {
    const container = this.getContainer(containerId);
    if (!container) return;
    const values = Array.isArray(points) ? points.map(point => Number(point.value ?? point)).filter(Number.isFinite) : [];
    if (!values.length) {
      container.innerHTML = '<span class="text-muted">Tidak ada data tren</span>';
      return;
    }
    const width = Number(options.width || 420);
    const height = Number(options.height || 120);
    const padding = 12;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const polyline = values.map((value, index) => {
      const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');
    container.innerHTML = `
      <svg width="100%" viewBox="0 0 ${width} ${height}" class="chart-line">
        <polyline fill="none" stroke="${options.color || '#3b82f6'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${polyline}" />
      </svg>
    `;
  },

  renderBarChart(containerId, data, options = '#3b82f6') {
    const container = this.getContainer(containerId);
    if (!container) return;

    if (!data || (Array.isArray(data) ? data.length === 0 : Object.keys(data).length === 0)) {
      container.innerHTML = '<span class="text-muted">Tidak ada data grafik</span>';
      return;
    }

    const color = typeof options === 'string' ? options : (options.color || '#3b82f6');
    const items = Array.isArray(data)
      ? data.map(item => [item.label || item.key || '', Number(item.value || 0)])
      : Object.entries(data);
    const maxVal = Math.max(...items.map(([_, v]) => Number(v))) || 1;

    let html = '<div style="display:flex; flex-direction:column; gap:12px; width:100%;">';
    for (const [key, value] of items) {
      const safeValue = Number(value || 0);
      const pct = (safeValue / maxVal) * 100;
      html += `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
            <span class="text-secondary">${key}</span>
            <span style="font-family:var(--font-mono); font-weight:bold;">${safeValue}</span>
          </div>
          <div class="progress-container" style="height:6px; margin:0;">
            <div class="progress-bar" style="width: ${pct}%; background:${color};"></div>
          </div>
        </div>
      `;
    }
    html += '</div>';
    container.innerHTML = html;
  },

  renderScoreGauge(containerId, score, options = {}) {
    const pct = Number(score || 0) <= 1 ? Number(score || 0) * 100 : Number(score || 0);
    return this.renderProgressCircle(containerId, pct, options.label || 'Score', options.color || '#22c55e');
  },

  renderTimeline(containerId, events = [], options = {}) {
    const container = this.getContainer(containerId);
    if (!container) return;
    const items = Array.isArray(events) ? events.slice(0, options.limit || 20) : [];
    if (!items.length) {
      container.innerHTML = '<span class="text-muted">Tidak ada event timeline</span>';
      return;
    }
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${items.map(event => `
          <div style="border-left:2px solid ${options.color || '#3b82f6'}; padding-left:10px;">
            <div style="font-weight:600;">${event.title || event.type || 'Event'}</div>
            <div class="text-secondary" style="font-size:12px;">${event.timestamp || event.createdAt || ''}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
};
