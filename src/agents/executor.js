'use strict';

const observability = require('./observability');
const toolRouter = require('./tool-router');
const { executeSemanticAction } = require('../action/action-executor');

/**
 * Executor Agent
 * Mengeksekusi API aksi / normal chat fallback dengan menyelaraskan format
 * berpikir kritis berdasarkan Mode Operasional aktif (Learning, Analysis, Builder, Research, Safety).
 */
class ExecutorAgent {
  constructor() {}

  /**
   * Menentukan petunjuk prompt sistem berdasarkan mode operasional aktif
   */
  getOperationalModePrompt(mode) {
    const activeMode = String(mode || 'santai').toLowerCase();

    switch (activeMode) {
      case 'belajar':
      case 'learning':
        return `
[OPERATIONAL MODE: LEARNING]
- Berikan penjelasan yang mendalam, ramah, dan fokus pada pemahaman konsep dasar.
- Rincikan penalaran Anda secara langkah-demi-langkah (step-by-step reasoning).
- Jelaskan *kenapa* suatu solusi dipilih, apa asumsi yang digunakan, serta berikan analogi sederhana bila relevan.
- Bantu pengguna untuk berpikir lebih sistematis.
        `.trim();

      case 'analisis':
      case 'analysis':
      case 'kritis':
      case 'critical':
      case 'deep':
      case 'deep-analysis':
      case 'deep analysis':
        return `
[OPERATIONAL MODE: ANALYSIS]
- Lakukan bedah masalah secara mendalam dengan mengevaluasi logika dan pola akar masalah (*root cause*).
- Sajikan analisis PRO dan KONTRA secara objektif untuk setiap opsi.
- Nilai secara eksplisit tentang trade-off (keuntungan vs kerugian), risiko, dan dampaknya.
- Deteksi potensi circular reasoning (penalaran berputar) atau kelemahan argumen dalam solusi yang diajukan.
        `.trim();

      case 'builder':
        return `
[OPERATIONAL MODE: BUILDER]
- Fokuskan respons pada implementasi konkret, efisiensi tinggi, dan stabilitas produksi jangka panjang.
- Berikan kode atau panduan teknis yang siap pakai, ringkas, bersih, dan modular.
- Hindari basa-basi; langsung berikan arsitektur optimal dan dokumentasi praktis.
        `.trim();

      case 'research':
      case 'riset':
      case 'research intelligence':
        return `
[OPERATIONAL MODE: RESEARCH]
- Utamakan akurasi fakta berbasis bukti ilmiah yang kuat.
- Bandingkan beberapa sudut pandang secara kritis dan bedakan antara fakta, inferensi (kesimpulan logis), serta opini.
- Lakukan cross-check informasi secara ketat dan hindari spekulasi liar.
        `.trim();

      case 'refleksi':
      case 'reflection':
      case 'self-reflection':
      case 'self reflection':
        return `
[OPERATIONAL MODE: SELF-REFLECTION]
- Evaluasi jawaban sendiri sebelum final: cek logika, kontradiksi, confidence, dan risiko.
- Jika belum yakin, katakan batas ketidakpastian dengan jujur dan minta klarifikasi singkat bila perlu.
- Jelaskan kelemahan reasoning hanya jika relevan untuk membantu pengguna belajar.
        `.trim();

      case 'mentor':
        return `
[OPERATIONAL MODE: MENTOR]
- Fokus membantu pengguna belajar pola pikir, bukan hanya memberi jawaban akhir.
- Jelaskan konsep, contoh kecil, trade-off, dan pertanyaan reflektif yang berguna.
- Gunakan bahasa yang membimbing, jelas, dan tidak menggurui.
        `.trim();

      case 'optimasi':
      case 'optimization':
      case 'autonomous optimization':
        return `
[OPERATIONAL MODE: AUTONOMOUS OPTIMIZATION]
- Fokus pada bottleneck, efisiensi, reliability, dan langkah perbaikan yang paling berdampak.
- Jelaskan risiko perubahan, metrik yang perlu diamati, dan rollback aman jika hasil memburuk.
        `.trim();

      case 'safety':
      case 'aman':
        return `
[OPERATIONAL MODE: SAFETY]
- Terapkan kebijakan perlindungan ketat dari tindakan berisiko atau merusak.
- Validasi niat (*intent*) pengguna secara hati-hati, ingatkan bahaya/dampak negatif dari tindakan jika tidak aman.
- Tolak permintaan yang tidak aman dengan sopan namun tegas.
        `.trim();

      default:
        return `
[OPERATIONAL MODE: STANDARD]
- Berikan jawaban yang cerdas, sopan, dan bermanfaat sesuai preferensi pengguna.
        `.trim();
    }
  }

