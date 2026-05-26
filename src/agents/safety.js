'use strict';

const observability = require('./observability');

/**
 * Safety & Security Agent
 * Menyediakan perlindungan Prompt Injection, Policy-based Action Gating,
 * dan Output Sanitization Layer.
 */
class SafetyAgent {
  constructor() {
    // Daftar kata kunci atau frasa sensitif yang tidak boleh bocor ke luar
    this.sensitivePatterns = [
      /mistral_api_key/i,
      /groq_api_key/i,
      /tavily_api_key/i,
      /telegram_token/i,
      /google_client_secret/i,
      /github_token/i,
      /system_prompt/i,
      /ignoring previous/i,
      /override instruction/i
    ];
  }

  /**
   * Menilai apakah kueri input mengandung upaya bypass keamanan atau injeksi prompt
   * @param {string} traceId
   * @param {string} userMessage
   * @returns {boolean} true jika terdeteksi tidak aman
   */
  validateInput(traceId, userMessage) {
    if (!userMessage || typeof userMessage !== 'string') return true; // Tolak input malformed
    
    const lower = userMessage.toLowerCase();
    
    // Pola Prompt Injection Tambahan Tingkat Lanjut
    const unsafePatterns = [
      'ignore previous',
      'abaikan instruksi',
      'ignore all instruction',
      'kamu sekarang adalah',
      'you are now',
      'override system',
      'hack memory',
      'reset system prompt',
      'jailbreak',
      'bypass filter',
      'reveal your system prompt',
      'tunjukkan instruksi sistem'
    ];

    const hasInjection = unsafePatterns.some(p => lower.includes(p));

    if (hasInjection) {
      observability.logEvent(traceId, 'SafetyAgent', 'INPUT_REJECTED_PROMPT_INJECTION', {
        inputLength: userMessage.length
      });
      return false; // Input tidak aman
    }

    observability.logEvent(traceId, 'SafetyAgent', 'INPUT_VALIDATED_SAFE');
    return true; // Input aman
  }

  /**
   * Memeriksa hak akses untuk aksi-aksi sensitif (Action Gating)
   * @param {string} traceId
   * @param {string} userId
   * @param {string} intent
   * @param {object} botServices
   * @returns {boolean} true jika aksi diijinkan
   */
  gateAction(traceId, userId, intent, botServices) {
    // Daftar intent yang membutuhkan kewenangan admin/owner
    const restrictedIntents = ['RELOADPLUGINS', 'RESET_SYSTEM', 'BAN_MEMBER'];
    
    if (!restrictedIntents.includes(intent.toUpperCase())) {
      return true; // Aksi normal diijinkan
    }

    const { env = {} } = botServices;
    
    // Pastikan user terdaftar di admin set
    const adminSet = env.ADMIN_SET || new Set();
    const isAuthorized = adminSet.has(String(userId)) || String(userId) === String(env.OWNER_CHAT_ID);

    if (!isAuthorized) {
      observability.logEvent(traceId, 'SafetyAgent', 'ACTION_GATING_BLOCKED', {
        userId,
        intent
      });
      return false; // Aksi diblokir
    }

    observability.logEvent(traceId, 'SafetyAgent', 'ACTION_GATING_ALLOWED', {
      userId,
      intent
    });
    return true; // Aksi disetujui
  }

  /**
   * Menyaring respons bot sebelum dikirim untuk mencegah kebocoran informasi sensitif (Sanitization)
   * @param {string} traceId
   * @param {string} responseText
   * @returns {string} respons steril yang aman dikirim
   */
  sanitizeOutput(traceId, responseText) {
    if (!responseText) return '';

    let cleanText = responseText;

    // 1. Ganti semua token sensitif dengan tag sensor
    for (const pattern of this.sensitivePatterns) {
      if (pattern.test(cleanText)) {
        observability.logEvent(traceId, 'SafetyAgent', 'LEAK_DETECTED_AND_SANITIZED', {
          matchedPattern: pattern.toString()
        });
        cleanText = cleanText.replace(pattern, '[SENSOR_SECURITY_KEY]');
      }
    }

    // 2. Hapus referensi jalur file internal sistem Node.js
    const pathRegex = /\/[a-zA-Z0-9_\.\-]+/g;
    if (cleanText.includes('/Users/') || cleanText.includes('/app/')) {
      cleanText = cleanText.replace(/\/Users\/[a-zA-Z0-9_\/\.\-]+/g, '[INTERNAL_SYSTEM_PATH]');
      cleanText = cleanText.replace(/\/app\/[a-zA-Z0-9_\/\.\-]+/g, '[INTERNAL_SYSTEM_PATH]');
    }

    observability.logEvent(traceId, 'SafetyAgent', 'OUTPUT_SANITIZED');
    return cleanText;
  }

  // --- Phase 7: File-Based Security ---

  /**
   * Mendeteksi prompt injection yang tersembunyi di dalam isi file/dokumen
   * @param {string} traceId
   * @param {string} extractedText - Teks hasil parsing dari file
   * @returns {{ safe: boolean, threats: string[] }}
   */
  validateFileContent(traceId, extractedText) {
    if (!extractedText || typeof extractedText !== 'string') return { safe: true, threats: [] };

    const lower = extractedText.toLowerCase();
    const threats = [];

    // Pola prompt injection di dalam dokumen
    const fileInjectionPatterns = [
      { pattern: 'ignore previous', label: 'PROMPT_OVERRIDE' },
      { pattern: 'abaikan instruksi', label: 'PROMPT_OVERRIDE_ID' },
      { pattern: 'you are now', label: 'ROLE_HIJACK' },
      { pattern: 'kamu sekarang adalah', label: 'ROLE_HIJACK_ID' },
      { pattern: 'system prompt', label: 'SYSTEM_LEAK_ATTEMPT' },
      { pattern: 'override system', label: 'SYSTEM_OVERRIDE' },
      { pattern: 'reveal your instruction', label: 'INSTRUCTION_LEAK' },
      { pattern: 'jailbreak', label: 'JAILBREAK' },
      { pattern: 'bypass filter', label: 'FILTER_BYPASS' },
      { pattern: 'hack memory', label: 'MEMORY_ATTACK' },
      { pattern: 'delete all data', label: 'DATA_DESTRUCTION' },
      { pattern: 'hapus semua data', label: 'DATA_DESTRUCTION_ID' }
    ];

    for (const { pattern, label } of fileInjectionPatterns) {
      if (lower.includes(pattern)) {
        threats.push(label);
      }
    }

    if (threats.length > 0) {
      observability.logEvent(traceId, 'SafetyAgent', 'FILE_INJECTION_DETECTED', { threats });
      return { safe: false, threats };
    }

    observability.logEvent(traceId, 'SafetyAgent', 'FILE_CONTENT_VALIDATED_SAFE');
    return { safe: true, threats: [] };
  }
}

const globalSafety = new SafetyAgent();

module.exports = globalSafety;
