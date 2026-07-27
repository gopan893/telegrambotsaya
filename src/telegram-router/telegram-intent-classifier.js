'use strict';

const DOMAINS = {
  normal_chat: 'normal_chat',
  coding: 'coding',
  project: 'project',
  ops: 'ops',
  deploy: 'deploy',
  security: 'security',
  privacy: 'privacy',
  memory: 'memory',
  rag: 'rag',
  workflow: 'workflow',
  device: 'device',
  approval: 'approval',
  research: 'research',
  cost: 'cost',
  model_strategy: 'model_strategy',
  troubleshooting: 'troubleshooting',
  dashboard: 'dashboard',
  unknown: 'unknown'
};

const NORMAL_CHAT_PATTERNS = [
  /^(halo|hi|hello|hai|pagi|siang|sore|malam|good\s+(morning|afternoon|evening))/i,
  /^(terima\s+kasih|thanks|thank\s+you|makasih|sama-sama)/i,
  /^(baik|ok|oke|okay|yes|ya|setuju|tidak|no|nggak|batal|skip)/i,
  /^(saya|capek|lelah|senang|sedih|bingung|pusing)/i,
  /^(ceritakan|curhat|sharing)/i,
  /^(bagaimana\s+kabar|apa\s+kabar)/i,
  /^[?!]+$/,
  /^[A-Za-z]{1,3}$/,
  /^(test|tes|coba|testing)/i
];

const CODING_PATTERNS = [
  /buat\s+(codex|opencode|hermes)\s+prompt/i,
  /buat\s+(kode|code|fungsi|function|method|class)/i,
  /(fix|perbaiki|betulkan)\s+(bug|error|masalah|issue)/i,
  /buat\s+test/i,
  /implementasi/i,
  /refactor/i,
  /(cek|check|lihat)\s+(error|bug|masalah)\s+(di|pada)\s+\S+\.\w+/i,
  /(debug|debugging)/i,
  /(pull\s+request|\bPR\b|\bmerge\b)/i,
  /coding/i,
  /kode\s+(program|aplikasi|bot)/i,
  /(program|aplikasi)\s+(error|gagal|tidak\s+berfungsi)/i,
  /prompt\s+(codex|opencode)/i
];

const PROJECT_PATTERNS = [
  /(roadmap|peta\s+jalan)/i,
  /blocker/i,
  /(project|proyek)\s+(saya|status|ringkasan)/i,
  /(fase|phase)\s+(saat\s+ini|berikutnya)/i,
  /(prioritas|priority)/i,
  /(rencana|plan)\s+(project|proyek)/i,
  /(langkah|step|tahap)\s+(berikutnya|selanjutnya)/i,
  /test\s+plan/i
];

const OPS_PATTERNS = [
  /rollback/i,
  /deploy/i,
  /push\s+(ke|to)\s+github/i,
  /(production|produksi)\s+(health|kesehatan|status)/i,
  /(server|service)\s+(mati|down|error|restart)/i,
  /(incident|insiden|kejadian)/i
];

const DEPLOY_PATTERNS = [
  /deploy\s+(sekarang|sekarang\s+juga|langsung)/i,
  /rollback\s+(sekarang|deploy|release|terakhir)/i,
  /push\s+(sekarang|langsung)/i,
  /restart\s+(server|bot|service)/i
];

const SECURITY_PATTERNS = [
  /(token|key|secret)\s+(bocor|expose|terekspos|terlihat)/i,
  /security/i,
  /hack/i,
  /vulnerabili/i,
  /audit\s+(security|keamanan)/i,
  /(cek|check|scan)\s+(token|kebocoran)/i,
  /(firewall|encrypt|decrypt)/i,
  /(sql\s+injection|xss|csrf)/i
];

const PRIVACY_PATTERNS = [
  /(hapus|delete|remove)\s+(memory|memori|data)\s+(pribadi|private)/i,
  /export\s+(data|memory|memori)/i,
  /privacy/i,
  /privasi/i,
  /(data\s+pribadi|personal\s+data)/i,
  /(hapus|delete)\s+(semua|all)\s+(data|memori)/i
];

const MEMORY_PATTERNS = [
  /(memory|memori)\s+(status|cek|check|lihat|search)/i,
  /(ingat|remember|recall)/i,
  /(lupa|forget)/i,
  /(RAG|rag)/i,
  /knowledge\s+(graph|base|search)/i,
  /(cari|search)\s+(memory|memori|pengetahuan)/i
];

const WORKFLOW_PATTERNS = [
  /(workflow|alur\s+kerja)/i,
  /buat\s+workflow/i,
  /(template|draft)\s+workflow/i,
  /buat\s+alur/i,
  /(otomatis|auto)\s+(workflow|alur)/i
];

