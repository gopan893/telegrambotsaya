/* Dashboard Knowledge Graph SVG renderer */

const GraphViz = (() => {
  function esc(value) {
    return window.Utils?.escapeHtml ? Utils.escapeHtml(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function normalizeGraphForView(graph = {}) {
    const nodes = (graph.topNodes || graph.nodes || []).map((node, index) => ({
      id: String(node.id || node.label || `node-${index}`),
      label: String(node.label || node.id || `Node ${index + 1}`),
      type: node.type || 'concept',
      importance: Number(node.importance ?? 0.5),
      confidence: Number(node.confidence ?? 0.5),
      occurrenceCount: Number(node.occurrenceCount || node.occurrence_count || 1),
      summary: node.summary || ''
    }));
    const byId = new Map(nodes.map(node => [node.id, node]));
    const byLabel = new Map(nodes.map(node => [node.label, node]));
    const edges = (graph.topEdges || graph.edges || []).map((edge, index) => {
      const fromRaw = String(edge.from || edge.fromNodeId || edge.from_node_id || '');
      const toRaw = String(edge.to || edge.toNodeId || edge.to_node_id || '');
      return {
        id: String(edge.id || `edge-${index}`),
        from: byId.get(fromRaw)?.id || byLabel.get(fromRaw)?.id || fromRaw,
        to: byId.get(toRaw)?.id || byLabel.get(toRaw)?.id || toRaw,
        relationship: edge.relationship || 'related_to',
        confidence: Number(edge.confidence ?? 0.5),
        weight: Number(edge.weight ?? 1),
        evidence: edge.evidence || ''
      };
    }).filter(edge => edge.from && edge.to);
    return { nodes, edges, stats: graph.stats || { nodes: nodes.length, edges: edges.length } };
  }

  function filterGraph(graph = {}, query = '') {
    const normalized = normalizeGraphForView(graph);
    const q = String(query || '').trim().toLowerCase();
    if (!q) return normalized;
    const nodes = normalized.nodes.filter(node =>
      node.label.toLowerCase().includes(q) ||
      node.type.toLowerCase().includes(q) ||
      node.summary.toLowerCase().includes(q)
    );
    const ids = new Set(nodes.map(node => node.id));
    const edges = normalized.edges.filter(edge =>
      ids.has(edge.from) ||
      ids.has(edge.to) ||
      edge.relationship.toLowerCase().includes(q) ||
      edge.evidence.toLowerCase().includes(q)
    );
    edges.forEach(edge => {
      const from = normalized.nodes.find(node => node.id === edge.from);
      const to = normalized.nodes.find(node => node.id === edge.to);
      if (from) ids.add(from.id);
      if (to) ids.add(to.id);
    });
    return {
      nodes: normalized.nodes.filter(node => ids.has(node.id)),
      edges,
      stats: normalized.stats
    };
  }

  function getNodeDetails(graph = {}, nodeId) {
    const normalized = normalizeGraphForView(graph);
    const node = normalized.nodes.find(item => item.id === nodeId || item.label === nodeId);
    if (!node) return null;
    const edges = normalized.edges.filter(edge => edge.from === node.id || edge.to === node.id);
    return { node, edges };
  }

  function colorForType(type = '') {
    const map = {
      technology: '#38bdf8',
      goal: '#a78bfa',
      workflow: '#34d399',
      risk: '#fb7185',
      insight: '#fbbf24',
      memory: '#60a5fa',
      concept: '#94a3b8'
    };
    return map[type] || '#94a3b8';
  }

  function layoutNodes(nodes, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.34;
    return nodes.map((node, index) => {
      if (index === 0) return { ...node, x: cx, y: cy, r: 17 };
      const angle = ((index - 1) / Math.max(1, nodes.length - 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        ...node,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        r: 9 + Math.min(8, node.importance * 8)
      };
    });
  }

  function renderGraphSvg(graph = {}, options = {}) {
    const normalized = normalizeGraphForView(graph);
    const nodes = normalized.nodes.slice(0, options.nodeLimit || 24);
    const edges = normalized.edges.slice(0, options.edgeLimit || 40);
    if (!nodes.length) return '<div class="empty-state"><p>Graph belum punya node.</p></div>';

    const width = Number(options.width || 860);
    const height = Number(options.height || 360);
    const laidOut = layoutNodes(nodes, width, height);
    const byId = new Map(laidOut.map(node => [node.id, node]));
    const edgeHtml = edges.map(edge => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return '';
      const opacity = Math.min(0.95, Math.max(0.18, edge.confidence));
      return `
        <g class="graph-edge" data-edge-id="${esc(edge.id)}">
          <line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="rgba(148,163,184,${opacity})" stroke-width="${Math.max(1, edge.weight)}" />
          <text x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 4}" fill="var(--text-muted)" font-size="9" text-anchor="middle">${esc(edge.relationship)}</text>
        </g>
      `;
    }).join('');

    const nodeHtml = laidOut.map(node => `
      <g class="graph-node" data-node-id="${esc(node.id)}" role="button" tabindex="0">
        <circle cx="${node.x}" cy="${node.y}" r="${node.r}" fill="${colorForType(node.type)}" opacity="0.92" stroke="rgba(255,255,255,.8)" stroke-width="1.5" />
        <text x="${node.x}" y="${node.y + node.r + 14}" fill="var(--text-primary)" font-size="10" text-anchor="middle">${esc(node.label).slice(0, 28)}</text>
      </g>
    `).join('');

    return `
      <div class="svg-graph-container">
        <svg viewBox="0 0 ${width} ${height}" class="svg-graph" style="width:100%; max-height:${height}px;">
          ${edgeHtml}
          ${nodeHtml}
        </svg>
      </div>
      ${renderGraphLegend()}
    `;
  }

  function highlightNode(container, nodeId) {
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) return null;
    root.querySelectorAll('.graph-node').forEach(node => node.classList.remove('is-active'));
    const selected = root.querySelector(`.graph-node[data-node-id="${CSS.escape(String(nodeId))}"]`);
    if (selected) selected.classList.add('is-active');
    return selected;
  }

  function renderGraphLegend() {
    const types = ['concept', 'technology', 'goal', 'workflow', 'insight', 'risk', 'memory'];
    return `
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        ${types.map(type => `<span style="display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--text-secondary);"><span style="width:9px; height:9px; border-radius:50%; background:${colorForType(type)};"></span>${esc(type)}</span>`).join('')}
      </div>
    `;
  }

  function renderGraphStats(graph = {}) {
    const normalized = normalizeGraphForView(graph);
    const typeCounts = normalized.nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {});
    return {
      nodes: normalized.stats.nodes ?? normalized.nodes.length,
      edges: normalized.stats.edges ?? normalized.edges.length,
      typeCounts,
      averageConfidence: normalized.edges.length
        ? normalized.edges.reduce((sum, edge) => sum + edge.confidence, 0) / normalized.edges.length
        : 0
    };
  }

  return {
    renderGraphSvg,
    normalizeGraphForView,
    filterGraph,
    getNodeDetails,
    highlightNode,
    renderGraphLegend,
    renderGraphStats
  };
})();

window.GraphViz = GraphViz;
