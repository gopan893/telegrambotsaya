'use strict';

const observability = require('./observability');

const MAX_HISTORY = 30;
const MAX_LEARNING_MEMORY = 20;
const MAX_FAILURES = 20;

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function getWords(text) {
  return String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9\u00c0-\u024f\u0370-\u03ff\u0400-\u04ff\u3040-\u30ff\u4e00-\u9fff-]/gi, ''))
    .filter((word) => word.length > 3);
}

function estimateMemoryRelevance(query, context) {
  const facts = [
    context?.summary,
    context?.history,
    context?.tags,
    context?.todos,
    context?.reminders
  ].filter(Boolean).join('\n').toLowerCase();

  const words = getWords(query);
  if (!words.length || !facts.trim()) return 0.5;

  const matches = words.filter((word) => facts.includes(word)).length;
  return clamp01(0.35 + (matches / words.length) * 0.65);
}

function estimateRiskScore(answer, verification, executionResult) {
  const lower = String(answer || '').toLowerCase();
  let risk = 0.1;

  if (verification?.annotation) risk += 0.25;
  if (verification?.failedReason) risk += 0.25;
  if (executionResult && executionResult.ok === false) risk += 0.2;
  if (lower.includes('pasti') || lower.includes('selalu') || lower.includes('tidak pernah')) risk += 0.1;
  if (lower.includes('tidak yakin') || lower.includes('belum pasti')) risk -= 0.05;

  return clamp01(risk);
}

function estimateLearningImpact(answer) {
  const lower = String(answer || '').toLowerCase();
  const markers = [
    'karena',
    'trade-off',
    'risiko',
    'asumsi',
    'alternatif',
    'contoh',
    'langkah',
    'artinya',
    'kenapa'
  ];

  const hits = markers.filter((marker) => lower.includes(marker)).length;
  return clamp01(0.25 + hits * 0.1);
}

function averageMetric(history, key) {
  if (!history.length) return 0.5;
  const total = history.reduce((sum, item) => sum + clamp01(item.metrics?.[key]), 0);
  return clamp01(total / history.length);
}

class SelfImprovementAgent {
  ensureState(user) {
    if (!user.selfImprovement) {
      user.selfImprovement = {
        version: 1,
        samples: 0,
        rolling: {},
        reasoningHistory: [],
        learningMemory: [],
        failureHistory: [],
        promptHints: {
          reasoningDepth: 'normal',
          answerStyle: 'balanced',
          clarifyWhenUncertain: true
        },
        rollbackSnapshot: null,
        updatedAt: Date.now()
      };
    }

    return user.selfImprovement;
  }

  scoreInteraction(input = {}) {
    const {
      query,
      answer,
      evaluation = {},
      verification = {},
      executionResult = null,
      context = {},
      latencyMs = 0
    } = input;

    const evalMetrics = evaluation.metrics || {};
    const quality = clamp01(evaluation.qualityScore ?? evalMetrics.quality ?? 0.5);
    const reasoning = clamp01(evaluation.reasoningScore ?? evalMetrics.reasoning ?? 0.5);
    const confidence = clamp01(verification.confidence ?? quality);
    const toolAccuracy = executionResult ? (executionResult.ok ? 1 : 0.2) : 0.8;
    const memoryRelevance = estimateMemoryRelevance(query, context);
    const consistency = clamp01(evalMetrics.consistency ?? 0.5);
    const clarity = clamp01(evalMetrics.clarity ?? 0.5);
    const risk = estimateRiskScore(answer, verification, executionResult);
    const learningImpact = estimateLearningImpact(answer);
    const latencyEfficiency = latencyMs > 0 ? clamp01(1 - Math.min(latencyMs, 45000) / 45000) : 0.7;
    const userSatisfaction = clamp01((quality + clarity + confidence + learningImpact - risk) / 4);

    return {
      answerQuality: quality,
      reasoning,
      confidence,
      toolAccuracy,
      memoryRelevance,
      userSatisfaction,
      consistency,
      risk,
      clarity,
      learningImpact,
      latencyEfficiency
    };
  }

