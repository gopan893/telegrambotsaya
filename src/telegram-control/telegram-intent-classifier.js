'use strict';

const INTENT_PATTERNS = [
  { pattern: /^\/(\w+)/, intent: 'slash_command' },
  { pattern: /^(cek|check|lihat|tampilkan|show)\s+(productions?|production health|kesehatan)/i, intent: 'prod_health', command: 'prodhealth' },
  { pattern: /^(ada|apa|list|tampilkan)\s+(incident|insiden|kejadian|masalah)/i, intent: 'list_incidents', command: 'incidents' },
  { pattern: /^(kenapa|mengapa|why)\s+(deploy|render)\s+(gagal|fail)/i, intent: 'analyze_deploy_failure', command: 'analyze_incident' },
  { pattern: /^(kenapa|mengapa|why)\s+(gagal|fail|error)/i, intent: 'analyze_incident', command: 'analyze_incident' },
  { pattern: /project\s+(mana|yang|apa)\s+(\w+\s+)?(harus|saya|lanjut|dikerjakan)/i, intent: 'portfolio_next', command: 'portfolio_next' },
  { pattern: /(buat|bikin|create)\s+(rencana|plan|jadwal)\s+(hari ini|today)/i, intent: 'daily_plan', command: 'daily' },
  { pattern: /(rencana|plan|jadwal)\s+(hari ini|today)/i, intent: 'daily_plan', command: 'daily' },
  { pattern: /(buat|bikin|create)\s+rencana\s+(minggu|weekly)/i, intent: 'weekly_plan', command: 'weekly' },
  { pattern: /push\s+(perubahan|change|init)\s+(ini|ke)\s+(ke\s+)?github/i, intent: 'propose_push', command: 'propose_push' },
  { pattern: /deploy\s+(ke|to)\s+render/i, intent: 'propose_deploy', command: 'propose_deploy' },
  { pattern: /rollback\s+(deploy|release|terakhir)/i, intent: 'propose_rollback', command: 'propose_rollback' },
  { pattern: /(buat|bikin|create)\s+(event|acara|calendar)\s+(besok|tomorrow)/i, intent: 'calendar_proposal', command: null },
  { pattern: /(kirim|send)\s+(email|surel)\s+(ini|this)/i, intent: 'gmail_proposal', command: null },
  { pattern: /selesaikan\s+(semua|all)\s+(otomatis|automatic)/i, intent: 'refuse_full_auto' },
  { pattern: /otomatiskan\s+(semua|all)/i, intent: 'refuse_full_auto' },
  { pattern: /(berapa|how many|how much)\s+(token|usage|cost|biaya|pemakaian)/i, intent: 'usage_check', command: 'usage' },
  { pattern: /(token|usage|cost|biaya)\s+(hari ini|today|bulan ini)/i, intent: 'usage_check', command: 'usage' },
  { pattern: /apa\s+(keputusan|decision)\s+(penting|pentingnya)/i, intent: 'decision_memory', command: 'decision_memory' },
  { pattern: /(codex|opencode|hermes)\s+(harus|sebaiknya|recommend)/i, intent: 'tool_recommendation' },
  { pattern: /(help|bantuan|tolong)/i, intent: 'help', command: 'help' },
  { pattern: /^(halo|hi|hello|hai|pagi|siang|sore|malam|good)/i, intent: 'greeting' },
  { pattern: /(terima kasih|thanks|thank you|makasih)/i, intent: 'thanks' },
  { pattern: /(solusi|solution|jawaban|answer)(nya|)\s*(apa|nya)?\s*\??$/i, intent: 'followup_answer' },
  { pattern: /^(baik|ok|oke|okay|yes|ya|setuju)$/i, intent: 'confirmation' },
  { pattern: /^(tidak|no|nggak|gak|skip|batal)$/i, intent: 'rejection' },
  { pattern: /(status|kondisi)\s+(bot|server|system|sistem)/i, intent: 'status', command: 'status' },
  { pattern: /(siapa|who)\s+(saya|i am|aku)/i, intent: 'whoami', command: 'whoami' },
  { pattern: /(tugas|task|kerjaan)\s+(saya|hari ini|today)/i, intent: 'tasks', command: 'tasks' },
  { pattern: /(habits?|kebiasaan)\s+(hari ini|today|check)/i, intent: 'habits', command: 'habits' },
  { pattern: /(mood|suasana hati|perasaan)\s+(hari ini|today)/i, intent: 'mood', command: 'mood' },
  { pattern: /(energi|energy)\s+(hari ini|today)/i, intent: 'energy', command: 'energy' },
  { pattern: /(focus|fokus)\s+(hari ini|today|session)/i, intent: 'focus', command: 'focus' },
  { pattern: /(sekarang|now|waktunya)\s+(focus|fokus|kerja)/i, intent: 'focus', command: 'focus' },
  { pattern: /(reminder|pengingat|ingatkan)/i, intent: 'reminders', command: 'reminders' },
  { pattern: /(knowledge|pengetahuan|dokumen|docs)\s+(cari|search|tentang)/i, intent: 'knowledge_search', command: 'knowledge_search' },
  { pattern: /(knowledge|pengetahuan)\s+(status|overview)/i, intent: 'knowledge', command: 'knowledge' },
  { pattern: /(portfolio|portofolio|project)\s+(status|overview|ringkasan)/i, intent: 'portfolio', command: 'portfolio' },
  { pattern: /(goal|tujuan)\s+(apa|list|saya)/i, intent: 'goals', command: 'goals' },
  { pattern: /(prioritas|priority)\s+(apa|list|saya)/i, intent: 'priorities', command: 'priorities' },
  { pattern: /(plans|rencana)\s+(apa|list|saya)/i, intent: 'plans', command: 'plans' },
  { pattern: /(integrations?|integrasi|konektor)\s+(status|list)/i, intent: 'integrations', command: 'integrations' },
  { pattern: /(backup|cadangan)\s+(status|buat|create)/i, intent: 'backup', command: 'backup' },
  { pattern: /(briefing|ringkasan|daily brief)/i, intent: 'briefing', command: 'briefing' },
  { pattern: /(laporan|report)\s+(portfolio|portofolio|project)/i, intent: 'portfolioreport', command: 'portfolioreport' },
  { pattern: /(laporan|report)\s+(life|hidup)/i, intent: 'lifereport', command: 'lifereport' },
  { pattern: /jalankan\s+operating\s+loop/i, intent: 'operating_loop_run' },
  { pattern: /ringkasan\s+ai\s*os\s+(hari ini|today|harian)/i, intent: 'aios_daily_briefing' },
  { pattern: /(apa|what)\s+(yang\s+)?harus\s+(saya\s+)?lakukan\s+(sekarang|now)/i, intent: 'what_next_action' },
  { pattern: /(ada|list|apa\s+saja)\s+blocker/i, intent: 'what_blockers' },
  { pattern: /(ada|list|apa\s+saja)\s+proposal\s+pending/i, intent: 'what_pending_proposals' },
  { pattern: /(aktifkan|enable|hidupkan)\s+daily\s+loop/i, intent: 'enable_daily_loop' },
  { pattern: /(matikan|disable|nonaktifkan)\s+daily\s+loop/i, intent: 'disable_daily_loop' }
];

