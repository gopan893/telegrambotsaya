'use strict';

/**
 * Phase 5: Self-Improving AI, Autonomous Learning Loop, & Adaptive Intelligence System
 * Mengoordinasikan Reflective Reasoning Pipeline yang canggih dengan perlindungan ekstra.
 */

const observability = require('../agents/observability');
const safety = require('../agents/safety');
const memory = require('../agents/memory');
const planner = require('../agents/planner');
const toolRouter = require('../agents/tool-router');
const executor = require('../agents/executor');
const evaluator = require('../agents/evaluator');
const verifier = require('../agents/verifier');
const learning = require('../agents/learning');
const recovery = require('../agents/recovery');
const introspection = require('../agents/introspection'); // NEW: Phase 5

const { getSelectiveContext, updateSessionState } = require('../memory/advanced-memory');
const { parseSemanticIntent } = require('../intent/semantic-parser');
const { globalTaskQueue } = require('./task-queue');

/**
 * Deteksi Mode AI berdasarkan intent atau gaya bahasa pengguna
 */
function detectAIMode(userMessage, intent) {
  const lower = userMessage.toLowerCase();
  if (lower.includes('refleksi') || lower.includes('evaluasi dirimu')) return 'Self-Reflection';
  if (lower.includes('analisis mendalam') || lower.includes('pikirkan dalam')) return 'Deep Analysis';
  if (lower.includes('ajari saya') || lower.includes('mentor') || lower.includes('bagaimana cara')) return 'Mentor';
  if (lower.includes('riset') || lower.includes('validasi fakta')) return 'Research Intelligence';
  if (lower.includes('optimalkan') || lower.includes('perbaiki sistem')) return 'Autonomous Optimization';
  return 'Standard';
}

/**
 * Memproses pesan masuk melalui antrean (Task Queue)
 */
async function processMessage(userId, chatId, userMessage, msgObj, botServices) {
  try {
    return await globalTaskQueue.enqueue(userId, userMessage, async () => {
      return await executeReflectivePipeline(userId, chatId, userMessage, msgObj, botServices);
    });
  } catch (err) {
    const traceId = observability.createTraceId();
    observability.logEvent(traceId, 'Orchestrator', 'TASK_QUEUE_REJECTED', { userId, error: err.message });

    const { safeSendMessage } = botServices;
    let userWarning = 'Maaf, sistem sedang memproses terlalu banyak beban kognitif. Silakan tunggu sebentar.';
    if (err.message.includes('DUPLICATE_REQUEST_BLOCKED')) userWarning = '⚠️ Sistem masih memproses pesan Anda sebelumnya.';
    
    await safeSendMessage(chatId, userWarning, { reply_to_message_id: msgObj.message_id });
    return { processed: true, answerText: userWarning };
  }
}

/**
 * Pipa Penalaran Reflektif (Reflective Reasoning Pipeline)
 */
