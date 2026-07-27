'use strict';

const DANGEROUS_PATTERNS = [
  { pattern: /deploy\s+(sekarang|sekarang\s+juga|langsung)/i, risk: 'danger', action: 'direct_deploy', explanation: 'Deploy langsung tidak diizinkan. Buat proposal terlebih dahulu.' },
  { pattern: /rollback\s+(sekarang|langsung)/i, risk: 'danger', action: 'direct_rollback', explanation: 'Rollback langsung tidak diizinkan. Buat proposal terlebih dahulu.' },
  { pattern: /push\s+(sekarang|langsung)\s+(ke\s+)?github/i, risk: 'high', action: 'direct_push', explanation: 'Push langsung ke GitHub tidak diizinkan. Buat proposal terlebih dahulu.' },
  { pattern: /restart\s+(sekarang|langsung)\s+(mac|pc|komputer|server|bot)/i, risk: 'danger', action: 'direct_restart', explanation: 'Restart langsung tidak diizinkan. Buat proposal terlebih dahulu.' },
  { pattern: /(hapus|delete)\s+(semua|all)\s+(data|file|memory|memori)/i, risk: 'danger', action: 'mass_delete', explanation: 'Penghapusan massal tidak diizinkan tanpa proposal dan approval.' },
  { pattern: /(restore|pulihkan)\s+(backup|sekarang)/i, risk: 'danger', action: 'direct_restore', explanation: 'Restore backup langsung tidak diizinkan.' },
  { pattern: /(approve|setujui|acc)\s+(semua|all)/i, risk: 'danger', action: 'auto_approve', explanation: 'Auto-approve tidak diizinkan. Setiap proposal harus dievaluasi.' },
  { pattern: /(otomatiskan|auto)\s+(semua|approve|deploy|push)/i, risk: 'danger', action: 'auto_action', explanation: 'Tidak ada tindakan otomatis yang diizinkan tanpa approval.' },
  { pattern: /(tampilkan|show|lihat)\s+(TOKEN|GITHUB_TOKEN|DATABASE_URL|SECRET)/i, risk: 'danger', action: 'expose_secret', explanation: 'Token/secret tidak dapat ditampilkan.' },
  { pattern: /(shell|bash|exec|run)\s+(command|perintah|script)/i, risk: 'danger', action: 'shell_exec', explanation: 'Eksekusi shell langsung tidak diizinkan.' },
  { pattern: /(selesaikan|complete)\s+(semua|all)\s+(otomatis|automatic)/i, risk: 'danger', action: 'auto_complete', explanation: 'Penyelesaian otomatis tidak diizinkan.' },
  { pattern: /restart\s+(mac|komputer)\s+(sekarang)/i, risk: 'danger', action: 'direct_restart_device', explanation: 'Restart perangkat langsung tidak diizinkan. Buat proposal.' }
];

const EXTERNAL_WRITE_PATTERNS = [
  /(kirim|send)\s+(email|surel)/i,
  /(buat|create)\s+(event|calendar|acara)/i,
  /(tulis|write)\s+(ke|to)\s+(file|database)/i,
  /(webhook|hook)/i
];

const CREDENTIAL_PATTERNS = [
  /(token|api[_-]?key|secret|password|credential)/i
];

function detectTelegramActionRisk(text, intent, services) {
  if (!text) return { isDangerous: false, risks: [], explanation: '' };
  const msg = String(text);
  const risks = [];
  for (const dp of DANGEROUS_PATTERNS) {
    if (dp.pattern.test(msg)) {
      risks.push({ pattern: dp.pattern, risk: dp.risk, action: dp.action, explanation: dp.explanation });
    }
  }
  if (intent && intent.requiresApproval) {
    risks.push({ risk: intent.riskLevel || 'medium', action: 'requires_approval', explanation: 'Tindakan ini memerlukan proposal dan approval.' });
  }
  return {
    isDangerous: risks.length > 0,
    risks,
    explanation: risks.length > 0 ? risks[0].explanation : ''
  };
}

function detectDangerousActionRequest(text) {
  if (!text) return { isDangerous: false, matched: null };
  for (const dp of DANGEROUS_PATTERNS) {
    if (dp.pattern.test(String(text))) {
      return { isDangerous: true, matched: dp };
    }
  }
  return { isDangerous: false, matched: null };
}

function detectExternalWriteRequest(text) {
  if (!text) return false;
  return EXTERNAL_WRITE_PATTERNS.some(p => p.test(String(text)));
}

function detectCredentialRequest(text) {
  if (!text) return false;
  return CREDENTIAL_PATTERNS.some(p => p.test(String(text)));
}

function detectShellCommandRequest(text) {
  if (!text) return { detected: false };
  const msg = String(text);
  if (/shell/i.test(msg) || /bash/i.test(msg) || /exec/i.test(msg) || /run\s+command/i.test(msg)) {
    return { detected: true };
  }
  return { detected: false };
}

function buildTelegramRiskReport(text, intent, services) {
  const msg = String(text || '');
  const dangerousAction = detectDangerousActionRequest(msg);
  const externalWrite = detectExternalWriteRequest(msg);
  const credentialRequest = detectCredentialRequest(msg);
  const shellRequest = detectShellCommandRequest(msg);
  const lines = ['📋 Risk Assessment'];
  if (dangerousAction.isDangerous) lines.push('Dangerous Action:', dangerousAction.matched.action);
  if (externalWrite) lines.push('External Write: detected');
  if (credentialRequest) lines.push('Credential Request: detected');
  if (shellRequest.detected) lines.push('Shell Command: detected');
  if (intent && intent.requiresApproval) lines.push('Approval Required: yes');
  if (lines.length === 1) lines.push('No risks detected.');
  return lines.join('\n');
}

module.exports = {
  buildTelegramRiskReport,
  DANGEROUS_PATTERNS,
  detectCredentialRequest,
  detectDangerousActionRequest,
  detectExternalWriteRequest,
  detectShellCommandRequest,
  detectTelegramActionRisk
};