const BLOCKED_PATTERNS = [
  /TELEGRAM_TOKEN\s*=/i,
  /GITHUB_TOKEN\s*=/i,
  /DATABASE_URL\s*=/i,
  /REDIS_URL\s*=/i,
  /DASHBOARD_ADMIN_TOKEN\s*=/i,
  /GOOGLE_CLIENT_SECRET\s*=/i,
  /CLOUDFLARE_API_TOKEN\s*=/i,
  /RENDER_DEPLOY_HOOK\s*=/i,
  /sk-[A-Za-z0-9]{10,}/,
  /ghp_[A-Za-z0-9]{10,}/,
  /github_pat_[A-Za-z0-9_]{10,}/,
  /postgresql:\/\/[^\s]+/,
  /rediss:\/\/[^\s]+/
];

function classifyTelegramIntent(message, context) {
  if (!message || typeof message !== 'string') {
    return { intent: 'unknown', confidence: 0, command: null };
  }

  const text = message.trim();

  for (const bp of BLOCKED_PATTERNS) {
    if (bp.test(text)) {
      return { intent: 'contains_secret', confidence: 100, command: null, blocked: true };
    }
  }

  if (text.startsWith('/')) {
    const cmd = text.split(/\s+/)[0].replace(/^\//, '').toLowerCase();
    return { intent: 'slash_command', confidence: 100, command: cmd, raw: text };
  }

  for (const ip of INTENT_PATTERNS) {
    const match = text.match(ip.pattern);
    if (match) {
      return {
        intent: ip.intent,
        confidence: 90,
        command: ip.command,
        matched: match[0],
        raw: text
      };
    }
  }

  return { intent: 'unknown', confidence: 10, command: null, raw: text };
}

function isSecretMessage(text) {
  if (!text) return false;
  return BLOCKED_PATTERNS.some(p => p.test(text));
}

module.exports = {
  classifyTelegramIntent,
  isSecretMessage,
  INTENT_PATTERNS,
  BLOCKED_PATTERNS
};
