'use strict';

const observability = require('./observability');
const memory = require('./memory');

/**
 * Learning Agent (Phase 5)
 * Mengelola Autonomous Learning Loop, Mistake Pattern Analysis, 
 * dan Dynamic Behavior Adaptation berdasarkan interaksi pengguna.
 */
class LearningAgent {
  constructor() {}

  /**
   * Menyimpan histori koreksi dan menganalisis pola kesalahan berulang (Mistake Pattern Analysis)
   */
  async learnFromCorrection(traceId, userId, question, correctIntent, correctParams, botServices) {
    const { ensureUser, persist } = botServices;
    observability.logEvent(traceId, 'LearningAgent', 'LEARN_CORRECTION_START', { userId, correctIntent });

    const u = ensureUser(userId);
    if (!u.correctionMemory) u.correctionMemory = []; // Phase 5: Correction Memory khusus
    
    const cleanQuestion = String(question || '').toLowerCase().trim();

    // Hindari duplikasi persis
    if (u.correctionMemory.some(pat => pat.question === cleanQuestion && pat.intent === correctIntent)) {
      return;
    }

    u.correctionMemory.push({
      question: cleanQuestion,
      intent: correctIntent,
      params: correctParams || {},
      timestamp: Date.now()
    });

    if (u.correctionMemory.length > 30) {
      u.correctionMemory.shift(); // RAM-optimized
    }

    // Mistake Pattern Analysis: Jika ada intent salah yang sering diulang (lebih dari 3x)
    const mistakeCounts = {};
    for (const mem of u.correctionMemory) {
      mistakeCounts[mem.intent] = (mistakeCounts[mem.intent] || 0) + 1;
    }

    const repeatedMistakes = Object.keys(mistakeCounts).filter(intent => mistakeCounts[intent] >= 3);
    if (repeatedMistakes.length > 0) {
      observability.logEvent(traceId, 'LearningAgent', 'REPEATED_MISTAKE_PATTERN_DETECTED', { repeatedMistakes });
      // Promosikan sebagai pelajaran berharga ke Episodic Memory agar sistem lebih berhati-hati
      memory.recordEpisodicEvent(
        traceId, 
        userId, 
        'LEARNING_PATTERN', 
        `Pengguna sering mengoreksi AI untuk menggunakan intent: ${repeatedMistakes.join(', ')}. AI harus lebih sensitif terhadap ini.`, 
        botServices
      );
    }

    await persist();
  }

  /**
   * Mengadaptasi gaya respons (Adaptive Response Style) berdasarkan pola interaksi pengguna
   */
  async adaptBehavior(traceId, userId, feedbackType, botServices) {
    const { ensureUser, persist } = botServices;
    const u = ensureUser(userId);

    if (!u.adaptiveProfile) {
      u.adaptiveProfile = {
        preferShortAnswers: false,
        preferTechnical: false,
        frustrationLevel: 0
      };
    }

    // Analisis sinyal implisit
    if (feedbackType === 'negative_length') {
      u.adaptiveProfile.preferShortAnswers = true;
      u.adaptiveProfile.frustrationLevel++;
    } else if (feedbackType === 'positive_technical') {
      u.adaptiveProfile.preferTechnical = true;
    } else if (feedbackType === 'negative') {
      u.adaptiveProfile.frustrationLevel++;
    } else if (feedbackType === 'positive') {
      u.adaptiveProfile.frustrationLevel = Math.max(0, u.adaptiveProfile.frustrationLevel - 1);
    }

    // Jika user sangat frustrasi, ubah mode otomatis ke yang lebih ringkas atau fallback aman
    if (u.adaptiveProfile.frustrationLevel > 3) {
      observability.logEvent(traceId, 'LearningAgent', 'HIGH_USER_FRUSTRATION_ADAPTING_STYLE');
      u.adaptiveProfile.preferShortAnswers = true; // Auto-adapt
    }

    await persist();
  }

  /**
   * Membangkitkan System Prompt Dinamis yang disesuaikan dari hasil pembelajaran (Dynamic Prompt Evolution)
   */
  generateAdaptivePromptModifiers(userId, botServices) {
    const { ensureUser } = botServices;
    const u = ensureUser(userId);
    let modifiers = '';

    if (u.adaptiveProfile?.preferShortAnswers) {
      modifiers += '\n(ADAPTIVE RULE: Pengguna lebih menyukai jawaban yang sangat singkat dan langsung ke inti/to-the-point.)';
    }
    if (u.adaptiveProfile?.preferTechnical) {
      modifiers += '\n(ADAPTIVE RULE: Pengguna ini mengerti teknis, jangan ragu menggunakan istilah pemrograman dan arsitektur mendalam.)';
    }

    return modifiers;
  }
}

module.exports = new LearningAgent();
