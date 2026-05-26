'use strict';

/**
 * Phase 7: Multimodal Intelligence System & Cross-Modal Reasoning Engine
 * Mengoordinasikan teks, gambar, dokumen, dan data tabular melalui
 * Distributed Reasoning Pipeline dengan ekosistem multi-agen kolaboratif.
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

// Phase 7: Multimodal Pipeline
const fileHandler = require('../multimodal/file-handler');
const documentParser = require('../multimodal/document-parser');
const imageVision = require('../multimodal/image-vision');
const dataInterpreter = require('../multimodal/data-interpreter');

/**
 * Deteksi Mode AI (termasuk mode multimodal baru)
 */
function detectAIMode(userMessage, intent, hasAttachment, attachmentType) {
  const lower = (userMessage || '').toLowerCase();

  // Mode Multimodal (Phase 7)
  if (hasAttachment) {
    if (attachmentType === 'image') return 'Visual Analysis';
    if (attachmentType === 'pdf' || attachmentType === 'document') return 'Document Analysis';
    if (attachmentType === 'spreadsheet' || attachmentType === 'json') return 'Data Understanding';
    return 'Cross-Modal Reasoning';
  }

  // Mode yang ada dari Phase 6
  if (lower.includes('kolaborasi') || lower.includes('diskusikan')) return 'Collaborative Thinking';
  if (lower.includes('analisis mendalam') || lower.includes('pikirkan dalam')) return 'Deep Analysis';
  if (lower.includes('riset') || lower.includes('validasi fakta')) return 'Research Intelligence';
  if (lower.includes('strategi') || lower.includes('planning kompleks')) return 'Strategic Planning';
  return 'Standard';
}

/**
 * Memproses pesan masuk melalui antrean (Task Queue)
 */
