'use strict';

const observability = require('../agents/observability');

const DEFAULT_POLICY = {
  riskLevel: 'low',
  capability: 'conversation',
  allowAutonomous: true,
  requiresApproval: false,
  requiresAdmin: false,
  maxRiskScore: 0.82,
  description: 'Percakapan biasa atau aksi berisiko rendah.'
};

const POLICIES = {
  NONE: DEFAULT_POLICY,
  HITUNG: {
    riskLevel: 'low',
    capability: 'utility.math',
    allowAutonomous: true,
    requiresApproval: false,
    requiresAdmin: false,
    maxRiskScore: 0.82,
    description: 'Kalkulasi lokal tanpa efek samping eksternal.'
  },
  JAM: {
    riskLevel: 'low',
    capability: 'utility.time',
    allowAutonomous: true,
    requiresApproval: false,
    requiresAdmin: false,
    maxRiskScore: 0.82,
    description: 'Pembacaan waktu tanpa perubahan state.'
  },
  TANGGAL: {
    riskLevel: 'low',
    capability: 'utility.date',
    allowAutonomous: true,
    requiresApproval: false,
    requiresAdmin: false,
    maxRiskScore: 0.82,
    description: 'Pembacaan tanggal tanpa perubahan state.'
  },
  CUACA: {
    riskLevel: 'low',
    capability: 'external.weather.read',
    allowAutonomous: true,
    requiresApproval: false,
    requiresAdmin: false,
    maxRiskScore: 0.76,
    description: 'Query cuaca eksternal read-only.'
  },
  LOKASI: {
    riskLevel: 'low',
    capability: 'external.location.read',
    allowAutonomous: true,
    requiresApproval: false,
    requiresAdmin: false,
    maxRiskScore: 0.76,
    description: 'Query lokasi eksternal read-only.'
  },
  SEARCH: {
    riskLevel: 'medium',
    capability: 'external.search.read',
    allowAutonomous: true,
    requiresApproval: false,
    requiresAdmin: false,
    maxRiskScore: 0.68,
    description: 'Pencarian web dapat membawa data tidak tepercaya, tetapi read-only.'
  },
  GAMBAR: {
    riskLevel: 'medium',
    capability: 'ai.image.generate',
    allowAutonomous: true,
    requiresApproval: false,
    requiresAdmin: false,
    maxRiskScore: 0.68,
    description: 'Pembuatan gambar memakai provider eksternal dan perlu prompt aman.'
  },
  TAMBAH_TUGAS: {
    riskLevel: 'medium',
    capability: 'memory.todo.write',
    allowAutonomous: true,
    requiresApproval: false,
    requiresAdmin: false,
    maxRiskScore: 0.66,
    description: 'Mengubah todo user, efeknya terbatas ke memori user.'
  },
  TAMBAH_MOOD: {
    riskLevel: 'medium',
    capability: 'memory.mood.write',
    allowAutonomous: true,
    requiresApproval: false,
    requiresAdmin: false,
    maxRiskScore: 0.66,
    description: 'Mengubah preferensi/mood user, efeknya terbatas ke memori user.'
  },
  TAMBAH_PENGINGAT: {
    riskLevel: 'medium',
    capability: 'scheduler.reminder.write',
    allowAutonomous: true,
    requiresApproval: false,
    requiresAdmin: false,
    maxRiskScore: 0.62,
    description: 'Menjadwalkan reminder, perlu confidence waktu dan isi cukup jelas.'
  },
  TAMBAH_EVENT: {
    riskLevel: 'high',
    capability: 'calendar.event.write',
    allowAutonomous: false,
    requiresApproval: true,
    requiresAdmin: false,
    maxRiskScore: 0.48,
    description: 'Menulis ke Google Calendar, sehingga perlu konfirmasi eksplisit.'
  },
  RELOADPLUGINS: {
    riskLevel: 'high',
    capability: 'system.plugins.reload',
    allowAutonomous: false,
    requiresApproval: true,
    requiresAdmin: true,
    maxRiskScore: 0.35,
    description: 'Aksi sistem sensitif yang hanya boleh dijalankan admin.'
  },
  RESET_SYSTEM: {
    riskLevel: 'critical',
    capability: 'system.reset',
    allowAutonomous: false,
    requiresApproval: true,
    requiresAdmin: true,
    maxRiskScore: 0.25,
    description: 'Aksi destruktif/sensitif yang tidak boleh berjalan otomatis.'
  },
  BAN_MEMBER: {
    riskLevel: 'critical',
    capability: 'moderation.ban',
    allowAutonomous: false,
    requiresApproval: true,
    requiresAdmin: true,
    maxRiskScore: 0.28,
    description: 'Aksi moderasi destruktif yang perlu kewenangan admin.'
  }
};

function normalizeIntent(intent) {
  return String(intent || 'NONE').trim().toUpperCase() || 'NONE';
}

function getPolicy(intent) {
  const normalized = normalizeIntent(intent);
  return {
    intent: normalized,
    ...(POLICIES[normalized] || DEFAULT_POLICY)
  };
}

function validatePolicy(traceId, decisionInput = {}) {
  const policy = getPolicy(decisionInput.intent);
  const riskScore = Number(decisionInput.riskScore ?? 0.5);
  const nlpConfidence = Number(decisionInput.nlpConfidence ?? 0.5);
  const flags = decisionInput.flags || [];
  const violations = [];

  if (riskScore > policy.maxRiskScore) {
    violations.push('RISK_SCORE_EXCEEDS_POLICY');
  }
  if (policy.requiresApproval && !decisionInput.approved) {
    violations.push('APPROVAL_REQUIRED');
  }
  if (nlpConfidence < 0.7 && policy.riskLevel !== 'low') {
    violations.push('LOW_CONFIDENCE_FOR_NON_LOW_RISK_ACTION');
  }
  if (flags.includes('PROMPT_INJECTION') || flags.includes('CONTEXT_MANIPULATION')) {
    violations.push('UNTRUSTED_CONTEXT_OR_INPUT');
  }

  const allowedByPolicy = violations.length === 0 || (
    violations.length === 1 &&
    violations[0] === 'APPROVAL_REQUIRED' &&
    policy.requiresApproval
  );

  observability.logEvent(traceId, 'PolicyEngine', 'POLICY_VALIDATED', {
    intent: policy.intent,
    riskLevel: policy.riskLevel,
    allowedByPolicy,
    violationCount: violations.length
  });

  return {
    policy,
    allowedByPolicy,
    violations,
    requiresApproval: policy.requiresApproval && !decisionInput.approved
  };
}

function listPolicies() {
  return Object.keys(POLICIES).map((intent) => getPolicy(intent));
}

module.exports = {
  getPolicy,
  validatePolicy,
  listPolicies,
  normalizeIntent
};
