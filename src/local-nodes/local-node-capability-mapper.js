'use strict';

const store = require('./local-node-store');

const NODE_TYPE_CAPABILITIES = {
  termux: ['read_state', 'send_notification', 'execute_action', 'run_shell'],
  mac: ['read_state', 'send_notification', 'execute_action', 'deploy'],
  nas: ['read_state', 'store_data', 'sync_files', 'backup'],
  'local-ai': ['read_state', 'inference', 'embedding', 'model_serve'],
  pwa: ['read_state', 'send_notification'],
  vps: ['read_state', 'send_notification', 'execute_action', 'deploy', 'run_shell']
};

function mapCapabilitiesForNode(nodeId) {
  const node = store.getNode(nodeId);
  if (!node) return { ok: false, error: 'Node not found' };
  const builtin = NODE_TYPE_CAPABILITIES[node.type] || [];
  const merged = [...new Set([...builtin, ...(node.capabilities || [])])];
  return { ok: true, nodeId, type: node.type, capabilities: merged };
}

function getNodeTypeCapabilities(type) {
  return NODE_TYPE_CAPABILITIES[type] || [];
}

function validateNodeCapabilities(nodeId) {
  const result = mapCapabilitiesForNode(nodeId);
  if (!result.ok) return result;
  const unsafe = result.capabilities.filter(c => ['run_shell', 'deploy', 'execute_action'].includes(c));
  return {
    ok: true,
    nodeId,
    totalCapabilities: result.capabilities.length,
    unsafeCapabilities: unsafe,
    isSafe: unsafe.length === 0
  };
}

function listAllNodeCapabilities() {
  const nodes = store.listNodes();
  return nodes.map(n => {
    const caps = mapCapabilitiesForNode(n.id);
    return { nodeId: n.id, type: n.type, capabilities: caps.ok ? caps.capabilities : [] };
  });
}

module.exports = {
  mapCapabilitiesForNode, getNodeTypeCapabilities, validateNodeCapabilities,
  listAllNodeCapabilities, NODE_TYPE_CAPABILITIES
};
