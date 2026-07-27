'use strict';

const utils = require('./reliability-utils');

const ReliabilityReportGenerator = {
  generateReliabilityReport(sloStatus, scorecard, healthWindows, regressions, services = {}) {
    return {
      reportType: 'reliability_report',
      version: 'v1.0.0',
      generatedAt: utils.formatTimestamp(),
      sloSummary: {
        overall: sloStatus?.overall || 'unknown',
        healthy: sloStatus?.healthy || 0,
        warning: sloStatus?.warning || 0,
        violated: sloStatus?.violated || 0,
        total: sloStatus?.total || 0
      },
      scorecard: {
        overall: scorecard?.overall || 100,
        level: scorecard?.level || 'production_stable',
        scores: scorecard?.scores || {}
      },
      healthWindows: Array.isArray(healthWindows) ? healthWindows.map(w => ({
        id: w.id,
        releaseId: w.releaseId,
        status: w.status,
        sampleCount: (w.samples || []).length,
        summary: w.summary || null
      })) : [],
      regressions: Array.isArray(regressions) ? regressions.map(r => ({
        id: r.id,
        module: r.module,
        detectedAt: r.detectedAt
      })) : [],
      generatedBy: 'reliability-report-generator'
    };
  }
};

module.exports = ReliabilityReportGenerator;
