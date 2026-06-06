'use strict';

const utils = require('./delegation-utils');

function normalizeText(text = '') {
  return String(text || '').trim();
}

function extractId(text = '', prefixes = []) {
  const escaped = prefixes.map(prefix => prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!escaped) return '';
  const match = String(text || '').match(new RegExp(`\\b(?:${escaped})_[a-zA-Z0-9_.:@-]+`, 'i'));
  return match ? match[0] : '';
}

function detectActionIntent(text = '', context = {}, services = {}) {
  const clean = normalizeText(text);
  const lower = clean.toLowerCase();
  if (!clean || clean.startsWith('/')) {
    return {
      hasActionIntent: false,
      actionType: '',
      targetType: '',
      targetId: '',
      riskLevel: 'low',
      requiresApproval: false,
      source: context.source || 'natural_chat',
      reason: 'empty_or_command'
    };
  }
  if (/^(halo|hai|hi|hello|ok|oke|sip|makasih|terima kasih)$/i.test(lower)) {
    return {
      hasActionIntent: false,
      actionType: '',
      targetType: '',
      targetId: '',
      riskLevel: 'low',
      requiresApproval: false,
      source: context.source || 'natural_chat',
      reason: 'simple_chat'
    };
  }

  const source = context.source || 'natural_chat';
  const targetIds = {
    task: extractId(clean, ['task', 'planner_task']),
    decision: extractId(clean, ['decision']),
    delegation: extractId(clean, ['delegation']),
    goal: extractId(clean, ['goal']),
    workflow: extractId(clean, ['workflow']),
    backup: extractId(clean, ['backup'])
  };

  let actionType = '';
  let targetType = 'manual';
  let targetId = '';
  let reason = '';

  if (/\brollback\b/.test(lower)) {
    actionType = 'restore.run';
    targetType = 'deploy';
    reason = 'rollback request';
  } else if (/\brestore\b|\bpulihkan\b/.test(lower)) {
    actionType = 'restore.run';
    targetType = 'backup';
    targetId = targetIds.backup;
    reason = 'restore request';
  } else if (/\bimport\b|\bimpor\b/.test(lower)) {
    actionType = 'import.run';
    targetType = 'import';
    reason = 'import request';
  } else if (/\b(jalankan|buat|create|ambil|backup)\b/.test(lower) && /\bbackup\b/.test(lower)) {
    actionType = 'backup.create';
    targetType = 'backup';
    reason = 'backup request';
  } else if (/\b(validate|validasi|cek)\b/.test(lower) && /\bbackup\b/.test(lower)) {
    actionType = 'backup.validate';
    targetType = 'backup';
    targetId = targetIds.backup;
    reason = 'backup validation request';
  } else if (/\b(recovery|disaster|pemulihan)\b/.test(lower) || /\bcek\s+sistem\s+recovery\b/.test(lower)) {
    actionType = 'recovery.check';
    targetType = 'ops';
    reason = 'recovery check request';
  } else if (/\b(integrity|integritas|cek\s+data|cek\s+referensi)\b/.test(lower)) {
    actionType = 'integrity.check';
    targetType = 'ops';
    reason = 'integrity check request';
  } else if (/\b(tandai|mark|set)\b/.test(lower) && /\b(task|tugas)\b/.test(lower) && /\b(selesai|done|complete)\b/.test(lower)) {
    actionType = 'planner.task.mark_done';
    targetType = 'planner_task';
    targetId = targetIds.task;
    reason = 'mark task done request';
  } else if (/\b(block|blocked|hambat|terblokir)\b/.test(lower) && /\b(task|tugas)\b/.test(lower)) {
    actionType = 'planner.task.mark_blocked';
    targetType = 'planner_task';
    targetId = targetIds.task;
    reason = 'mark task blocked request';
  } else if (/\b(update|ubah|naikkan|set)\b/.test(lower) && /\b(progress|goal|tujuan)\b/.test(lower)) {
    actionType = 'goal.progress.update';
    targetType = 'goal';
    targetId = targetIds.goal;
    reason = 'goal progress update request';
  } else if (/\b(tambah|add)\b/.test(lower) && /\b(workflow|step|langkah)\b/.test(lower)) {
    actionType = 'workflow.step.add';
    targetType = 'workflow';
    targetId = targetIds.workflow;
    reason = 'workflow step add request';
  } else if (/\b(done|selesai|complete)\b/.test(lower) && /\b(workflow|step|langkah)\b/.test(lower)) {
    actionType = 'workflow.step.done';
    targetType = 'workflow';
    targetId = targetIds.workflow;
    reason = 'workflow step done request';
  } else if (/\b(diagnostics|diagnostic|diag|cek health|cek sehat|bot sehat)\b/.test(lower)) {
    actionType = 'ops.diagnostics.run';
    targetType = 'ops';
    reason = 'diagnostics request';
  } else if (/\b(benchmark|perf|performance)\b/.test(lower)) {
    actionType = 'ops.benchmark.light';
    targetType = 'ops';
    reason = 'benchmark request';
  } else if (/\b(export|laporan|report)\b/.test(lower) && /\b(health|sehat|status)\b/.test(lower)) {
    actionType = 'report.health.export';
    targetType = 'report';
    reason = 'health report request';
  } else if (/\b(archive|arsip)\b/.test(lower) && /\b(memory|memori)\b/.test(lower)) {
    actionType = 'memory.suggest_archive';
    targetType = 'memory';
    reason = 'memory archive suggestion request';
  } else if (/\b(kerjakan|terapkan|jalankan)\b/.test(lower) && /\b(keputusan|decision)\b/.test(lower)) {
    actionType = 'decision.apply';
    targetType = 'decision';
    targetId = targetIds.decision;
    reason = 'decision execution request';
  } else if (/\b(kerjakan|terapkan|jalankan)\b/.test(lower) && /\b(delegation|delegasi|hasil agent)\b/.test(lower)) {
    actionType = 'delegation.apply';
    targetType = 'delegation';
    targetId = targetIds.delegation;
    reason = 'delegation execution request';
  } else if (/\b(buat|siapkan|create)\b/.test(lower) && /\b(proposal eksekusi|execution proposal|proposal action|action plan)\b/.test(lower)) {
    actionType = 'proposal.create';
    targetType = 'manual';
    reason = 'explicit proposal request';
  } else if (/\b(github|repo|repository)\b/.test(lower) && /\b(buat issue|create issue)\b/.test(lower)) {
    actionType = 'integration.connector.run';
    targetType = 'integration';
    targetId = 'github.issue.create';
    reason = 'github issue proposal request';
  } else if (/\b(jadwalkan|buat event|calendar|kalender|google calendar)\b/.test(lower)) {
    actionType = 'integration.connector.run';
    targetType = 'integration';
    targetId = 'calendar.event.create';
    reason = 'calendar event proposal request';
  } else if (/\b(gmail|email|draft email|buat draft)\b/.test(lower)) {
    actionType = 'integration.connector.run';
    targetType = 'integration';
    targetId = 'gmail.draft.create';
    reason = 'gmail draft proposal request';
  } else if (/\b(webhook)\b/.test(lower) && /\b(kirim|send|post)\b/.test(lower)) {
    actionType = 'integration.connector.run';
    targetType = 'integration';
    targetId = 'webhook.send';
    reason = 'webhook send proposal request';
  } else if (/\b(cloudflare|tunnel|nas)\b/.test(lower) && /\b(ubah|update|config|konfigurasi)\b/.test(lower)) {
    actionType = 'integration.connector.run';
    targetType = 'integration';
    targetId = 'cloudflare_nas.config.change';
    reason = 'cloudflare nas config proposal request';
  }

  const hasActionIntent = Boolean(actionType);
  const riskLevel = hasActionIntent ? inferActionRisk(actionType, clean) : 'low';
  return {
    hasActionIntent,
    actionType,
    targetType,
    targetId,
    riskLevel,
    requiresApproval: hasActionIntent && (riskLevel !== 'low' || requiresApproval(actionType)),
    source,
    reason: reason || 'no_action_intent'
  };
}

