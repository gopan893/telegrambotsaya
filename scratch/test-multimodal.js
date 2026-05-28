/**
 * Local Test Suite: Phase 7 Multimodal Intelligence System
 *
 * Cara menjalankan:
 * node scratch/test-multimodal.js
 */

'use strict';

const assert = require('assert');
const fileHandler = require('../src/multimodal/file-handler');
const documentParser = require('../src/multimodal/document-parser');
const dataInterpreter = require('../src/multimodal/data-interpreter');
const crossModal = require('../src/multimodal/cross-modal-engine');
const autonomousEngine = require('../src/core/autonomous-engine');

const mockDb = {};
const shortMemory = [];

const sampleText = [
  'Tujuan dokumen ini adalah membantu belajar backend secara bertahap.',
  'Risiko utama adalah implementasi terlalu besar tanpa testing.',
  'Rekomendasi penting: gunakan modularisasi, logging, dan cache terbatas.',
  'Hasil yang diharapkan adalah sistem lebih stabil dan mudah dikembangkan.'
].join('\n');

const mockServices = {
  ensureUser: (userId) => {
    if (!mockDb[userId]) {
      mockDb[userId] = {
        botName: 'Bot Multimodal',
        mode: 'document-analysis',
        mood: 'fokus',
        todos: [],
        reminders: [],
        summary: '- User sedang mengembangkan bot Telegram AI',
        tags: ['backend', 'ai'],
        nlpPatterns: []
      };
    }
    return mockDb[userId];
  },
  persist: async () => true,
  askAI: async () => JSON.stringify({ intent: 'NONE', confidence: 1, params: {} }),
  getSmartAnswer: async (prompt) => {
    assert.ok(prompt.includes('Evidence Terpilih'), 'Prompt tidak membawa evidence file.');
    assert.ok(prompt.includes('Source / Citation'), 'Prompt tidak membawa citation file.');
    return 'Dokumen ini membahas belajar backend, risiko implementasi besar, dan rekomendasi modularisasi.';
  },
  safeSendMessage: async () => true,
  sendStreamingAnswer: async () => true,
  pushChatHistory: (entry) => {
    shortMemory.push(entry);
  },
  saveConversationPair: async () => true,
  autoSummarizeMemory: async () => true,
  getSystemPrompt: () => 'Gunakan jawaban berbasis bukti.',
  downloadFile: async () => Buffer.from(sampleText, 'utf8'),
  shortMemory
};

async function runTests() {
  console.log('Memulai test Phase 7 Multimodal Intelligence...');

  const traceId = 'test-multimodal-trace';

  const type = fileHandler.classifyContentType('catatan.txt', 'text/plain');
  assert.strictEqual(type, 'document');

  const integrity = fileHandler.inspectFileIntegrity(Buffer.from(sampleText), 'document', 'catatan.txt');
  assert.strictEqual(integrity.ok, true);
  assert.ok(integrity.hash);

  const docAnalysis = documentParser.buildDocumentAnalysis(traceId, sampleText, 'catatan.txt', 'risiko backend');
  assert.ok(docAnalysis.keyPoints.length > 0);
  assert.ok(docAnalysis.facts.length > 0 || docAnalysis.inferences.length > 0);
  assert.ok(docAnalysis.confidence > 0.4);

  const fileContext = fileHandler.buildFileContext(traceId, 'document', sampleText, 'catatan.txt', {
    query: 'risiko backend',
    integrity,
    hash: integrity.hash,
    ...docAnalysis
  });
  assert.ok(fileContext.sourceCitations[0].id.startsWith('file:'));
  assert.ok(fileContext.semanticTags.includes('document'));
  assert.ok(fileContext.compressedContext.length > 0);

  const csv = 'nama,skor,status\nAna,90,lulus\nBudi,70,lulus\nCici,,review';
  const parsedCsv = dataInterpreter.parseCSV(csv);
  const dataAnalysis = dataInterpreter.analyzeDataPatterns(traceId, parsedCsv);
  const dataContext = dataInterpreter.buildDataContext(traceId, parsedCsv, dataAnalysis, 'nilai.csv');
  assert.ok(dataContext.keyPoints.some(point => point.includes('baris')));
  assert.ok(dataContext.sourceCitations.length > 0);

  const crossContext = crossModal.buildCrossModalContext(
    traceId,
    'apa risiko paling penting?',
    { summary: 'User belajar backend.' },
    [fileContext, dataContext]
  );
  assert.strictEqual(crossContext.hasFiles, true);
  assert.ok(crossContext.mergedEvidence.includes('catatan.txt'));
  assert.ok(crossContext.sourceCitations.length > 0);

  const guarded = crossModal.applyGroundingGuard(
    traceId,
    'Dokumen ini membahas risiko implementasi dan modularisasi.',
    crossContext
  );
  assert.ok(guarded.answer.includes('Sumber file'), 'Grounding guard tidak menambah source attribution.');

  const result = await autonomousEngine.processMessage(
    'phase7_user',
    'phase7_chat',
    'Ringkas file ini dan jelaskan risiko terpenting.',
    {
      message_id: 7,
      document: {
        file_id: 'mock-file-id',
        file_name: 'catatan.txt',
        mime_type: 'text/plain',
        file_size: Buffer.byteLength(sampleText)
      }
    },
    mockServices
  );

  assert.strictEqual(result.processed, true);
  assert.ok(/backend|risiko|Sumber file/i.test(result.answerText), 'Jawaban multimodal tidak relevan atau tidak grounded.');
  assert.ok(mockDb.phase7_user.fileIndex.length > 0, 'File context tidak masuk file index.');

  console.log('Semua test Phase 7 Multimodal Intelligence berhasil.');
}

runTests().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
