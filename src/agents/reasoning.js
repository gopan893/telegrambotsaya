'use strict';

const observability = require('./observability');

/**
 * Reasoning Agent (Phase 6)
 * Bertugas mengevaluasi logika, membongkar asumsi, memeriksa bias,
 * dan melakukan multi-perspective analysis pada opini agen lain.
 */
class ReasoningAgent {
  constructor() {}

  /**
   * Mengevaluasi bias dan asumsi dari suatu pendapat
   */
  evaluateLogic(opinionText) {
    if (!opinionText) return { score: 0.1, flaws: ['Teks kosong'] };
    
    let score = 0.8;
    const flaws = [];
    const lower = opinionText.toLowerCase();

    if (lower.includes('pasti') || lower.includes('selalu') || lower.includes('tidak pernah')) {
      score -= 0.3;
      flaws.push('Asumsi mutlak (Absolute statement) terdeteksi. Logika mungkin bias.');
    }
    
    if (lower.includes('pokoknya') || lower.includes('pokoknya')) {
      score -= 0.4;
      flaws.push('Logika tidak didukung argumen yang sehat (Blind assertion).');
    }

    return { 
      score: Math.max(0.1, Math.min(1.0, score)),
      flaws
    };
  }

  /**
   * Menganalisis bukti dari Research Agent dan draf awal dari Executor
   * Menghasilkan perspektif baru atau menyoroti trade-off
   */
  analyze(traceId, draftAnswer, researchEvidence) {
    observability.logEvent(traceId, 'ReasoningAgent', 'ANALYSIS_START');
    
    const logicEval = this.evaluateLogic(draftAnswer);
    let reasoningPerspective = draftAnswer;
    
    if (logicEval.flaws.length > 0) {
      reasoningPerspective += '\n\n**[Evaluasi Reasoning Agent]:** Terdapat potensi cacat logika: ' + logicEval.flaws.join(' ');
    }

    if (researchEvidence && researchEvidence.confidence < 0.5) {
      reasoningPerspective += '\n\n**[Evaluasi Reasoning Agent]:** Bukti yang diberikan terlalu lemah untuk mendukung kesimpulan ini secara meyakinkan.';
    }

    observability.logEvent(traceId, 'ReasoningAgent', 'ANALYSIS_COMPLETE', { logicScore: logicEval.score });

    return {
      agent: 'ReasoningAgent',
      opinionText: reasoningPerspective,
      confidence: logicEval.score
    };
  }
}

module.exports = new ReasoningAgent();