  buildLearningNote(query, metrics, executionResult) {
    if (metrics.answerQuality < 0.45) {
      return `Jawaban untuk "${String(query).slice(0, 80)}" perlu ditingkatkan: kualitas rendah (${metrics.answerQuality.toFixed(2)}).`;
    }
    if (metrics.reasoning < 0.45) {
      return `Reasoning untuk "${String(query).slice(0, 80)}" perlu lebih eksplisit: alasan/trade-off belum cukup.`;
    }
    if (executionResult && executionResult.ok === false) {
      return `Tool ${executionResult.toolExecuted || 'unknown'} gagal: ${executionResult.error || 'tanpa detail'}. Perlu fallback lebih jelas.`;
    }
    if (metrics.memoryRelevance < 0.35) {
      return `Memori kurang relevan untuk "${String(query).slice(0, 80)}"; konteks perlu dipilih lebih selektif.`;
    }
    return null;
  }

  recalculateRolling(state) {
    state.rolling = {
      answerQuality: averageMetric(state.reasoningHistory, 'answerQuality'),
      reasoning: averageMetric(state.reasoningHistory, 'reasoning'),
      confidence: averageMetric(state.reasoningHistory, 'confidence'),
      toolAccuracy: averageMetric(state.reasoningHistory, 'toolAccuracy'),
      memoryRelevance: averageMetric(state.reasoningHistory, 'memoryRelevance'),
      userSatisfaction: averageMetric(state.reasoningHistory, 'userSatisfaction'),
      consistency: averageMetric(state.reasoningHistory, 'consistency'),
      risk: averageMetric(state.reasoningHistory, 'risk'),
      clarity: averageMetric(state.reasoningHistory, 'clarity'),
      learningImpact: averageMetric(state.reasoningHistory, 'learningImpact'),
      latencyEfficiency: averageMetric(state.reasoningHistory, 'latencyEfficiency')
    };
  }

  updatePromptHints(state) {
    const r = state.rolling || {};

    if ((r.reasoning || 0.5) < 0.55) {
      state.promptHints.reasoningDepth = 'deeper';
    } else if ((r.latencyEfficiency || 0.7) < 0.35 && (r.answerQuality || 0.5) > 0.65) {
      state.promptHints.reasoningDepth = 'concise';
    } else {
      state.promptHints.reasoningDepth = 'normal';
    }

    if ((r.clarity || 0.5) < 0.5) {
      state.promptHints.answerStyle = 'clearer';
    } else if ((r.learningImpact || 0.5) > 0.7) {
      state.promptHints.answerStyle = 'mentor';
    } else {
      state.promptHints.answerStyle = 'balanced';
    }

    state.promptHints.clarifyWhenUncertain = (r.confidence || 0.5) < 0.55 || (r.risk || 0.2) > 0.45;
  }

  rollbackIfUnstable(traceId, state) {
    const recentFailures = state.failureHistory
      .slice(-5)
      .filter((item) => item.reason === 'LOW_QUALITY' || item.reason === 'HIGH_RISK');

    if (recentFailures.length < 4 || !state.rollbackSnapshot) return false;

    state.promptHints = { ...state.rollbackSnapshot.promptHints };
    state.failureHistory.push({
      reason: 'UNSTABLE_LEARNING_ROLLBACK',
      ts: Date.now(),
      details: 'Prompt hints dikembalikan karena kegagalan berulang.'
    });
    if (state.failureHistory.length > MAX_FAILURES) state.failureHistory.shift();

    observability.logEvent(traceId, 'SelfImprovementAgent', 'LEARNING_ROLLBACK_APPLIED');
    return true;
  }

  async recordInteraction(traceId, userId, input, botServices) {
    const { ensureUser, persist } = botServices;
    const user = ensureUser(userId);
    const state = this.ensureState(user);
    const metrics = this.scoreInteraction(input);

    if (!state.rollbackSnapshot) {
      state.rollbackSnapshot = {
        promptHints: { ...state.promptHints },
        ts: Date.now()
      };
    }

    state.samples += 1;
    state.reasoningHistory.push({
      ts: Date.now(),
      intent: input.intent || 'NONE',
      metrics,
      question: String(input.query || '').slice(0, 160)
    });
    if (state.reasoningHistory.length > MAX_HISTORY) state.reasoningHistory.shift();

    this.recalculateRolling(state);

    const note = this.buildLearningNote(input.query, metrics, input.executionResult);
    if (note) {
      state.learningMemory.push({ ts: Date.now(), note, metrics });
      if (state.learningMemory.length > MAX_LEARNING_MEMORY) state.learningMemory.shift();
    }

    if (metrics.answerQuality < 0.35 || metrics.risk > 0.65 || input.verification?.failedReason) {
      state.failureHistory.push({
        ts: Date.now(),
        reason: metrics.risk > 0.65 ? 'HIGH_RISK' : 'LOW_QUALITY',
        failedReason: input.verification?.failedReason || null,
        question: String(input.query || '').slice(0, 120)
      });
      if (state.failureHistory.length > MAX_FAILURES) state.failureHistory.shift();
    }

    this.updatePromptHints(state);
    this.rollbackIfUnstable(traceId, state);
    state.updatedAt = Date.now();

    observability.logEvent(traceId, 'SelfImprovementAgent', 'INTERACTION_LEARNED', {
      samples: state.samples,
      metrics,
      promptHints: state.promptHints
    });

    if (typeof persist === 'function') await persist();
    return { metrics, state };
  }

