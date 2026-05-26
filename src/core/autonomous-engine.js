'use strict';

/**
 * Phase 6: Multi-Agent Intelligence System & Distributed Reasoning Engine
 * Ekosistem agen kolaboratif dengan Internal Message Bus & Consensus Mechanism
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
const research = require('../agents/research');
const reasoning = require('../agents/reasoning');
const reflection = require('../agents/reflection');

const messageBus = require('./message-bus');
const { getSelectiveContext, updateSessionState } = require('../memory/advanced-memory');
const { parseSemanticIntent } = require('../intent/semantic-parser');
const { globalTaskQueue } = require('./task-queue');

/**
 * Deteksi Mode AI berdasarkan intent atau gaya bahasa pengguna
 */
function detectAIMode(userMessage, intent) {
  const lower = userMessage.toLowerCase();
  if (lower.includes('kolaborasi') || lower.includes('diskusikan')) return 'Collaborative Thinking';
  if (lower.includes('analisis mendalam') || lower.includes('pikirkan dalam')) return 'Deep Analysis';
  if (lower.includes('riset') || lower.includes('validasi fakta')) return 'Research Intelligence';
  if (lower.includes('strategi') || lower.includes('planning kompleks')) return 'Strategic Planning';
  if (lower.includes('sistem analis') || lower.includes('evaluasi architecture')) return 'System Analysis';
  return 'Standard';
}

/**
 * Memproses pesan masuk melalui antrean (Task Queue)
 */
async function processMessage(userId, chatId, userMessage, msgObj, botServices) {
  try {
    return await globalTaskQueue.enqueue(userId, userMessage, async () => {
      return await executeDistributedPipeline(userId, chatId, userMessage, msgObj, botServices);
    });
  } catch (err) {
    const traceId = observability.createTraceId();
    observability.logEvent(traceId, 'Orchestrator', 'TASK_QUEUE_REJECTED', { userId, error: err.message });

    const { safeSendMessage } = botServices;
    let userWarning = 'Maaf, ekosistem agen sedang sibuk. Silakan tunggu sebentar.';
    if (err.message.includes('DUPLICATE_REQUEST_BLOCKED')) userWarning = '⚠️ Sistem masih memproses pesan Anda sebelumnya.';
    
    await safeSendMessage(chatId, userWarning, { reply_to_message_id: msgObj.message_id });
    return { processed: true, answerText: userWarning };
  }
}

/**
 * Pipa Penalaran Terdistribusi (Distributed Reasoning Pipeline)
 */