const DEVICE_PATTERNS = [
  /(device|perangkat|node)\s+(status|cek|check|health)/i,
  /termux/i,
  /(local|localhost)\s+(ai|node)/i,
  /(nas|network\s+storage)/i,
  /(pair|pasangkan)\s+(device|perangkat)/i
];

const DEVICE_DANGEROUS_PATTERNS = [
  /(restart|reboot)\s+(mac|komputer|pc|device|perangkat)/i
];

const APPROVAL_PATTERNS = [
  /approve\s+(proposal|semua)/i,
  /(setujui|acc|izinkan)\s+(proposal|semua)/i,
  /reject\s+(proposal|semua)/i,
  /(tolak|batal)\s+(proposal|semua)/i,
  /auto\s+approve/i,
  /otomatis\s+(setuju|approve)/i
];

const RESEARCH_PATTERNS = [
  /(research|riset|penelitian)/i,
  /(cari|search)\s+(informasi|tentang|mengenai)/i,
  /(bandingkan|compare)/i,
  /(analisa|analyze|analisis)/i
];

const COST_PATTERNS = [
  /(biaya|cost|costly|mahal)/i,
  /(token|usage)\s+(usage|pemakaian|cek)/i,
  /(budget|anggaran)\s+(status|cek)/i,
  /(hemat|economy|irit)\s+(mode|token)/i
];

const TROUBLESHOOTING_PATTERNS = [
  /(kenapa|mengapa|why)\s+\w*\s*(error|gagal|tidak|fail)/i,
  /(troubleshoot|troubleshooting)/i,
  /(bantu|help|tolong)\s+(saya\s+)?(atas|solve|fix)/i,
  /(error|err)\s+(message|code|msg)/i
];

const DANGEROUS_PATTERNS = [
  /deploy\s+(sekarang|sekarang\s+juga|langsung)/i,
  /rollback/i,
  /push\s+(sekarang|langsung)/i,
  /restart\s+(sekarang|langsung)/i,
  /auto\s+approve/i,
  /approve\s+semua/i,
  /otomatiskan\s+semua/i,
  /selesaikan\s+semua\s+otomatis/i,
  /hapus\s+(semua|file|data)/i,
  /delete\s+(all|semua|file)/i,
  /restore\s+(backup|sekarang)/i,
  /(shell|bash|exec|run)\s+(command|perintah)/i,
  /tampilkan\s+(TOKEN|GITHUB_TOKEN|DATABASE_URL|REDIS_URL)/i
];

const EMOTIONAL_PATTERNS = [
  /(capek|lelah|lelah\s+sekali|letih)/i,
  /(stress|stres|tertekan)/i,
  /(senang|bahagia|gembira|syukur)/i,
  /(sedih|kecewa|kecewa\s+berat|sakit\s+hati)/i,
  /(bingung|pusing|puyeng)/i,
  /(galau|rindu|kangen)/i,
  /(semangat|motivasi|motivasi)/i,
  /(doa|harap|hope|wish)/i
];

const FOLLOWUP_PATTERNS = [
  /^(terus|lanjut|next|lalu|trus|oya|oh\s+ya|by\s+the\s+way|btw)$/i,
  /^(jelaskan|explain|detail|lebih\s+lanjut)/i,
  /^(kenapa|mengapa|why)\s+(begitu|demikian|seperti\s+itu)/i,
  /^(bagaimana|cara|how)\s+(dengan|caranya)/i,
  /^(jawab|answer|respon)\s+(tadi|sebelumnya)/i,
  /^(lagi|lebih|tambah|additional)/i
];