  async recordUserFeedback(traceId, userId, feedbackType, botServices) {
    const { ensureUser, persist } = botServices;
    const user = ensureUser(userId);
    const state = this.ensureState(user);
    const positive = feedbackType === 'positive';
    const metrics = {
      answerQuality: positive ? 0.8 : 0.35,
      reasoning: positive ? 0.7 : 0.4,
      confidence: positive ? 0.75 : 0.45,
      toolAccuracy: 0.8,
      memoryRelevance: 0.5,
      userSatisfaction: positive ? 0.9 : 0.2,
      consistency: 0.55,
      risk: positive ? 0.1 : 0.45,
      clarity: positive ? 0.75 : 0.35,
      learningImpact: 0.5,
      latencyEfficiency: 0.7
    };

    state.samples += 1;
    state.reasoningHistory.push({
      ts: Date.now(),
      intent: 'USER_FEEDBACK',
      metrics,
      question: `explicit:${feedbackType}`
    });
    if (state.reasoningHistory.length > MAX_HISTORY) state.reasoningHistory.shift();

    if (!positive) {
      state.learningMemory.push({
        ts: Date.now(),
        note: 'User memberi feedback negatif. Prioritaskan klarifikasi, clarity, dan jangan terlalu yakin saat data kurang.',
        metrics
      });
      state.failureHistory.push({
        ts: Date.now(),
        reason: 'USER_NEGATIVE_FEEDBACK',
        question: 'explicit feedback'
      });
      if (state.learningMemory.length > MAX_LEARNING_MEMORY) state.learningMemory.shift();
      if (state.failureHistory.length > MAX_FAILURES) state.failureHistory.shift();
    }

    this.recalculateRolling(state);
    this.updatePromptHints(state);
    this.rollbackIfUnstable(traceId, state);
    state.updatedAt = Date.now();

    observability.logEvent(traceId, 'SelfImprovementAgent', 'USER_FEEDBACK_LEARNED', {
      feedbackType,
      promptHints: state.promptHints
    });

    if (typeof persist === 'function') await persist();
    return { metrics, state };
  }

  generatePromptHints(userId, botServices) {
    const { ensureUser } = botServices;
    const user = ensureUser(userId);
    const state = this.ensureState(user);
    const hints = state.promptHints || {};
    const lines = [];

    if (hints.reasoningDepth === 'deeper') {
      lines.push('(SELF-IMPROVEMENT: Reasoning sebelumnya kurang kuat. Jelaskan alasan, asumsi, trade-off, dan risiko dengan lebih jelas.)');
    } else if (hints.reasoningDepth === 'concise') {
      lines.push('(SELF-IMPROVEMENT: Kualitas cukup baik tetapi biaya/latensi perlu hemat. Jawab lebih ringkas tanpa menghilangkan alasan utama.)');
    }

    if (hints.answerStyle === 'clearer') {
      lines.push('(SELF-IMPROVEMENT: Tingkatkan clarity. Gunakan struktur pendek, definisi sederhana, dan langkah konkret.)');
    } else if (hints.answerStyle === 'mentor') {
      lines.push('(SELF-IMPROVEMENT: User merespons baik pada gaya mentor. Tambahkan catatan belajar singkat jika relevan.)');
    }

    if (hints.clarifyWhenUncertain) {
      lines.push('(SELF-IMPROVEMENT: Jika intent atau data tidak cukup jelas, minta klarifikasi singkat sebelum menjalankan tool berisiko.)');
    }

    return lines.join('\n');
  }

  getReport(userId, botServices) {
    const user = botServices.ensureUser(userId);
    const state = this.ensureState(user);

    return {
      samples: state.samples,
      rolling: state.rolling,
      promptHints: state.promptHints,
      learningMemory: state.learningMemory.slice(-5),
      failureHistory: state.failureHistory.slice(-5),
      updatedAt: state.updatedAt
    };
  }
}

module.exports = new SelfImprovementAgent();
