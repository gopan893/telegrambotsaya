/* RAG Quality Dashboard Renderer */

(function() {
  const API = '/api/dashboard/rag-quality';

  UI.renderRagQuality = async function(container) {
    if (!container) return;
    container.innerHTML = UI.renderLoading('Loading RAG Quality...');
    try {
      const res = await Api.fetch(API);
      let data = null;
      if (res.ok && res.data) data = res.data;

      let html = '';
      html += '<div class="section-header"><h2>RAG Quality</h2></div>';
      html += buildSourceConfidenceSection(data);
      html += buildSourceFreshnessSection(data);
      html += buildRetrievalQualitySection(data);
      html += buildContextCompressionSection(data);
      html += buildCitationCoverageSection(data);
      html += buildHallucinationGuardSection(data);
      html += buildMemoryDuplicatesSection(data);
      html += buildMemoryFreshnessSection(data);
      html += buildMemoryConflictsSection(data);
      html += buildMemorySensitivitySection(data);
      html += buildMemoryQualityScorecardSection(data);

      html += '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">';
      html += '<button class="btn btn-outline" onclick="UI.renderRagQuality(document.getElementById(\'tab-content\'))">Refresh</button>';
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = UI.renderError('RAG Quality Error', err.message);
    }
  };

  function buildSourceConfidenceSection(data) {
    if (!data || !data.sourceConfidence) return UI.renderEmptyState('', 'Source Confidence', 'No source confidence data available.');
    const sc = data.sourceConfidence;
    let html = '<div class="section-header" style="margin-top:16px;"><h3>Source Confidence</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (sc.high || 0) + '</div>';
    html += '<div class="stat-label">High Confidence</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (sc.medium || 0) + '</div>';
    html += '<div class="stat-label">Medium Confidence</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (sc.low || 0) + '</div>';
    html += '<div class="stat-label">Low Confidence</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildSourceFreshnessSection(data) {
    if (!data || !data.sourceFreshness) return '';
    const sf = data.sourceFreshness;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Source Freshness</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (sf.fresh || 0) + '</div>';
    html += '<div class="stat-label">Fresh</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (sf.aging || 0) + '</div>';
    html += '<div class="stat-label">Aging</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (sf.stale || 0) + '</div>';
    html += '<div class="stat-label">Stale</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildRetrievalQualitySection(data) {
    if (!data || !data.retrievalQuality) return '';
    const rq = data.retrievalQuality;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Retrieval Quality</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (rq.relevance !== undefined ? rq.relevance.toFixed(1) : '-') + '</div>';
    html += '<div class="stat-label">Relevance Score</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (rq.diversity !== undefined ? rq.diversity.toFixed(1) : '-') + '</div>';
    html += '<div class="stat-label">Diversity Score</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (rq.trust !== undefined ? rq.trust.toFixed(1) : '-') + '</div>';
    html += '<div class="stat-label">Trust Score</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildContextCompressionSection(data) {
    if (!data || !data.contextCompression) return '';
    const cc = data.contextCompression;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Context Compression</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (cc.compressed || 0) + '</div>';
    html += '<div class="stat-label">Compressed Contexts</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (cc.savedTokens || 0) + '</div>';
    html += '<div class="stat-label">Tokens Saved</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildCitationCoverageSection(data) {
    if (!data || !data.citationCoverage) return '';
    const cit = data.citationCoverage;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Citation Coverage</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (cit.labeled || 0) + '</div>';
    html += '<div class="stat-label">Labeled</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-warning);">' + (cit.unlabeled || 0) + '</div>';
    html += '<div class="stat-label">Unlabeled</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildHallucinationGuardSection(data) {
    if (!data || !data.hallucinationGuard) return '';
    const hg = data.hallucinationGuard;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Hallucination Guard</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (hg.supported || 0) + '</div>';
    html += '<div class="stat-label">Supported Claims</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (hg.unsupported || 0) + '</div>';
    html += '<div class="stat-label">Unsupported Claims</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildMemoryDuplicatesSection(data) {
    if (!data || !data.memoryDuplicates) return '';
    const md = data.memoryDuplicates;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Memory Duplicates</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + (md.count > 0 ? 'var(--color-warning)' : 'var(--color-success)') + ';">' + (md.count || 0) + '</div>';
    html += '<div class="stat-label">Duplicate Count</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value">' + (md.mergeProposals || 0) + '</div>';
    html += '<div class="stat-label">Merge Proposals</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildMemoryFreshnessSection(data) {
    if (!data || !data.memoryFreshness) return '';
    const mf = data.memoryFreshness;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Memory Freshness</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-success);">' + (mf.fresh || 0) + '</div>';
    html += '<div class="stat-label">Fresh</div>';
    html += '</div></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:var(--color-danger);">' + (mf.stale || 0) + '</div>';
    html += '<div class="stat-label">Stale</div>';
    html += '</div></div>';
    html += '</div>';
    return html;
  }

  function buildMemoryConflictsSection(data) {
    if (!data || !data.memoryConflicts) return '';
    const mc = data.memoryConflicts;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Memory Conflicts</h3></div>';
    html += '<div class="card-grid">';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + (mc.count > 0 ? 'var(--color-danger)' : 'var(--color-success)') + ';">' + (mc.count || 0) + '</div>';
    html += '<div class="stat-label">Conflict Count</div>';
    html += '</div></div>';
    if (mc.severity) {
      html += '<div class="card"><div class="card-body">';
      html += '<div class="stat-value" style="font-size:14px;">' + Utils.escapeHtml(mc.severity) + '</div>';
      html += '<div class="stat-label">Severity</div>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function buildMemorySensitivitySection(data) {
    if (!data || !data.memorySensitivity) return '';
    const ms = data.memorySensitivity;
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Memory Sensitivity</h3></div>';
    html += '<div class="card"><div class="card-body">';
    if (ms.classificationBreakdown) {
      html += '<div class="stat-value" style="font-size:14px;">Classification Breakdown</div>';
      for (const [level, count] of Object.entries(ms.classificationBreakdown)) {
        html += '<p style="font-size:12px;margin-top:4px;">' + Utils.escapeHtml(level.charAt(0).toUpperCase() + level.slice(1)) + ': ' + count + '</p>';
      }
    } else {
      html += '<div class="stat-value" style="font-size:14px;">No classification data</div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildMemoryQualityScorecardSection(data) {
    if (!data || !data.memoryQualityScorecard) return '';
    const mq = data.memoryQualityScorecard;
    const score = mq.overallScore || 0;
    const color = score >= 90 ? 'var(--color-success)' : score >= 70 ? 'var(--color-warning)' : 'var(--color-danger)';
    let html = '<div class="section-header" style="margin-top:24px;"><h3>Memory Quality Scorecard</h3></div>';
    html += '<div class="card"><div class="card-body">';
    html += '<div class="stat-value" style="color:' + color + ';">' + score + '/100</div>';
    html += '<div class="stat-label">Overall Quality Score</div>';
    html += '</div></div>';
    return html;
  }
})();
