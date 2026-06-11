'use strict';

function explainRoutingDecision(intent, selectedAgent, options) {
  if (!intent || !selectedAgent) return 'Tidak ada keputusan routing.';
  const lines = ['Routing Decision'];
  lines.push('Domain: ' + (intent.domain || 'unknown'));
  lines.push('Intent: ' + (intent.intent || 'unknown'));
  lines.push('Confidence: ' + (intent.confidence || 0) + '%');
  lines.push('Agent: ' + selectedAgent.primary);
  if (selectedAgent.agents && selectedAgent.agents.length > 1) {
    lines.push('Team: ' + selectedAgent.agents.join(', '));
  }
  if (intent.requiresApproval) lines.push('Requires Approval: yes');
  if (intent.ownerOnly) lines.push('Owner Only: yes');
  return lines.join('\n');
}

function formatRouterExplanationForDebug(intent, selectedAgent) {
  const lines = ['[Router Debug]'];
  lines.push('text: ' + (intent._rawText || '').slice(0, 50));
  lines.push('domain: ' + (intent.domain || '?'));
  lines.push('intent: ' + (intent.intent || '?'));
  lines.push('confidence: ' + (intent.confidence || 0));
  lines.push('risk: ' + (intent.riskLevel || 'none'));
  lines.push('agent: ' + (selectedAgent ? selectedAgent.primary : '?'));
  lines.push('approval: ' + (intent.requiresApproval ? 'yes' : 'no'));
  return lines.join('\n');
}

function formatShortUserFacingRoutingHint(intent, selectedAgent) {
  if (!intent || !selectedAgent) return null;
  const domain = intent.domain;
  const hints = {
    coding: 'Saya akan tangani ini sebagai tugas coding.',
    project: 'Saya akan lihat project Anda.',
    security: 'Saya akan periksa keamanan.',
    memory: 'Saya akan lihat memori.',
    workflow: 'Saya akan buat draft workflow.',
    device: 'Saya akan periksa perangkat.',
    approval: 'Saya akan periksa proposal.',
    ops: 'Memeriksa status operasional...',
    deploy: 'Deploy memerlukan proposal.',
    privacy: 'Memproses permintaan privasi.',
    normal_chat: null
  };
  return hints[domain] || null;
}

module.exports = {
  explainRoutingDecision,
  formatRouterExplanationForDebug,
  formatShortUserFacingRoutingHint
};