function classifyTelegramIntent(text) {
  if (!text) return { intent: DOMAINS.unknown, domain: DOMAINS.unknown, confidence: 0, riskLevel: 'none', requiresApproval: false, reasons: [] };
  const msg = String(text).trim();
  const reasons = [];
  if (msg.length < 3) return { intent: DOMAINS.normal_chat, domain: DOMAINS.normal_chat, confidence: 80, riskLevel: 'none', requiresApproval: false, reasons: ['short_message'] };
  if (APPROVAL_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.approval, domain: DOMAINS.approval, confidence: 90, riskLevel: 'high', requiresApproval: true, requiresEvaluation: true, ownerOnly: true, reasons: ['approval_action'] };
  }
  for (const p of DANGEROUS_PATTERNS) {
    if (p.test(msg)) {
      const domain = /rollback|deploy/i.test(msg) ? DOMAINS.deploy : DOMAINS.ops;
      return { intent: domain, domain, confidence: 95, riskLevel: 'danger', requiresApproval: true, requiresEvaluation: true, ownerOnly: true, reasons: ['dangerous_pattern_matched'] };
    }
  }
  if (EMOTIONAL_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.normal_chat, domain: DOMAINS.normal_chat, confidence: 85, riskLevel: 'none', requiresApproval: false, reasons: ['emotional_chat'] };
  }
  if (NORMAL_CHAT_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.normal_chat, domain: DOMAINS.normal_chat, confidence: 90, riskLevel: 'none', requiresApproval: false, reasons: ['greeting_or_simple'] };
  }
  if (PROJECT_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.project, domain: DOMAINS.project, confidence: 85, riskLevel: 'low', requiresApproval: false, suggestedAgent: 'planner', reasons: ['project_pattern_matched'] };
  }
  if (WORKFLOW_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.workflow, domain: DOMAINS.workflow, confidence: 85, riskLevel: 'low', requiresApproval: false, suggestedAgent: 'workflow', reasons: ['workflow_pattern_matched'] };
  }
  if (CODING_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.coding, domain: DOMAINS.coding, confidence: 85, riskLevel: 'low', requiresApproval: false, suggestedAgent: 'coder', reasons: ['coding_pattern_matched'] };
  }
  if (DEPLOY_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.deploy, domain: DOMAINS.deploy, confidence: 90, riskLevel: 'danger', requiresApproval: true, requiresEvaluation: true, ownerOnly: true, suggestedAgent: 'ops', reasons: ['deploy_pattern_matched'] };
  }
  if (SECURITY_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.security, domain: DOMAINS.security, confidence: 85, riskLevel: 'medium', requiresApproval: false, suggestedAgent: 'security', reasons: ['security_pattern_matched'] };
  }
  if (PRIVACY_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.privacy, domain: DOMAINS.privacy, confidence: 85, riskLevel: 'high', requiresApproval: true, ownerOnly: true, suggestedAgent: 'privacy', reasons: ['privacy_pattern_matched'] };
  }
  if (MEMORY_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.memory, domain: DOMAINS.memory, confidence: 85, riskLevel: 'low', requiresApproval: false, suggestedAgent: 'memory', reasons: ['memory_pattern_matched'] };
  }
  if (DEVICE_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.device, domain: DOMAINS.device, confidence: 85, riskLevel: 'low', requiresApproval: false, suggestedAgent: 'device', reasons: ['device_pattern_matched'] };
  }
  if (DEVICE_DANGEROUS_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.device, domain: DOMAINS.device, confidence: 90, riskLevel: 'danger', requiresApproval: true, suggestedAgent: 'device', reasons: ['device_dangerous_matched'] };
  }
  if (RESEARCH_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.research, domain: DOMAINS.research, confidence: 80, riskLevel: 'low', requiresApproval: false, suggestedAgent: 'research', reasons: ['research_pattern_matched'] };
  }
  if (COST_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.cost, domain: DOMAINS.cost, confidence: 85, riskLevel: 'low', requiresApproval: false, suggestedAgent: 'general', reasons: ['cost_pattern_matched'] };
  }
  if (TROUBLESHOOTING_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.troubleshooting, domain: DOMAINS.troubleshooting, confidence: 80, riskLevel: 'low', requiresApproval: false, suggestedAgent: 'general', reasons: ['troubleshooting_pattern_matched'] };
  }
  if (FOLLOWUP_PATTERNS.some(p => p.test(msg))) {
    return { intent: DOMAINS.normal_chat, domain: DOMAINS.normal_chat, confidence: 70, riskLevel: 'none', requiresApproval: false, reasons: ['followup_short'], isFollowup: true };
  }
  return { intent: DOMAINS.normal_chat, domain: DOMAINS.normal_chat, confidence: 40, riskLevel: 'none', requiresApproval: false, suggestedAgent: 'lifeos', reasons: ['fallback_to_normal'] };
}

function detectTelegramDomain(text) {
  const result = classifyTelegramIntent(text);
  return result.domain;
}

function estimateIntentConfidence(text) {
  const result = classifyTelegramIntent(text);
  return result.confidence;
}

function detectAmbiguousIntent(text) {
  if (!text) return { ambiguous: false, possibleDomains: [] };
  const msg = String(text).trim();
  const possibleDomains = [];
  for (const [domain, patterns] of [['coding', CODING_PATTERNS], ['project', PROJECT_PATTERNS], ['security', SECURITY_PATTERNS], ['memory', MEMORY_PATTERNS], ['ops', OPS_PATTERNS]]) {
    if (patterns.some(p => p.test(msg))) possibleDomains.push(domain);
  }
  return { ambiguous: possibleDomains.length > 1, possibleDomains };
}

function buildIntentClassificationReport(text) {
  const result = classifyTelegramIntent(text);
  return {
    text: String(text).slice(0, 100),
    intent: result.intent,
    domain: result.domain,
    confidence: result.confidence,
    riskLevel: result.riskLevel,
    requiresApproval: result.requiresApproval,
    suggestedAgent: result.suggestedAgent || null,
    reasons: result.reasons || []
  };
}

module.exports = {
  DOMAINS,
  buildIntentClassificationReport,
  classifyTelegramIntent,
  detectAmbiguousIntent,
  detectTelegramDomain,
  estimateIntentConfidence
};
