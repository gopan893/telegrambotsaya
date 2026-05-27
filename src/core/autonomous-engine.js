'use strict';

/**
 * Phase 8: Governance Intelligence & Autonomous Control System
 * Mengoordinasikan text/multimodal reasoning dengan policy, risk, permission,
 * approval, audit, dan recovery layer yang ringan untuk production.
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
const selfImprovement = require('../agents/self-improvement');
const governance = require('../governance');
const aiOS = require('../ai-os');

const messageBus = require('./message-bus');
const agentCoordinator = require('./agent-coordinator');
const { getSelectiveContext, updateSessionState } = require('../memory/advanced-memory');
const { parseSemanticIntent } = require('../intent/semantic-parser');
const { globalTaskQueue } = require('./task-queue');

// Phase 7: Multimodal Pipeline
const fileHandler = require('../multimodal/file-handler');
const documentParser = require('../multimodal/document-parser');
const imageVision = require('../multimodal/image-vision');
const dataInterpreter = require('../multimodal/data-interpreter');
const crossModal = require('../multimodal/cross-modal-engine');

/**
 * Deteksi Mode AI (termasuk mode multimodal baru)
 */
function detectAIMode(userMessage, intent, hasAttachment, attachmentType) {
  const lower = (userMessage || '').toLowerCase();

  if (lower.includes('health watch') || lower.includes('pantau kesehatan sistem')) return 'Health Watch';
  if (lower.includes('benchmark') || lower.includes('uji regresi')) return 'Benchmark';
  if (lower.includes('incident response') || lower.includes('respons insiden')) return 'Incident Response';
  if (lower.includes('cost optimization') || lower.includes('optimasi biaya')) return 'Cost Optimization';
  if (lower.includes('continuous improvement') || lower.includes('perbaikan berkelanjutan')) return 'Continuous Improvement';

  if (lower.includes('strategic thinking') || lower.includes('strategi jangka panjang')) return 'Strategic Thinking';
  if (lower.includes('personal intelligence') || lower.includes('pola belajar saya')) return 'Personal Intelligence';
  if (lower.includes('deep research os') || lower.includes('riset os')) return 'Deep Research OS';
  if (lower.includes('cognitive workspace') || lower.includes('workspace berpikir')) return 'Cognitive Workspace';
  if (lower.includes('meta reasoning') || lower.includes('evaluasi strategi berpikir')) return 'Meta Reasoning';

  if (lower.includes('safe mode') || lower.includes('mode aman')) return 'Safe Mode';
  if (lower.includes('governance review') || lower.includes('review governance')) return 'Governance Review';
  if (lower.includes('controlled agent') || lower.includes('agen terkendali')) return 'Controlled Agent';
  if (lower.includes('explainability') || lower.includes('jelaskan keputusan')) return 'Explainability';
  if (lower.includes('recovery mode') || lower.includes('mode recovery')) return 'Recovery';

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

function getRuntimeStatus() {
  const queue = globalTaskQueue.getTelemetry();
  const health = observability.diagnoseHealth({ queue });
  const collaboration = agentCoordinator.getRuntimeSnapshot();

  return {
    status: health.status,
    generatedAt: health.timestamp,
    agents: [
      'PolicyEngine',
      'PermissionEngine',
      'RiskAssessmentEngine',
      'SafetyValidator',
      'AuditLogger',
      'ActionApprovalLayer',
      'RollbackController',
      'PlannerAgent',
      'ExecutorAgent',
      'EvaluatorAgent',
      'VerifierAgent',
      'MemoryAgent',
      'SafetyAgent',
      'RecoveryAgent',
      'ToolRouterAgent',
      'LearningAgent',
      'SelfImprovementAgent',
      'ObservabilityAgent'
    ],
    agentRegistry: agentCoordinator.getAgentRegistrySummary(),
    collaboration,
    queue,
    telemetry: health.telemetry,
    observability: {
      collaboration: health.collaboration
    },
    governance: governance.getGovernanceStatus(),
    aiOS: {
      modules: [
        'CognitiveCore',
        'ContextSync',
        'MemoryBus',
        'UnifiedMemory',
        'GoalManager',
        'WorkflowEngine',
        'KnowledgeGraph',
        'StrategicReasoning',
        'ReflectionEngine',
        'MetaReasoning',
        'PersonalIntelligence',
        'ResearchIntelligence',
        'CognitiveWorkspace',
        'LearningEvolution',
        'CognitiveAnalytics',
        'AiosGuards',
        'AIOperationsLayer'
      ]
    },
    issues: health.issues,
    recentErrorPatterns: health.recentErrorPatterns
  };
}

/**
 * Memproses pesan masuk melalui antrean (Task Queue)
 */
async function processMessage(userId, chatId, userMessage, msgObj, botServices) {
  const opsStart = Date.now();
  try {
    return await globalTaskQueue.enqueue(userId, userMessage, async () => {
      const result = await executeMultimodalPipeline(userId, chatId, userMessage, msgObj, botServices);
      try {
        botServices.opsSystem?.telemetry?.recordReasoningPath?.({
          name: 'autonomous_pipeline',
          scope: 'autonomous-engine',
          status: 'ok',
          latencyMs: Date.now() - opsStart,
          mode: result?.mode || 'auto',
          steps: ['intent', 'context', 'governance', 'execution', 'verification']
        }, botServices.opsServices || {});
      } catch (_) {}
      return result;
    });
  } catch (err) {
    try {
      botServices.opsSystem?.telemetry?.recordError?.(err, botServices.opsServices || {}, {
        scope: 'autonomous-engine',
        component: 'autonomous-pipeline',
        severity: 'warning'
      });
    } catch (_) {}
    const traceId = observability.createTraceId();
    observability.logEvent(traceId, 'Orchestrator', 'TASK_QUEUE_REJECTED', { userId, error: err.message });

    const { safeSendMessage } = botServices;
    let userWarning = 'Maaf, ekosistem agen sedang sibuk. Silakan tunggu sebentar.';
    if (err.message.includes('DUPLICATE_REQUEST_BLOCKED')) userWarning = '⚠️ Sistem masih memproses pesan Anda sebelumnya.';
    if (err.message.includes('QUEUE_OVERLOADED')) userWarning = '⚠️ Sistem sedang penuh. Coba ulang sebentar lagi.';
    if (err.message.includes('TASK_TIMEOUT')) userWarning = '⚠️ Tugas terlalu lama diproses, jadi saya hentikan agar bot tetap stabil.';

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
  const initialFileId = fileHandler.generateFileId(attachment.fileName, attachment.fileSize, attachment.fileId || '');
  const cached = memory.getCachedFile(userId, initialFileId, botServices);
  if (cached) {
    observability.logEvent(traceId, 'Orchestrator', 'FILE_CACHE_HIT', { fileId: initialFileId });
    return { success: true, context: cached, fromCache: true };
  }

  // 4. Download file dari Telegram (jika botServices menyediakan fungsi download)
  let fileBuffer = null;

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

  const integrity = fileBuffer
    ? fileHandler.inspectFileIntegrity(fileBuffer, contentType, attachment.fileName)
    : {
      ok: false,
      reason: 'NO_FILE_BUFFER',
      hash: attachment.fileId || null,
      size: attachment.fileSize || 0
    };
  const fileId = fileHandler.generateFileId(attachment.fileName, attachment.fileSize, integrity.hash || attachment.fileId || '');

  if (fileId !== initialFileId) {
    const cachedByHash = memory.getCachedFile(userId, fileId, botServices);
    if (cachedByHash) {
      observability.logEvent(traceId, 'Orchestrator', 'FILE_CACHE_HIT_BY_HASH', { fileId });
      return { success: true, context: cachedByHash, fromCache: true };
    }
  }

  if (fileBuffer && !integrity.ok && ['pdf', 'image'].includes(contentType)) {
    observability.logEvent(traceId, 'Orchestrator', 'FILE_INTEGRITY_FAILED', {
      fileName: attachment.fileName,
      reason: integrity.reason
    });
    return {
      success: false,
      context: null,
      errorMessage: `⚠️ File tidak lolos integrity check (${integrity.reason}). Coba kirim ulang file yang tidak rusak.`
    };
  }

  // 5. Parsing berdasarkan tipe konten (Lazy Loading)
  let fileContext = null;

  switch (contentType) {
    case 'image': {
      const analysis = await imageVision.analyzeImage(traceId, fileBuffer, userQuery, botServices);
      fileContext = imageVision.buildVisualContext(analysis, attachment.fileName);
      fileContext.integrity = integrity;
      fileContext.hash = integrity.hash;
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
      const analysis = documentParser.buildDocumentAnalysis(traceId, rawText, attachment.fileName, userQuery);
      fileContext = fileHandler.buildFileContext(traceId, 'pdf', rawText, attachment.fileName, {
        query: userQuery,
        integrity,
        hash: integrity.hash,
        keyPoints: analysis.keyPoints,
        facts: analysis.facts,
        inferences: analysis.inferences,
        confidence: analysis.confidence,
        evidenceScore: analysis.evidenceScore,
        limitations: analysis.limitations,
        warnings: analysis.warnings
      });
      // Simpan insight ke semantic memory
      memory.learnFromFile(traceId, userId, analysis.keyPoints, attachment.fileName, botServices);
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
      const analysis = documentParser.buildDocumentAnalysis(traceId, rawText, attachment.fileName, userQuery);
      fileContext = fileHandler.buildFileContext(traceId, 'document', rawText, attachment.fileName, {
        query: userQuery,
        integrity,
        hash: integrity.hash,
        keyPoints: analysis.keyPoints,
        facts: analysis.facts,
        inferences: analysis.inferences,
        confidence: analysis.confidence,
        evidenceScore: analysis.evidenceScore,
        limitations: analysis.limitations,
        warnings: analysis.warnings
      });
      memory.learnFromFile(traceId, userId, analysis.keyPoints, attachment.fileName, botServices);
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
      fileContext.integrity = integrity;
      fileContext.hash = integrity.hash;
      break;
    }

    case 'json': {
      const rawText = fileBuffer ? fileBuffer.toString('utf8') : '';
      const parsedData = dataInterpreter.parseJSON(rawText);
      const analysis = dataInterpreter.analyzeDataPatterns(traceId, parsedData);
      fileContext = dataInterpreter.buildDataContext(traceId, parsedData, analysis, attachment.fileName);
      fileContext.contentType = 'json';
      fileContext.semanticTags = [...new Set([...(fileContext.semanticTags || []), 'json', 'structured-data'])];
      fileContext.integrity = integrity;
      fileContext.hash = integrity.hash;
      if (parsedData.rawPreview) {
        fileContext.primaryContent += `\n\nRaw JSON preview:\n${parsedData.rawPreview}`;
      }
      break;
    }

    case 'audio': {
      let transcript = '';
      if (typeof botServices.transcribeAudio === 'function' && fileBuffer) {
        try {
          transcript = await botServices.transcribeAudio(fileBuffer, attachment);
        } catch (err) {
          observability.logEvent(traceId, 'Orchestrator', 'AUDIO_TRANSCRIPTION_FAILED', { error: err.message });
        }
      }
      const rawText = transcript || 'Audio diterima, tetapi transcription belum dikonfigurasi.';
      fileContext = fileHandler.buildFileContext(traceId, 'audio', rawText, attachment.fileName, {
        query: userQuery,
        integrity,
        hash: integrity.hash,
        confidence: transcript ? 0.7 : 0.25,
        evidenceScore: transcript ? 0.65 : 0.2,
        keyPoints: transcript ? [`Transkrip audio: ${transcript.slice(0, 240)}`] : [],
        limitations: transcript ? null : 'Audio transcription belum dikonfigurasi, jadi isi audio belum bisa dianalisis penuh.',
        warnings: transcript ? [] : ['Transcription tidak tersedia.']
      });
      break;
    }

    default: {
      return {
        success: false,
        context: null,
        errorMessage: `⚠️ Format file "${contentType}" belum didukung. Format yang didukung: gambar, PDF, dokumen teks, CSV, Excel, JSON, dan audio dengan transcriber.`
      };
    }
  }

  // 6. Cache hasil parsing
  if (fileContext) {
    fileContext.fileId = fileId;
    fileContext.integrity = fileContext.integrity || integrity;
    fileContext.hash = fileContext.hash || integrity.hash;
    memory.cacheFileResult(userId, fileId, fileContext, botServices);
    memory.indexFileContext(traceId, userId, fileId, fileContext, botServices);
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

    const approvedAction = governance.consumeApprovedAction(traceId, userId, userMessage, botServices);
    if (approvedAction.denied) {
      const deniedText = 'Baik, aksi sensitif dibatalkan dan tidak dijalankan.';
      messageBus.cleanupContext(traceId);
      await safeSendMessage(chatId, deniedText, { reply_to_message_id: msgObj.message_id });
      return { processed: true, answerText: deniedText };
    }
    if (approvedAction.expired) {
      const expiredText = 'Konfirmasi sebelumnya sudah kedaluwarsa. Kirim ulang instruksi jika masih ingin menjalankannya.';
      messageBus.cleanupContext(traceId);
      await safeSendMessage(chatId, expiredText, { reply_to_message_id: msgObj.message_id });
      return { processed: true, answerText: expiredText };
    }
    if (approvedAction.approved && approvedAction.originalUserMessage) {
      userMessage = approvedAction.originalUserMessage;
      messageBus.updateContext(traceId, 'approvedAction', {
        intent: approvedAction.intent,
        approvalId: approvedAction.approvalId
      });
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
    if (botServices.adaptiveDecision?.applied) {
      context.mode = botServices.adaptiveDecision.mode || context.mode;
      context.adaptiveDecision = botServices.adaptiveDecision;
      messageBus.updateContext(traceId, 'adaptiveMode', {
        mode: botServices.adaptiveDecision.mode,
        reason: botServices.adaptiveDecision.reason,
        confidence: botServices.adaptiveDecision.confidence
      });
    }
    if (botServices.conversationState) {
      context.conversationState = botServices.conversationState;
      messageBus.updateContext(traceId, 'conversationState', {
        action: botServices.conversationState.action,
        reason: botServices.conversationState.reason,
        hasPending: Boolean(botServices.conversationState.pending)
      });
    }

    let aiOSPacket = null;
    try {
      aiOSPacket = aiOS.processInput(traceId, {
        userId,
        userMessage,
        userMode: context.mode,
        hasAttachment
      }, botServices);
      if (aiOSPacket?.ok) {
        context.aiOSContext = aiOSPacket.promptContext;
        context.aiOSRules = aiOSPacket.promptRules;
        context.aiOSStrategy = aiOSPacket.strategy;
        messageBus.updateContext(traceId, 'aiOS', {
          mode: aiOSPacket.strategy?.mode,
          shouldUseAIOS: aiOSPacket.strategy?.shouldUseAIOS,
          stats: aiOSPacket.cognitiveContext?.stats || null
        });
      }
    } catch (err) {
      observability.recordErrorPattern('ai_os_prepare', err);
      observability.logEvent(traceId, 'CognitiveCore', 'AI_OS_PREPARE_FAILED', { error: err.message });
      context.aiOSRules = 'AI OS fallback: layer persistent cognition tidak tersedia, lanjutkan dengan pipeline lama.';
    }
    const recentFileContexts = hasAttachment
      ? [
        fileContext,
        ...memory.getRecentFileContexts(userId, botServices, 3)
          .filter(ctx => ctx && ctx.fileId !== fileContext?.fileId)
      ].filter(Boolean)
      : memory.getRecentFileContexts(userId, botServices, 3);
    const crossModalContext = crossModal.buildCrossModalContext(traceId, userMessage, context, recentFileContexts);
    context.crossModalContext = crossModalContext;
    messageBus.updateContext(traceId, 'sharedMemory', context.summary);
    if (crossModalContext.hasFiles) {
      messageBus.updateContext(traceId, 'multimodalEvidence', crossModalContext.mergedEvidence);
      messageBus.updateContext(traceId, 'sourceCitations', crossModalContext.sourceCitations);
      messageBus.recordMemoryAccess(traceId, 'MemoryAgent', 'attachment_memory', 'cross_modal_load', crossModalContext.evidenceScore);
    }
    messageBus.recordMemoryAccess(traceId, 'MemoryAgent', 'semantic+short_term', 'selective_load', context.summary ? 0.7 : 0.4);

    // 4. Adaptive Intelligence Modifiers
    const adaptiveModifiers = [
      botServices.adaptiveDecision?.promptHint,
      learning.generateAdaptivePromptModifiers(userId, botServices),
      selfImprovement.generatePromptHints(userId, botServices)
    ].filter(Boolean).join('\n');

    // 5. Intent Analysis. Untuk goal kompleks, langsung masuk planner agar tidak membuang 1 call AI parser.
    const complexGoalRequest = !approvedAction.approved && planner.isComplexGoalRequest(userMessage);
    const nlpResult = approvedAction.approved
      ? {
        intent: approvedAction.intent,
        confidence: 0.96,
        params: approvedAction.params || {},
        reason: 'Aksi sensitif sudah dikonfirmasi user melalui Governance Approval Layer.',
        governanceApproved: true
      }
      : complexGoalRequest
      ? {
        intent: 'NONE',
        confidence: 0.95,
        params: {},
        reason: 'Goal kompleks dideteksi oleh planner heuristic.'
      }
      : await parseSemanticIntent(userMessage, userId, botServices);
    const intent = nlpResult.intent || 'NONE';

    const attachmentType = hasAttachment ? fileHandler.classifyContentType(attachment.fileName, attachment.mimeType) : null;
    const detectedMode = detectAIMode(userMessage, intent, hasAttachment, attachmentType);
    const currentMode = agentCoordinator.detectCollaborationMode({
      userMessage,
      intent,
      currentMode: detectedMode,
      userMode: context.mode,
      hasAttachment,
      attachmentType
    });
    const delegationPlan = agentCoordinator.buildDelegationPlan(traceId, {
      userMessage,
      intent,
      currentMode,
      hasAttachment,
      attachmentType,
      nlpConfidence: nlpResult.confidence
    });
    messageBus.updateContext(traceId, 'workflow', delegationPlan);
    messageBus.recordAgentMessage(traceId, 'AgentCoordinator', 'ALL', 'DELEGATION_PLAN', {
      mode: currentMode,
      agents: delegationPlan.agents
    });
    observability.logEvent(traceId, 'Orchestrator', 'AI_MODE_DETECTED', { mode: currentMode, hasAttachment });

    const governanceDecision = governance.reviewDecision(traceId, {
      userId,
      userMessage,
      intent,
      params: nlpResult.params || {},
      nlpConfidence: nlpResult.confidence,
      context,
      hasAttachment,
      attachmentType,
      mode: currentMode,
      botServices,
      approved: !!nlpResult.governanceApproved
    });
    context.governance = governanceDecision;
    messageBus.updateContext(traceId, 'governance', {
      decision: governanceDecision.decision,
      riskLevel: governanceDecision.risk.riskLevel,
      riskScore: governanceDecision.risk.riskScore,
      policy: governanceDecision.policy.capability,
      violations: governanceDecision.violations
    });

    if (governanceDecision.decision === 'BLOCKED' || governanceDecision.decision === 'APPROVAL_REQUIRED') {
      messageBus.cleanupContext(traceId);
      await safeSendMessage(chatId, governanceDecision.userMessage, { reply_to_message_id: msgObj.message_id });
      return { processed: true, answerText: governanceDecision.userMessage };
    }

    // 6. Hierarchical Planning Check
    const session = context.rawSession;
    if (session?.activeTask && (userMessage.toLowerCase().includes('lanjut') || userMessage.toLowerCase().includes('batal'))) {
      const stepResponse = await planner.executeNextStep(traceId, userId, userMessage, session, botServices);
      await sendStreamingAnswer(chatId, stepResponse, { reply_to_message_id: msgObj.message_id });
      messageBus.cleanupContext(traceId);
      return { processed: true, answerText: stepResponse };
    }

    if (complexGoalRequest) {
      await safeSendMessage(chatId, `🧠 **[${currentMode}]** AI Planner Aktif...`);
      const newPlan = await planner.generatePlan(traceId, userMessage, userId, botServices);
      await updateSessionState(
        userId,
        {
          activeTask: newPlan.taskName,
          steps: newPlan.steps,
          currentStepIndex: 0,
          contextData: newPlan.initialData || {}
        },
        botServices
      );

      const planLines = newPlan.steps
        .map((step, index) => `${index + 1}. ${step}`)
        .join('\n');

      const planText = `
🧭 **Roadmap Baru Dibuat: ${newPlan.taskName}**

${newPlan.explanation || 'Saya menyusun rencana bertahap agar tujuan ini bisa dijalankan sebagai sesi percakapan.'}

${planLines}

Ketik **"lanjut"** untuk membuka langkah berikutnya, atau **"batal"** untuk menghentikan sesi.
      `.trim();

      await sendStreamingAnswer(chatId, planText, { reply_to_message_id: msgObj.message_id });
      messageBus.cleanupContext(traceId);
      return { processed: true, answerText: planText };
    }

    // 7. Action Gating
    if (!safety.gateAction(traceId, userId, intent, botServices)) {
      messageBus.cleanupContext(traceId);
      return { processed: true, answerText: '❌ Akses Ditolak.' };
    }

    // 8. Reasoning & Execution
    let draftAnswer = '';
    let executionResult = null;
    const isToolRequest = toolRouter.canRoute(traceId, intent, nlpResult.params) &&
      nlpResult.confidence >= 0.7 &&
      governanceDecision.executionAllowed;

    if (isToolRequest && !hasAttachment) {
      if (observability.isServiceAvailable(intent)) {
        const snapshot = governanceDecision.simulation?.wouldMutateState
          ? governance.createRecoverySnapshot(traceId, userId, `before_${intent}`, botServices)
          : null;
        executionResult = await executor.executeTool(traceId, intent, nlpResult.params, chatId, userId, msgObj, botServices);
        governance.logToolExecution(traceId, {
          userId,
          intent,
          params: nlpResult.params,
          riskLevel: governanceDecision.risk.riskLevel,
          success: !!executionResult.ok,
          error: executionResult.error
        });
        if (snapshot && !executionResult.ok) {
          governance.rollbackLastSnapshot(traceId, userId, botServices);
        }
        draftAnswer = executionResult.ok ? executionResult.resultText : recovery.getDegradedFallback(traceId, intent);
        memory.recordToolPerformance(userId, intent, executionResult.ok, botServices);
        messageBus.recordAgentMessage(traceId, 'ToolRouterAgent', 'ExecutorAgent', 'TOOL_EXECUTED', {
          intent,
          ok: executionResult.ok
        });
      } else {
        draftAnswer = recovery.getDegradedFallback(traceId, intent);
        messageBus.recordAgentMessage(traceId, 'RecoveryAgent', 'ExecutorAgent', 'TOOL_DEGRADED', { intent });
      }
    } else {
      // Sisipkan konteks file ke dalam prompt jika ada attachment
      const contextWithMods = {
        ...context,
        adaptiveRules: [adaptiveModifiers, governanceDecision.promptConstraint, context.aiOSRules].filter(Boolean).join('\n'),
        currentMode,
        conversationContext: botServices.conversationState?.promptContext || '',
        conversationInstruction: botServices.conversationState?.instruction || ''
      };
      if (fileContext) {
        contextWithMods.fileContent = fileContext.primaryContent;
        contextWithMods.fileName = fileContext.fileName;
        contextWithMods.fileContentType = fileContext.contentType;
        contextWithMods.fileConfidence = crossModalContext.confidence;
        contextWithMods.fileSourceCitations = (crossModalContext.sourceAttribution || []).join('\n');
        contextWithMods.fileGrounding = crossModalContext.mergedEvidence;
        contextWithMods.multimodalLimitations = (crossModalContext.limitations || []).join('\n');
        if (fileContext.keyPoints) {
          contextWithMods.fileKeyPoints = fileContext.keyPoints.join('\n');
        }
        if (fileContext.limitations) {
          contextWithMods.fileLimitations = fileContext.limitations;
        }
      }
      draftAnswer = await executor.executeChat(traceId, userId, userMessage, contextWithMods, botServices, intent);
    }
    messageBus.registerOpinion(traceId, 'ExecutorAgent', draftAnswer, {
      role: 'executor',
      confidence: 0.65,
      score: agentCoordinator.scoreAgentOutput('ExecutorAgent', { text: draftAnswer, confidence: 0.65 }),
      tags: ['draft']
    });

    // 9. Collaborative Reasoning Phase (untuk mode kompleks)
    if (agentCoordinator.shouldUseCollaborativeReasoning(delegationPlan, { isToolRequest, hasAttachment })) {
      const memoryPerspective = agentCoordinator.buildMemoryPerspective(context);
      messageBus.registerOpinion(traceId, 'MemoryAgent', memoryPerspective.text, {
        role: 'memory',
        confidence: memoryPerspective.confidence,
        score: agentCoordinator.scoreAgentOutput('MemoryAgent', {
          text: memoryPerspective.text,
          confidence: memoryPerspective.confidence
        }),
        tags: ['shared_memory']
      });

      const researchData = research.gatherEvidence(traceId, userMessage, messageBus.getContext(traceId));
      messageBus.registerOpinion(traceId, 'ResearchAgent', `Bukti (Confidence ${researchData.confidence}):\n${researchData.evidenceText}`, {
        role: 'research',
        confidence: researchData.confidence,
        score: agentCoordinator.scoreAgentOutput('ResearchAgent', researchData),
        tags: ['evidence']
      });

      const reasoningData = reasoning.analyze(traceId, draftAnswer, researchData);
      messageBus.registerOpinion(traceId, 'ReasoningAgent', reasoningData.opinionText, {
        role: 'reasoning',
        confidence: reasoningData.confidence,
        score: agentCoordinator.scoreAgentOutput('ReasoningAgent', reasoningData),
        tags: ['critical_thinking']
      });
    }

    // 10. Consensus & Reflection
    const consensus = reflection.buildConsensus(traceId, messageBus.getContext(traceId));
    let finalDraft = reflection.reflectOnConsensus(traceId, consensus.finalDecision, intent);

    // 11. Evaluation & Verification
    const evaluation = evaluator.evaluate(traceId, userMessage, finalDraft, executionResult);
    const verification = verifier.verify(traceId, intent, evaluation.finalAnswer, evaluation.qualityScore);

    // 12. Output Sanitization
    const groundedAnswer = crossModal.applyGroundingGuard(traceId, verification.finalAnswer, context.crossModalContext);
    if (groundedAnswer.annotation && !verification.annotation) verification.annotation = groundedAnswer.annotation;
    const sanitizedAnswer = safety.sanitizeOutput(traceId, groundedAnswer.answer);
    const workflowReport = agentCoordinator.finalizeWorkflow(
      traceId,
      delegationPlan,
      messageBus.getContext(traceId),
      consensus,
      verification,
      Date.now() - startTime
    );
    messageBus.updateContext(traceId, 'workflowReport', workflowReport);

    // Kirim jawaban
    if (!isToolRequest || (executionResult && !executionResult.ok) || verification.annotation || hasAttachment) {
      await sendStreamingAnswer(chatId, sanitizedAnswer, { reply_to_message_id: msgObj.message_id });
    }

    pushChatHistory({ userId, chatId, role: 'user', text: userMessage, timestamp: Date.now() });
    pushChatHistory({ userId, chatId, role: 'assistant', text: sanitizedAnswer, timestamp: Date.now() });
    if (typeof saveConversationPair === 'function') await saveConversationPair(userId, userMessage, sanitizedAnswer);

    // 13. Learning Update, Self-Improvement & Memory Evolution
    setImmediate(() => {
      (async () => {
        const newFacts = [userMessage, sanitizedAnswer].filter(t => t && t.length > 20);
        memory.evolveMemory(traceId, userId, botServices, newFacts);
        await selfImprovement.recordInteraction(traceId, userId, {
          query: userMessage,
          answer: sanitizedAnswer,
          intent,
          evaluation,
          verification,
          executionResult,
          context,
          latencyMs: Date.now() - startTime
        }, botServices);
        agentCoordinator.persistCollaborativeMemory(traceId, userId, workflowReport, botServices);
        aiOS.afterResponse(traceId, {
          userId,
          userMessage,
          userMode: context.mode,
          mode: currentMode,
          strategy: aiOSPacket?.strategy
        }, sanitizedAnswer, botServices);
      })().catch((err) => {
        observability.recordErrorPattern('self_improvement', err);
        observability.logEvent(traceId, 'SelfImprovementAgent', 'LEARNING_UPDATE_FAILED', { error: err.message });
      });
    });

    observability.logEvent(traceId, 'Orchestrator', 'PIPELINE_COMPLETED', {
      durationMs: Date.now() - startTime,
      memoryRSS: observability.getSystemTelemetry().memoryUsageMB.rss,
      mode: currentMode,
      hadAttachment: hasAttachment,
      consensusReached: consensus.reached,
      consensusConfidence: workflowReport.consensusConfidence,
      agentCount: workflowReport.agents.length
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
  executeMultimodalPipeline,
  getRuntimeStatus
};
