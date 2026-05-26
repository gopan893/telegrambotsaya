'use strict';

const observability = require('./observability');

/**
 * Planner Agent
 * Menganalisis kueri kompleks untuk merumuskan rencana tindakan multi-tahap (Task Planner),
 * mengelola navigasi sesi multi-step, dan melacak pencapaian tujuan (*goal tracking*).
 */
class PlannerAgent {
  constructor() {}

  /**
   * Menilai apakah kueri pengguna memerlukan perencanaan tujuan jangka panjang / multi-langkah
   */
  isComplexGoalRequest(userMessage) {
    if (!userMessage) return false;
    const lower = userMessage.toLowerCase();
    
    const requestKeywords = [
      'roadmap', 'belajar', 'rencana', 'jadwal', 'bantu aku', 'roadmap belajar',
      'program diet', 'rencana olahraga', 'kurikulum', 'langkah demi langkah'
    ];

    const timeKeywords = [
      'hari', 'minggu', 'bulan', 'tahun', '30 hari', '2 minggu', '1 bulan'
    ];

    const hasRequest = requestKeywords.some(kw => lower.includes(kw));
    const hasTime = timeKeywords.some(kw => lower.includes(kw));

    return hasRequest && hasTime;
  }

  /**
   * Menyusun workflow tindakan menggunakan LLM secara semantik
   * @param {string} traceId
   * @param {string} userMessage
   * @param {string} userId
   * @param {object} botServices
   */
  async generatePlan(traceId, userMessage, userId, botServices) {
    const { askAI } = botServices;
    observability.logEvent(traceId, 'PlannerAgent', 'PLAN_GENERATION_START');

    const prompt = `Kamu adalah perancang rencana (AI Planner) tingkat tinggi untuk asisten Telegram.
Pecah tujuan jangka panjang/kompleks pengguna menjadi 3 sampai 4 langkah konkret yang logis, aman, dan mudah ditindaklanjuti secara sekuensial.

Format keluaran wajib berupa JSON valid saja tanpa markdown fences:
{
  "taskName": "Nama tugas utama",
  "steps": [
    "Langkah 1: Deskripsi tindakan...",
    "Langkah 2: Deskripsi tindakan...",
    "Langkah 3: Deskripsi tindakan..."
  ],
  "initialData": {
    "topic": "nama topik"
  },
  "explanation": "Penjelasan singkat mengenai roadmap ini."
}

Tujuan Pengguna:
"${userMessage}"
`;

    try {
      const rawResponse = await askAI(
        'Kamu adalah AI Planner murni. Kamu HANYA boleh mengeluarkan output JSON valid untuk perencanaan.',
        prompt,
        {
          userId,
          question: userMessage,
          allowSearch: false,
          temperature: 0.3,
          maxTokens: 500,
          allowCache: false,
          allowRawJson: true
        }
      );

      const cleaned = String(rawResponse || '')
        .replace(/```json\s*/gi, '')
        .replace(/```/g, '')
        .trim();

      const plan = JSON.parse(cleaned);

      if (!plan || !plan.taskName || !Array.isArray(plan.steps) || plan.steps.length === 0) {
        throw new Error('Rencana tidak memiliki parameter valid.');
      }

      observability.logEvent(traceId, 'PlannerAgent', 'PLAN_GENERATION_SUCCESS', {
        taskName: plan.taskName,
        stepCount: plan.steps.length
      });

      return plan;

    } catch (err) {
      observability.logEvent(traceId, 'PlannerAgent', 'PLAN_GENERATION_FAIL_FALLBACK', {
        error: err.message
      });

      // Rencana fallback aman dan ramah pengguna
      return {
        taskName: 'Panduan Rencana Terstruktur',
        steps: [
          'Langkah 1: Identifikasi tujuan detail dan kumpulkan materi pelajaran.',
          'Langkah 2: Tambahkan daftar todo belajar ke asisten bot.',
          'Langkah 3: Aktifkan pengingat belajar harian di asisten.',
          'Langkah 4: Evaluasi perkembangan mingguan bersama AI.'
        ],
        initialData: { topic: 'Umum' },
        explanation: 'AI menyusun draf rencana belajar terstruktur untuk membantumu berprogres secara konsisten.'
      };
    }
  }

  /**
   * Mengatur kemajuan langkah sesi aktif percakapan
   * @param {string} traceId
   * @param {string} userId
   * @param {string} userMessage
   * @param {object} sessionState
   * @param {object} botServices
   */
  async executeNextStep(traceId, userId, userMessage, sessionState, botServices) {
    const { updateSessionState, clearSessionState } = require('../memory/advanced-memory');
    
    const lower = userMessage.toLowerCase().trim();

    // 1. Cek pembatalan
    if (['batal', 'cancel', 'stop', 'hentikan', 'selesai'].includes(lower)) {
      const taskName = sessionState.activeTask;
      await clearSessionState(userId, botServices);
      
      observability.logEvent(traceId, 'PlannerAgent', 'WORKFLOW_ABORTED', { taskName });
      return `✅ Sesi tugas "${taskName}" telah dihentikan/dibersihkan secara aman.`;
    }

    let currentIndex = sessionState.currentStepIndex;

    // Maju jika ketik "lanjut", "next", dll.
    const isContinuing = [
      'lanjut', 'next', 'ok', 'oke', 'siap', 'sudah', 'done', 'berikutnya'
    ].some(kw => lower.includes(kw));

    if (isContinuing) {
      currentIndex += 1;
    }

    // Jika telah selesai melewati seluruh tahapan rencana
    if (currentIndex >= sessionState.steps.length) {
      await clearSessionState(userId, botServices);
      observability.logEvent(traceId, 'PlannerAgent', 'WORKFLOW_COMPLETED', {
        taskName: sessionState.activeTask
      });

      return `🎉 **Selamat! Rencana "${sessionState.activeTask}" Telah Selesai Diorkestrasi!**\n\nSeluruh langkah awal telah disiapkan. Selamat berjuang meningkatkan skill baru!`;
    }

    // Simpan step aktif terbaru
    await updateSessionState(userId, { currentStepIndex: currentIndex }, botServices);

    const stepDescription = sessionState.steps[currentIndex];

    observability.logEvent(traceId, 'PlannerAgent', 'WORKFLOW_STEP_RENDERED', {
      taskName: sessionState.activeTask,
      step: currentIndex + 1,
      totalSteps: sessionState.steps.length
    });

    return `📈 **[Multi-Step Session: ${sessionState.activeTask}]**\n🔄 **Langkah ${currentIndex + 1} dari ${sessionState.steps.length}**:\n\n👉 *"${stepDescription}"*\n\n---\n💡 Ketik **"lanjut"** untuk melaju ke tahap berikutnya, atau ketik **"batal"** untuk menghentikan.`;
  }
}

const globalPlanner = new PlannerAgent();

module.exports = globalPlanner;
