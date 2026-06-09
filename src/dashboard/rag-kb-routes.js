'use strict';

const ragKb = require('../rag-kb');

function registerRagKbRoutes(router, services = {}) {
  router.get('/rag-kb', async (req, res) => {
    try {
      res.json({ ok: true, status: 'RAG/Knowledge Base routes active', endpoints: ['documents', 'search', 'hybrid', 'analyze', 'stats', 'reindex', 'feedback'] });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/rag-kb/documents', async (req, res) => {
    try {
      const documents = ragKb.ragDocumentStore.listDocuments(req.query);
      res.json({ ok: true, documents, count: documents.length, total: ragKb.ragDocumentStore.getDocumentCount() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/rag-kb/documents', async (req, res) => {
    try {
      const doc = ragKb.ragDocumentStore.addDocument(req.body);
      if (req.body?.chunk !== false) {
        const chunks = ragKb.ragDocumentChunker.smartChunk(doc.content, req.body?.chunkStrategy, req.body?.maxChunkSize);
        ragKb.ragVectorIndex.indexDocument(doc.id, doc.content);
      }
      res.json({ ok: true, document: doc });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/rag-kb/documents/:id', async (req, res) => {
    try {
      const doc = ragKb.ragDocumentStore.getDocument(req.params.id);
      if (!doc) return res.status(404).json({ ok: false, error: 'Document not found' });
      res.json({ ok: true, document: doc });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/rag-kb/documents/:id', async (req, res) => {
    try {
      ragKb.ragDocumentStore.removeDocument(req.params.id);
      ragKb.ragVectorIndex.removeVector(req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/rag-kb/search', async (req, res) => {
    try {
      const query = req.body?.query || '';
      const mode = req.body?.mode || 'vector';
      let results;
      if (mode === 'hybrid') {
        const documents = ragKb.ragDocumentStore.listDocuments();
        results = await ragKb.ragHybridSearcher.hybridSearch(query, { documents, topK: req.body?.topK || 10, vectorWeight: req.body?.vectorWeight, keywordWeight: req.body?.keywordWeight });
      } else {
        results = await ragKb.ragVectorIndex.search(query, { topK: req.body?.topK || 10 });
      }
      if (req.body?.filters) results = ragKb.ragFilterEngine.applyFilters(results, req.body.filters);
      const ranked = ragKb.ragSourceRanker.rankSources(results, req.body?.ranking || {});
      const context = ragKb.ragContextBuilder.buildContext(ranked, { maxTokens: req.body?.maxTokens || 2000 });
      const analysis = ragKb.ragQueryAnalyzer.analyzeQuery(query);
      res.json({ ok: true, query, mode, results: ranked, context, analysis });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/rag-kb/analyze', async (req, res) => {
    try {
      const query = req.body?.query || '';
      const analysis = ragKb.ragQueryAnalyzer.analyzeQuery(query);
      const phrases = ragKb.ragQueryAnalyzer.extractKeyPhrases(query);
      res.json({ ok: true, analysis, keyPhrases: phrases });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/rag-kb/stats', async (req, res) => {
    try {
      res.json({ ok: true, documentCount: ragKb.ragDocumentStore.getDocumentCount(), vectorCount: ragKb.ragVectorIndex.getVectorCount(), cacheStats: ragKb.ragCachingLayer.getStats(), feedbackStats: ragKb.ragFeedbackLoop.getFeedbackStats() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/rag-kb/reindex', async (req, res) => {
    try {
      ragKb.ragVectorIndex.resetIndex();
      const docs = ragKb.ragDocumentStore.listDocuments();
      for (const doc of docs) {
        await ragKb.ragVectorIndex.indexDocument(doc.id, doc.content);
      }
      res.json({ ok: true, reindexed: docs.length });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/rag-kb/feedback', async (req, res) => {
    try {
      const entry = ragKb.ragFeedbackLoop.recordFeedback(req.body?.query, req.body?.docId, req.body?.relevant, req.body?.metadata);
      res.json({ ok: true, feedback: entry });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerRagKbRoutes };
