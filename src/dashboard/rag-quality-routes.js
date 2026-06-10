'use strict';

const utils = require('../rag-quality/rag-quality-utils');
const store = require('../rag-quality/rag-quality-store');
const sourceConf = require('../rag-quality/source-confidence-scorer');
const freshness = require('../rag-quality/source-freshness-scorer');
const retrievalEval = require('../rag-quality/retrieval-quality-evaluator');
const contextComp = require('../rag-quality/context-compression-engine');
const answerCheck = require('../rag-quality/rag-answer-quality-checker');
const hallucGuard = require('../rag-quality/hallucination-guard');
const citationLabel = require('../rag-quality/citation-labeler');
const reportGen = require('../rag-quality/rag-quality-report-generator');
const memStore = require('../memory-intelligence/memory-intelligence-store');
const memDedup = require('../memory-intelligence/memory-duplicate-detector');
const memFresh = require('../memory-intelligence/memory-freshness-reviewer');
const memMerge = require('../memory-intelligence/memory-merge-planner');
const memConflict = require('../memory-intelligence/memory-conflict-detector');
const memSens = require('../memory-intelligence/memory-sensitivity-classifier');
const memScore = require('../memory-intelligence/memory-quality-scorecard');

function _sanitize(obj) {
  return utils.sanitizeForReport(obj);
}

function _authRequired(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.query && req.query.token) {
    const env = req.app?.locals?.dashboardEnv || process.env;
    const adminToken = env.DASHBOARD_ADMIN_TOKEN || '';
    if (req.query.token === adminToken) return next();
  }
  return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
}

function registerRagQualityRoutes(app, services = {}) {
  app.get('/api/dashboard/rag-quality', _authRequired, async (req, res) => {
    try {
      const docs = store.getAllDocuments ? store.getAllDocuments() : [];
      const sanitized = _sanitize({
        documentCount: docs.length,
        status: docs.length > 0 ? 'active' : 'empty',
        sourceConfidence: sourceConf.getOverallConfidence ? sourceConf.getOverallConfidence(services) : {},
        freshness: freshness.getOverallFreshness ? freshness.getOverallFreshness(services) : {},
        timestamp: utils.now()
      });
      res.json({ ok: true, status: sanitized.status, data: sanitized });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/rag-quality/source-confidence', _authRequired, async (req, res) => {
    try {
      const result = sourceConf.getSourceConfidenceReport ? sourceConf.getSourceConfidenceReport(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/rag-quality/freshness', _authRequired, async (req, res) => {
    try {
      const result = freshness.getFreshnessReport ? freshness.getFreshnessReport(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/rag-quality/evaluate-retrieval', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = retrievalEval.evaluateRetrieval ? retrievalEval.evaluateRetrieval(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'READ-ONLY — Evaluation only. No real actions executed.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/rag-quality/compress-context', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = contextComp.compressContext ? contextComp.compressContext(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'READ-ONLY — Compression analysis only.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/rag-quality/check-answer', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = answerCheck.checkAnswer ? answerCheck.checkAnswer(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'READ-ONLY — Answer check only.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/rag-quality/memory-duplicates', _authRequired, async (req, res) => {
    try {
      const result = memDedup.findDuplicates ? memDedup.findDuplicates(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/rag-quality/memory-freshness', _authRequired, async (req, res) => {
    try {
      const result = memFresh.getFreshnessReport ? memFresh.getFreshnessReport(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/rag-quality/memory-merge-plan', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = memMerge.buildMergePlan ? memMerge.buildMergePlan(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'PROPOSAL ONLY — No merge executed.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/rag-quality/memory-conflicts', _authRequired, async (req, res) => {
    try {
      const result = memConflict.getConflicts ? memConflict.getConflicts(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/rag-quality/memory-sensitivity', _authRequired, async (req, res) => {
    try {
      const result = memSens.getSensitivityReport ? memSens.getSensitivityReport(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/rag-quality/scorecard', _authRequired, async (req, res) => {
    try {
      const result = scorecard.buildRagQualityScorecard ? scorecard.buildRagQualityScorecard(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/rag-quality/report', _authRequired, async (req, res) => {
    try {
      const srcConfReport = sourceConf.getSourceConfidenceReport ? sourceConf.getSourceConfidenceReport(services) : {};
      const freshReport = freshness.getFreshnessReport ? freshness.getFreshnessReport(services) : {};
      const memDedupReport = memDedup.findDuplicates ? memDedup.findDuplicates(services) : {};
      const memFreshReport = memFresh.getFreshnessReport ? memFresh.getFreshnessReport(services) : {};
      const memConflictReport = memConflict.getConflicts ? memConflict.getConflicts(services) : {};
      const memSensReport = memSens.getSensitivityReport ? memSens.getSensitivityReport(services) : {};
      const scReport = scorecard.buildRagQualityScorecard ? scorecard.buildRagQualityScorecard(services) : {};
      const fullReport = reportGen.generateRagQualityReport ? reportGen.generateRagQualityReport({
        sourceConfidence: srcConfReport,
        freshness: freshReport,
        memoryDuplicates: memDedupReport,
        memoryFreshness: memFreshReport,
        memoryConflicts: memConflictReport,
        memorySensitivity: memSensReport,
        scorecard: scReport
      }, services) : {};
      const safe = _sanitize(fullReport);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { registerRagQualityRoutes };