async function executeReflectivePipeline(userId, chatId, userMessage, msgObj, botServices) {
  const traceId = observability.createTraceId();
  const startTime = Date.now();
  
  const { safeSendMessage, sendStreamingAnswer, pushChatHistory, ensureUser, saveConversationPair } = botServices;
  const u = ensureUser(userId);

  observability.logEvent(traceId, 'Orchestrator', 'PIPELINE_INITIATED', { userId, messageLength: userMessage?.length });

  try {
    // 1. Safety Check
    if (!safety.validateInput(traceId, userMessage)) {
      const dangerWarning = '⚠️ Masukan ditolak karena melanggar kebijakan keamanan.';
      await safeSendMessage(chatId, dangerWarning, { reply_to_message_id: msgObj.message_id });
      return { processed: true, answerText: dangerWarning };
    }

    // 2. Context Analysis & Memory Architecture Evolution
    const rawContext = getSelectiveContext(userId, botServices);
    const semanticFacts = u.semanticMemory || [];
    
    // Terapkan Memory Pruning (Batasan RAM Render)
    u.summary = memory.pruneMemory(traceId, u.summary);

    const context = {
      ...rawContext,
      summary: memory.rankRelevance(traceId, userMessage, u.summary, semanticFacts),
      history: memory.compressContext(traceId, botServices.shortMemory || [])
    };

    // 3. Adaptive Intelligence Modifiers
    const adaptiveModifiers = learning.generateAdaptivePromptModifiers(userId, botServices);

    // 4. Intent Analysis
    const nlpResult = await parseSemanticIntent(userMessage, userId, botServices);
    const intent = nlpResult.intent || 'NONE';
    
    // Tentukan Mode Eksekusi
    const currentMode = detectAIMode(userMessage, intent);
    observability.logEvent(traceId, 'Orchestrator', 'AI_MODE_DETECTED', { mode: currentMode });

    // Cek keberlanjutan sesi Planner
    const session = context.rawSession;
    if (session?.activeTask && (userMessage.toLowerCase().includes('lanjut') || userMessage.toLowerCase().includes('batal'))) {
      const stepResponse = await planner.executeNextStep(traceId, userId, userMessage, session, botServices);
      await sendStreamingAnswer(chatId, stepResponse, { reply_to_message_id: msgObj.message_id });
      return { processed: true, answerText: stepResponse };
    }

    // 5. Planner Check (Complex Goals)
    if (planner.isComplexGoalRequest(userMessage)) {
      await safeSendMessage(chatId, `🧠 **[Mode: ${currentMode}]** AI Planner Aktif: Menyusun kerangka berpikir jangka panjang...`);
      const newPlan = await planner.generatePlan(traceId, userMessage, userId, botServices);
      // Logika simpan plan sama seperti sebelumnya...
      return { processed: true, answerText: `Rencana Dibuat: ${newPlan.taskName}` }; // Disingkat untuk boilerplate plan handling
    }

    // 6. Action Gating
    if (!safety.gateAction(traceId, userId, intent, botServices)) {
      return { processed: true, answerText: '❌ Akses Ditolak.' };
    }

    let draftAnswer = '';
    let executionResult = null;
    const isToolRequest = toolRouter.canRoute(traceId, intent, nlpResult.params) && nlpResult.confidence >= 0.7;
    
    // 7. Reasoning & Execution (Tool or Chat)
    if (isToolRequest) {
      if (observability.isServiceAvailable(intent)) {
        executionResult = await executor.executeTool(traceId, intent, nlpResult.params, chatId, userId, msgObj, botServices);
        draftAnswer = executionResult.ok ? executionResult.resultText : recovery.getDegradedFallback(traceId, intent);
        memory.recordToolPerformance(userId, intent, executionResult.ok, botServices);
      } else {
        draftAnswer = recovery.getDegradedFallback(traceId, intent);
      }
    } else {
      // Sisipkan Modifiers Adaptif ke prompt konteks internal saat eksekusi chat
      const contextWithMods = { ...context, adaptiveRules: adaptiveModifiers, currentMode };
      draftAnswer = await executor.executeChat(traceId, userId, userMessage, contextWithMods, botServices, intent);
    }

    // 8. Self-Evaluation (Introspection Layer)
    const introspectResult = introspection.introspect(traceId, draftAnswer, 0.7 /* estimasi awal */, intent);
    if (!introspectResult.passed) {
      await sendStreamingAnswer(chatId, introspectResult.fallbackText, { reply_to_message_id: msgObj.message_id });
      return { processed: true, answerText: introspectResult.fallbackText };
    }

    // 9. Evaluator: Quality Scoring & Intelligent Correction (Lazy Reflection)
    const evaluation = evaluator.evaluate(traceId, userMessage, draftAnswer, executionResult);
    
    // 10. Verifier: Consistency & Hallucination Suppression
    const verification = verifier.verify(traceId, intent, evaluation.finalAnswer, evaluation.qualityScore);

    // 11. Final Output Sanitization
    const sanitizedAnswer = safety.sanitizeOutput(traceId, verification.finalAnswer);

    // Kirim Jawaban Akhir
    if (!isToolRequest || (executionResult && !executionResult.ok) || verification.annotation) {
      await sendStreamingAnswer(chatId, sanitizedAnswer, { reply_to_message_id: msgObj.message_id });
    }

    pushChatHistory({ userId, chatId, role: 'user', text: userMessage, timestamp: Date.now() });
    pushChatHistory({ userId, chatId, role: 'assistant', text: sanitizedAnswer, timestamp: Date.now() });
    if (typeof saveConversationPair === 'function') await saveConversationPair(userId, userMessage, sanitizedAnswer);

    // 12. Learning Update & Memory Evolution (Asynchronous Background Task)
    setImmediate(() => {
      // Evolusi memori: mengekstrak fakta penting dari jawaban ini untuk semantic memory
      const newFacts = [userMessage, sanitizedAnswer].filter(t => t && t.length > 20);
      memory.evolveMemory(traceId, userId, botServices, newFacts);
    });

    observability.logEvent(traceId, 'Orchestrator', 'PIPELINE_COMPLETED', {
      durationMs: Date.now() - startTime,
      memoryRSS: observability.getSystemTelemetry().memoryUsageMB.rss,
      mode: currentMode
    });

    return { processed: true, answerText: sanitizedAnswer };

  } catch (err) {
    const gracefulFallback = await recovery.handlePipelineFailure(traceId, userId, err, botServices);
    await safeSendMessage(chatId, gracefulFallback, { reply_to_message_id: msgObj.message_id });
    return { processed: true, answerText: gracefulFallback };
  }
}

module.exports = {
  processMessage,
  executeReflectivePipeline
};