  /**
   * Mengeksekusi aksi/tool secara aman menggunakan action-executor lama
   */
  async executeTool(traceId, intent, params, chatId, userId, msgObj, botServices) {
    const startTime = Date.now();
    observability.logEvent(traceId, 'ExecutorAgent', 'TOOL_EXECUTION_START', { intent, params });

    try {
      const result = await executeSemanticAction(intent, params, chatId, userId, msgObj, botServices);
      
      toolRouter.logAuditTrail(traceId, intent, params, startTime, result.ok, result.error);
      
      observability.logEvent(traceId, 'ExecutorAgent', 'TOOL_EXECUTION_SUCCESS', {
        intent,
        ok: result.ok
      });

      return result;
    } catch (err) {
      toolRouter.logAuditTrail(traceId, intent, params, startTime, false, err.message);
      
      observability.logEvent(traceId, 'ExecutorAgent', 'TOOL_EXECUTION_FAIL', {
        intent,
        error: err.message
      });

      return { toolExecuted: intent, ok: false, error: err.message };
    }
  }

  /**
   * Mengeksekusi normal chat fallback (Smart Reply) dengan menyuntikkan instruksi mode berpikir kritis
   */
  async executeChat(traceId, userId, userMessage, context, botServices, intent = null) {
    const { getSmartAnswer, getSystemPrompt } = botServices;
    const activeMode = context.currentMode && context.currentMode !== 'Standard'
      ? context.currentMode
      : context.mode;
    
    observability.logEvent(traceId, 'ExecutorAgent', 'CHAT_EXECUTION_START', {
      mode: activeMode,
      intent
    });

    const systemPrompt = getSystemPrompt(userId);
    const modePrompt = this.getOperationalModePrompt(activeMode);

    // Injeksi memori selektif dan instruksi mode operasional ke LLM
    const enrichedPrompt = `
[INFORMASI CONTEXT USER]
Mood: ${context.mood}
Fakta Tersimpan: ${context.summary}
Minat/Tag: ${context.tags}
Daftar Todo: ${context.todos}
Pengingat: ${context.reminders}
Status Sesi: ${context.sessionState}

[MODE OPERASIONAL AKTIF]
${modePrompt}

[SINYAL ADAPTIF DAN SELF-IMPROVEMENT]
${context.adaptiveRules || 'Tidak ada sinyal adaptif khusus.'}

[MODE PIPELINE TERDETEKSI]
${activeMode || 'Standard'}

[KONTEKS FILE JIKA ADA]
Nama File: ${context.fileName || '-'}
Tipe File: ${context.fileContentType || '-'}
Isi Utama: ${context.fileContent || '-'}
Poin Penting: ${context.fileKeyPoints || '-'}
Batasan: ${context.fileLimitations || '-'}

[PESAN USER]
${userMessage}
    `.trim();

    try {
      const answer = await getSmartAnswer(enrichedPrompt, userId, systemPrompt, intent);
      
      observability.logEvent(traceId, 'ExecutorAgent', 'CHAT_EXECUTION_SUCCESS');
      return answer;
    } catch (err) {
      observability.logEvent(traceId, 'ExecutorAgent', 'CHAT_EXECUTION_FAIL', {
        error: err.message
      });
      throw err;
    }
  }
}

const globalExecutor = new ExecutorAgent();

module.exports = globalExecutor;
