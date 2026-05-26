'use strict';

const observability = require('./observability');
const { reflectAndCorrectHallucination } = require('../learning/reflection');

/**
 * Evaluator Agent (Phase 5)
 * Melakukan penilaian komprehensif atas kualitas keluaran (Comprehensive Scoring Matrix),
 * memprioritaskan koreksi secara cerdas, dan mencegah evaluasi berlebihan (Optimize Render).
 */
class EvaluatorAgent {
  constructor() {}

  /**
   * Mengkalkulasi metrik matriks komprehensif untuk suatu jawaban
   * @returns {object} Skor dari 0.0 sampai 1.0 untuk tiap dimensi
   */
  calculateComprehensiveScores(query, answer, executionResult) {
    let qScore = 0.5, rScore = 0.5, cScore = 0.5, clarity = 0.5;

    if (!answer || answer.length < 5) return { quality: 0.1, reasoning: 0.1, consistency: 0.1, clarity: 0.1 };

    const qLower = (query || '').toLowerCase();
    const aLower = answer.toLowerCase();

    // 1. Answer Quality & Context Relevance
    const words = qLower.split(/\s+/).filter(w => w.length > 3);
    let matches = 0;
    for (const w of words) {
      if (aLower.includes(w)) matches++;
    }
    if (words.length > 0) qScore += Math.min(0.4, (matches / words.length) * 0.4);

    // 2. Reasoning Score (Cek kata hubung / elaborasi)
    const reasoningMarkers = ['karena', 'oleh sebab itu', 'sehingga', 'artinya', 'dengan demikian', 'jika'];
    let rMatches = 0;
    for (const rm of reasoningMarkers) {
      if (aLower.includes(rm)) rMatches++;
    }
    rScore += Math.min(0.4, rMatches * 0.15);

    // 3. Clarity Score (Apakah bahasanya ringkas dan terbaca?)
    if (answer.length > 1000) clarity -= 0.2; // Terlalu panjang = turun clarity
    if (answer.length > 50 && answer.length < 400) clarity += 0.3; // Ringkas = naik clarity

    // 4. Consistency (Konsistensi format dan tidak berbelit)
    cScore = (qScore + rScore) / 2; // Pendekatan sederhana (heuristic)

    // Hukum jawaban template
    if (aLower.includes('maaf') && (aLower.includes('tidak tahu') || aLower.includes('error'))) {
      qScore -= 0.3; rScore -= 0.2;
    }

    return {
      quality: Math.max(0.1, Math.min(1.0, qScore)),
      reasoning: Math.max(0.1, Math.min(1.0, rScore)),
      consistency: Math.max(0.1, Math.min(1.0, cScore)),
      clarity: Math.max(0.1, Math.min(1.0, clarity))
    };
  }

  /**
   * Mengevaluasi draf dengan Lazy Reflection (Intelligent Correction Prioritization)
   * Hanya memanggil reflection mendalam jika skornya rendah (agar menghemat RAM & Latency).
   */
  evaluate(traceId, query, draftAnswer, executionResult = null) {
    observability.logEvent(traceId, 'EvaluatorAgent', 'EVALUATION_START');

    // 1. Matriks Skor Awal
    const scores = this.calculateComprehensiveScores(query, draftAnswer, executionResult);
    
    // Intelligent Correction Prioritization:
    // Jangan repot-repot refleksi dalam jika jawabannya sederhana dan nilainya tinggi
    const isQualityHigh = (scores.quality >= 0.7 && scores.clarity >= 0.6);
    
    let finalAnswer = draftAnswer;
    let didReflect = false;

    if (!isQualityHigh) {
      // Skor rendah = Panggil *Deep Reflection*
      observability.logEvent(traceId, 'EvaluatorAgent', 'DEEP_REFLECTION_TRIGGERED', { scores });
      finalAnswer = reflectAndCorrectHallucination(draftAnswer, executionResult);
      didReflect = true;
    } else {
      observability.logEvent(traceId, 'EvaluatorAgent', 'SKIPPED_DEEP_REFLECTION_(LAZY_EVAL)');
    }

    // Skor final pasca evaluasi/refleksi
    const finalScores = didReflect 
      ? this.calculateComprehensiveScores(query, finalAnswer, executionResult) 
      : scores;

    observability.logEvent(traceId, 'EvaluatorAgent', 'EVALUATION_COMPLETE', {
      finalScores,
      didReflect
    });

    return {
      finalAnswer,
      qualityScore: finalScores.quality,
      reasoningScore: finalScores.reasoning,
      metrics: finalScores
    };
  }
}

module.exports = new EvaluatorAgent();