function inferActionRisk(actionType = '', text = '') {
  const raw = `${actionType} ${text}`.toLowerCase();
  if (/\b(shell|code execution|javascript|env|config|permission|admin|token|secret|delete|hard delete|drop)\b/.test(raw)) return 'danger';
  if (/\b(restore|import|overwrite|bulk|external api write)\b/.test(raw)) return 'danger';
  if (/\b(decision\.apply|delegation\.apply|proposal\.create)\b/.test(raw)) return 'medium';
  if (/\bintegration\.connector\.run\b/.test(raw) && /\b(restore|import|send|webhook|config|cloudflare|permission|admin)\b/.test(raw)) return 'high';
  if (/\bintegration\.connector\.run\b/.test(raw)) return 'medium';
  if (/\b(backup\.create|planner\.task|workflow\.step|goal\.progress|benchmark|write|archive)\b/.test(raw)) return 'medium';
  if (/\b(diagnostics|integrity|recovery|report|preview)\b/.test(raw)) return 'low';
  return utils.inferRiskFromText(text);
}

function requiresApproval(actionType = '') {
  return !['tool.preview'].includes(String(actionType || ''));
}

function shouldUseAgentExecutor(text = '', context = {}, services = {}) {
  const detected = detectActionIntent(text, context, services);
  return {
    needed: detected.hasActionIntent,
    detection: detected,
    reason: detected.reason
  };
}

module.exports = {
  detectActionIntent,
  extractId,
  inferActionRisk,
  shouldUseAgentExecutor
};