async function executeDistributedPipeline(userId, chatId, userMessage, msgObj, botServices) {
  const traceId = observability.createTraceId();
  const startTime = Date.now();
  
  const { safeSendMessage, sendStreamingAnswer, pushChatHistory, ensureUser, saveConversationPair } = botServices;
  const u = ensureUser(userId);

  observability.logEvent(traceId, 'Orchestrator', 'PIPELINE_INITIATED', { userId });
  
  // Inisialisasi Internal Message Bus
  messageBus.initContext(traceId, { query: userMessage });

  try {
    // 1. Safety Check
    if (!safety.validateInput(traceId, userMessage)) {
      const dangerWarning = '⚠️ Masukan ditolak karena melanggar kebijakan keamanan.';
      await safeSendMessage(chatId, dangerWarning, { reply_to_message_id: msgObj.message_id });
      messageBus.cleanupContext(traceId);
      return { processed: true, answerText: dangerWarning };
    }

    // 2. Context Analysis & Memory Architecture
    const rawContext = getSelectiveContext(userId, botServices);
    const semanticFacts = u.semanticMemory || [];
    u.summary = memory.pruneMemory(traceId, u.summary);

    const context = {
      ...rawContext,
      summary: memory.rankRelevance(traceId, userMessage, u.summary, semanticFacts),
      history: memory.compressContext(traceId, botServices.shortMemory || [])
    };
    messageBus.updateContext(traceId, 'sharedMemory', context.summary);

    // 3. Adaptive Intelligence Modifiers
    const adaptiveModifiers = learning.generateAdaptivePromptModifiers(userId, botServices);

    // 4. Intent Analysis
    const nlpResult = await parseSemanticIntent(userMessage, userId, botServices);
    const intent = nlpResult.intent || 'NONE';
    
    const currentMode = detectAIMode(userMessage, intent);
    observability.logEvent(traceId, 'Orchestrator', 'AI_MODE_DETECTED', { mode: currentMode });

    // 5. Hierarchical Planning Check
    const session = context.rawSession;
    if (session?.activeTask && (userMessage.toLowerCase().includes('lanjut') || userMessage.toLowerCase().includes('batal'))) {
      const stepResponse = await planner.executeNextStep(traceId, userId, userMessage, session, botServices);
      await sendStreamingAnswer(chatId, stepResponse, { reply_to_message_id: msgObj.message_id });
      messageBus.cleanupContext(traceId);
      return { processed: true, answerText: stepResponse };
    }

    if (planner.isComplexGoalRequest(userMessage)) {
      await safeSendMessage(chatId, `🧠 **[Mode: ${currentMode}]** AI Planner Aktif: Mendelegasikan tugas ke ekosistem agen...`);
      const newPlan = await planner.generatePlan(traceId, userMessage, userId, botServices);
      messageBus.cleanupContext(traceId);
      return { processed: true, answerText: `Rencana Dibuat: ${newPlan.taskName}` };
    }

    // 6. Action Gating
    if (!safety.gateAction(traceId, userId, intent, botServices)) {
      messageBus.cleanupContext(traceId);
      return { processed: true, answerText: '❌ Akses Ditolak.' };
    }

    // 7. Parallel Analysis & Agent Delegation (Lazy Agent Initialization)
    let draftAnswer = '';
    let executionResult = null;
    const isToolRequest = toolRouter.canRoute(traceId, intent, nlpResult.params) && nlpResult.confidence >= 0.7;
    
    if (isToolRequest) {
      if (observability.isServiceAvailable(intent)) {
        executionResult = await executor.executeTool(traceId, intent, nlpResult.params, chatId, userId, msgObj, botServices);
        draftAnswer = executionResult.ok ? executionResult.resultText : recovery.getDegradedFallback(traceId, intent);
        memory.recordToolPerformance(userId, intent, executionResult.ok, botServices);
      } else {
        draftAnswer = recovery.getDegradedFallback(traceId, intent);
      }
      messageBus.registerOpinion(traceId, 'ExecutorAgent', draftAnswer);
    } else {
      const contextWithMods = { ...context, adaptiveRules: adaptiveModifiers, currentMode };
      draftAnswer = await executor.executeChat(traceId, userId, userMessage, contextWithMods, botServices, intent);
      messageBus.registerOpinion(traceId, 'ExecutorAgent', draftAnswer);
    }

    // --- Collaborative Reasoning Phase ---
    // Jika Mode Kolaboratif atau Riset aktif, panggil agen tambahan
    if (currentMode === 'Collaborative Thinking' || currentMode === 'Research Intelligence' || currentMode === 'Strategic Planning') {
      const researchData = research.gatherEvidence(traceId, userMessage, messageBus.getContext(traceId));
      messageBus.registerOpinion(traceId, 'ResearchAgent', `Bukti ditemukan (Confidence ${researchData.confidence}):\n${researchData.evidenceText}`);
      
      const reasoningData = reasoning.analyze(traceId, draftAnswer, researchData);
      messageBus.registerOpinion(traceId, 'ReasoningAgent', reasoningData.opinionText);
    }

    // 8. Consensus Building (Reflection Agent)
    const consensus = reflection.buildConsensus(traceId, messageBus.getContext(traceId));
    let finalDraft = reflection.reflectOnConsensus(traceId, consensus.finalDecision, intent);

    // 9. Cross Verification (Evaluator & Verifier)
    const evaluation = evaluator.evaluate(traceId, userMessage, finalDraft, executionResult);
    const verification = verifier.verify(traceId, intent, evaluation.finalAnswer, evaluation.qualityScore);

    // 10. Final Output Sanitization
    const sanitizedAnswer = safety.sanitizeOutput(traceId, verification.finalAnswer);

    // Kirim Jawaban Akhir
    if (!isToolRequest || (executionResult && !executionResult.ok) || verification.annotation) {
      await sendStreamingAnswer(chatId, sanitizedAnswer, { reply_to_message_id: msgObj.message_id });
    }

    pushChatHistory({ userId, chatId, role: 'user', text: userMessage, timestamp: Date.now() });
    pushChatHistory({ userId, chatId, role: 'assistant', text: sanitizedAnswer, timestamp: Date.now() });
    if (typeof saveConversationPair === 'function') await saveConversationPair(userId, userMessage, sanitizedAnswer);

    // 11. Learning Update & Memory Evolution (Asynchronous Background Task)
    setImmediate(() => {
      const newFacts = [userMessage, sanitizedAnswer].filter(t => t && t.length > 20);
      memory.evolveMemory(traceId, userId, botServices, newFacts);
    });

    observability.logEvent(traceId, 'Orchestrator', 'PIPELINE_COMPLETED', {
      durationMs: Date.now() - startTime,
      memoryRSS: observability.getSystemTelemetry().memoryUsageMB.rss,
      mode: currentMode,
      consensusReached: consensus.reached
    });

    // Cleanup Message Bus
    messageBus.cleanupContext(traceId);

    return { processed: true, answerText: sanitizedAnswer };

  } catch (err) {
    messageBus.cleanupContext(traceId);
    const gracefulFallback = await recovery.handlePipelineFailure(traceId, userId, err, botServices);
    await safeSendMessage(chatId, gracefulFallback, { reply_to_message_id: msgObj.message_id });
    return { processed: true, answerText: gracefulFallback };
  }
}

module.exports = {
  processMessage,
  executeDistributedPipeline
};