async function processMessage(userId, chatId, userMessage, msgObj, botServices) {
  try {
    return await globalTaskQueue.enqueue(userId, userMessage, async () => {
      return await executeMultimodalPipeline(userId, chatId, userMessage, msgObj, botServices);
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
 * Mengekstrak informasi attachment dari pesan Telegram
 */
function extractAttachmentInfo(msgObj) {
  if (!msgObj) return null;

  // Telegram menyimpan foto di msgObj.photo (array), dokumen di msgObj.document
  if (msgObj.photo && msgObj.photo.length > 0) {
    const largest = msgObj.photo[msgObj.photo.length - 1]; // Ambil resolusi tertinggi
    return {
      type: 'telegram_photo',
      fileId: largest.file_id,
      fileSize: largest.file_size || 0,
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg'
    };
  }

  if (msgObj.document) {
    return {
      type: 'telegram_document',
      fileId: msgObj.document.file_id,
      fileSize: msgObj.document.file_size || 0,
      fileName: msgObj.document.file_name || 'document',
      mimeType: msgObj.document.mime_type || ''
    };
  }

  if (msgObj.voice) {
    return {
      type: 'telegram_voice',
      fileId: msgObj.voice.file_id,
      fileSize: msgObj.voice.file_size || 0,
      fileName: 'voice.ogg',
      mimeType: msgObj.voice.mime_type || 'audio/ogg'
    };
  }

  return null;
}

/**
 * Memproses attachment melalui multimodal pipeline
 */
async function processAttachment(traceId, userId, attachment, userQuery, botServices) {
  const { safeSendMessage } = botServices;

  // 1. Content Type Detection
  const contentType = fileHandler.classifyContentType(attachment.fileName, attachment.mimeType);
  observability.logEvent(traceId, 'Orchestrator', 'ATTACHMENT_CLASSIFIED', { contentType, fileName: attachment.fileName });

  // 2. Safety Check (Ukuran file)
  const sizeCheck = fileHandler.validateFileSafety(attachment.fileSize, contentType);
  if (!sizeCheck.safe) {
    return {
      success: false,
      context: null,
      errorMessage: `⚠️ File tidak dapat diproses: ${sizeCheck.reason}. Silakan kirim file yang lebih kecil atau dalam format yang didukung.`
    };
  }

  // 3. Cek cache (deduplication: jangan parse ulang file yang sama)
  const fileId = fileHandler.generateFileId(attachment.fileName, attachment.fileSize);
  const cached = memory.getCachedFile(userId, fileId, botServices);
  if (cached) {
    observability.logEvent(traceId, 'Orchestrator', 'FILE_CACHE_HIT', { fileId });
    return { success: true, context: cached, fromCache: true };
  }

  // 4. Download file dari Telegram (jika botServices menyediakan fungsi download)
  let fileBuffer = null;
  let fileText = '';

  if (botServices.downloadFile && typeof botServices.downloadFile === 'function') {
    try {
      fileBuffer = await botServices.downloadFile(attachment.fileId);
    } catch (err) {
      observability.logEvent(traceId, 'Orchestrator', 'FILE_DOWNLOAD_FAILED', { error: err.message });
      return {
        success: false,
        context: null,
        errorMessage: '⚠️ Gagal mengunduh file dari server Telegram. Coba kirim ulang.'
      };
    }
  }

  // 5. Parsing berdasarkan tipe konten (Lazy Loading)
  let fileContext = null;

  switch (contentType) {
    case 'image': {
      const analysis = await imageVision.analyzeImage(traceId, fileBuffer, userQuery, botServices);
      fileContext = imageVision.buildVisualContext(analysis, attachment.fileName);
      break;
    }

    case 'pdf': {
      const rawText = fileBuffer ? await documentParser.parsePDF(fileBuffer) : '[Tidak ada data file]';
      // Safety check pada isi file
      const fileSafety = safety.validateFileContent(traceId, rawText);
      if (!fileSafety.safe) {
        return {
          success: false,
          context: null,
          errorMessage: `🛡️ File ditolak: Konten berbahaya terdeteksi di dalam dokumen (${fileSafety.threats.join(', ')}).`
        };
      }
      const summary = documentParser.summarizeDocument(traceId, rawText, attachment.fileName);
      fileContext = fileHandler.buildFileContext(traceId, 'pdf', rawText, attachment.fileName);
      fileContext.keyPoints = summary.keyPoints;
      // Simpan insight ke semantic memory
      memory.learnFromFile(traceId, userId, summary.keyPoints, attachment.fileName, botServices);
      break;
    }

    case 'document': {
      const rawText = fileBuffer ? documentParser.parsePlainDocument(fileBuffer) : '[Tidak ada data file]';
      const fileSafety = safety.validateFileContent(traceId, rawText);
      if (!fileSafety.safe) {
        return {
          success: false,
          context: null,
          errorMessage: `🛡️ File ditolak: Konten berbahaya terdeteksi (${fileSafety.threats.join(', ')}).`
        };
      }
      const summary = documentParser.summarizeDocument(traceId, rawText, attachment.fileName);
      fileContext = fileHandler.buildFileContext(traceId, 'document', rawText, attachment.fileName);
      fileContext.keyPoints = summary.keyPoints;
      memory.learnFromFile(traceId, userId, summary.keyPoints, attachment.fileName, botServices);
      break;
    }

    case 'spreadsheet': {
      let parsedData;
      const ext = (attachment.fileName || '').toLowerCase();
      if (ext.endsWith('.csv') || ext.endsWith('.tsv')) {
        const rawText = fileBuffer ? fileBuffer.toString('utf8') : '';
        parsedData = dataInterpreter.parseCSV(rawText, ext.endsWith('.tsv') ? '\t' : ',');
      } else {
        parsedData = fileBuffer ? dataInterpreter.parseExcel(fileBuffer) : { headers: [], rows: [], rowCount: 0 };
      }
      const analysis = dataInterpreter.analyzeDataPatterns(traceId, parsedData);
      fileContext = dataInterpreter.buildDataContext(traceId, parsedData, analysis, attachment.fileName);
      break;
    }

    case 'json': {
      const rawText = fileBuffer ? fileBuffer.toString('utf8') : '';
      const parsedData = dataInterpreter.parseJSON(rawText);
      const analysis = dataInterpreter.analyzeDataPatterns(traceId, parsedData);
      fileContext = dataInterpreter.buildDataContext(traceId, parsedData, analysis, attachment.fileName);
      break;
    }

    default: {
      return {
        success: false,
        context: null,
        errorMessage: `⚠️ Format file "${contentType}" belum didukung. Format yang didukung: gambar, PDF, dokumen teks, CSV, Excel, JSON.`
      };
    }
  }

  // 6. Cache hasil parsing
  if (fileContext) {
    memory.cacheFileResult(userId, fileId, fileContext, botServices);
  }

  return { success: true, context: fileContext, fromCache: false };
}

/**
 * Pipa Utama Multimodal (Multimodal Distributed Pipeline)
 */
async function executeMultimodalPipeline(userId, chatId, userMessage, msgObj, botServices) {
  const traceId = observability.createTraceId();
  const startTime = Date.now();

  const { safeSendMessage, sendStreamingAnswer, pushChatHistory, ensureUser, saveConversationPair } = botServices;
  const u = ensureUser(userId);

  observability.logEvent(traceId, 'Orchestrator', 'PIPELINE_INITIATED', { userId });
  messageBus.initContext(traceId, { query: userMessage });

  try {
    // 1. Safety Check (teks)
    if (!safety.validateInput(traceId, userMessage)) {
      messageBus.cleanupContext(traceId);
      await safeSendMessage(chatId, '⚠️ Masukan ditolak karena melanggar kebijakan keamanan.', { reply_to_message_id: msgObj.message_id });
      return { processed: true, answerText: '⚠️ Input ditolak.' };
    }

    // 2. Multimodal Attachment Detection & Processing
    const attachment = extractAttachmentInfo(msgObj);
    const hasAttachment = !!attachment;
    let fileContext = null;

    if (hasAttachment) {
      const contentType = fileHandler.classifyContentType(attachment.fileName, attachment.mimeType);
      await safeSendMessage(chatId, `📎 Memproses file (${contentType})... Mohon tunggu.`);

      const result = await processAttachment(traceId, userId, attachment, userMessage, botServices);
      if (!result.success) {
        await safeSendMessage(chatId, result.errorMessage, { reply_to_message_id: msgObj.message_id });
        messageBus.cleanupContext(traceId);
        return { processed: true, answerText: result.errorMessage };
      }
      fileContext = result.context;
      messageBus.updateContext(traceId, 'fileContext', fileContext);
    }

    // 3. Context Analysis & Memory Architecture
    const rawContext = getSelectiveContext(userId, botServices);
    const semanticFacts = u.semanticMemory || [];
    u.summary = memory.pruneMemory(traceId, u.summary);

    const context = {
      ...rawContext,
      summary: memory.rankRelevance(traceId, userMessage, u.summary, semanticFacts),
      history: memory.compressContext(traceId, botServices.shortMemory || []),
      fileContext // Cross-modal: gabungkan konteks file dengan konteks teks
    };
    messageBus.updateContext(traceId, 'sharedMemory', context.summary);

    // 4. Adaptive Intelligence Modifiers
    const adaptiveModifiers = learning.generateAdaptivePromptModifiers(userId, botServices);

    // 5. Intent Analysis
    const nlpResult = await parseSemanticIntent(userMessage, userId, botServices);
    const intent = nlpResult.intent || 'NONE';

    const attachmentType = hasAttachment ? fileHandler.classifyContentType(attachment.fileName, attachment.mimeType) : null;
    const currentMode = detectAIMode(userMessage, intent, hasAttachment, attachmentType);
    observability.logEvent(traceId, 'Orchestrator', 'AI_MODE_DETECTED', { mode: currentMode, hasAttachment });

    // 6. Hierarchical Planning Check
    const session = context.rawSession;
    if (session?.activeTask && (userMessage.toLowerCase().includes('lanjut') || userMessage.toLowerCase().includes('batal'))) {
      const stepResponse = await planner.executeNextStep(traceId, userId, userMessage, session, botServices);
      await sendStreamingAnswer(chatId, stepResponse, { reply_to_message_id: msgObj.message_id });
      messageBus.cleanupContext(traceId);
      return { processed: true, answerText: stepResponse };
    }

    if (planner.isComplexGoalRequest(userMessage)) {
      await safeSendMessage(chatId, `🧠 **[${currentMode}]** AI Planner Aktif...`);
      const newPlan = await planner.generatePlan(traceId, userMessage, userId, botServices);
      messageBus.cleanupContext(traceId);
      return { processed: true, answerText: `Rencana Dibuat: ${newPlan.taskName}` };
    }

    // 7. Action Gating
    if (!safety.gateAction(traceId, userId, intent, botServices)) {
      messageBus.cleanupContext(traceId);
      return { processed: true, answerText: '❌ Akses Ditolak.' };
    }

    // 8. Reasoning & Execution
    let draftAnswer = '';
    let executionResult = null;
    const isToolRequest = toolRouter.canRoute(traceId, intent, nlpResult.params) && nlpResult.confidence >= 0.7;

    if (isToolRequest && !hasAttachment) {
      if (observability.isServiceAvailable(intent)) {
        executionResult = await executor.executeTool(traceId, intent, nlpResult.params, chatId, userId, msgObj, botServices);
        draftAnswer = executionResult.ok ? executionResult.resultText : recovery.getDegradedFallback(traceId, intent);
        memory.recordToolPerformance(userId, intent, executionResult.ok, botServices);
      } else {
        draftAnswer = recovery.getDegradedFallback(traceId, intent);
      }
    } else {
      // Sisipkan konteks file ke dalam prompt jika ada attachment
      const contextWithMods = { ...context, adaptiveRules: adaptiveModifiers, currentMode };
      if (fileContext) {
        contextWithMods.fileContent = fileContext.primaryContent;
        contextWithMods.fileName = fileContext.fileName;
        contextWithMods.fileContentType = fileContext.contentType;
        if (fileContext.keyPoints) {
          contextWithMods.fileKeyPoints = fileContext.keyPoints.join('\n');
        }
        if (fileContext.limitations) {
          contextWithMods.fileLimitations = fileContext.limitations;
        }
      }
      draftAnswer = await executor.executeChat(traceId, userId, userMessage, contextWithMods, botServices, intent);
    }
    messageBus.registerOpinion(traceId, 'ExecutorAgent', draftAnswer);

    // 9. Collaborative Reasoning Phase (untuk mode kompleks)
    if (['Collaborative Thinking', 'Research Intelligence', 'Strategic Planning', 'Cross-Modal Reasoning'].includes(currentMode)) {
      const researchData = research.gatherEvidence(traceId, userMessage, messageBus.getContext(traceId));
      messageBus.registerOpinion(traceId, 'ResearchAgent', `Bukti (Confidence ${researchData.confidence}):\n${researchData.evidenceText}`);

      const reasoningData = reasoning.analyze(traceId, draftAnswer, researchData);
      messageBus.registerOpinion(traceId, 'ReasoningAgent', reasoningData.opinionText);
    }

    // 10. Consensus & Reflection
    const consensus = reflection.buildConsensus(traceId, messageBus.getContext(traceId));
    let finalDraft = reflection.reflectOnConsensus(traceId, consensus.finalDecision, intent);

    // 11. Evaluation & Verification
    const evaluation = evaluator.evaluate(traceId, userMessage, finalDraft, executionResult);
    const verification = verifier.verify(traceId, intent, evaluation.finalAnswer, evaluation.qualityScore);

    // 12. Output Sanitization
    const sanitizedAnswer = safety.sanitizeOutput(traceId, verification.finalAnswer);

    // Kirim jawaban
    if (!isToolRequest || (executionResult && !executionResult.ok) || verification.annotation || hasAttachment) {
      await sendStreamingAnswer(chatId, sanitizedAnswer, { reply_to_message_id: msgObj.message_id });
    }

    pushChatHistory({ userId, chatId, role: 'user', text: userMessage, timestamp: Date.now() });
    pushChatHistory({ userId, chatId, role: 'assistant', text: sanitizedAnswer, timestamp: Date.now() });
    if (typeof saveConversationPair === 'function') await saveConversationPair(userId, userMessage, sanitizedAnswer);

    // 13. Learning Update & Memory Evolution
    setImmediate(() => {
      const newFacts = [userMessage, sanitizedAnswer].filter(t => t && t.length > 20);
      memory.evolveMemory(traceId, userId, botServices, newFacts);
    });

    observability.logEvent(traceId, 'Orchestrator', 'PIPELINE_COMPLETED', {
      durationMs: Date.now() - startTime,
      memoryRSS: observability.getSystemTelemetry().memoryUsageMB.rss,
      mode: currentMode,
      hadAttachment: hasAttachment,
      consensusReached: consensus.reached
    });

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
  executeMultimodalPipeline
};
