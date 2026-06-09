'use strict';

const categories = [
  'api_research', 'library_research', 'ai_model_research', 'deployment_research',
  'security_research', 'privacy_research', 'coding_architecture', 'documentation_review',
  'cost_comparison', 'troubleshooting', 'product_decision'
];

function classifyResearchIntent(input = '', services = {}) {
  const text = String(input).toLowerCase();
  if (/cost|biaya|price|pricing|budget|murah|ekonomis|harga/i.test(text)) return { category: 'cost_comparison', confidence: 0.85 };
  if (/api|sdk|endpoint|rest|graphql|webhook/i.test(text)) return { category: 'api_research', confidence: 0.85 };
  if (/library|package|npm|pip|module|dependency/i.test(text)) return { category: 'library_research', confidence: 0.85 };
  if (/model|ai|llm|gpt|mistral|groq|ollama|gemini|claude/i.test(text)) return { category: 'ai_model_research', confidence: 0.85 };
  if (/deploy|render|rollback|scaling|hosting|infra/i.test(text)) return { category: 'deployment_research', confidence: 0.85 };
  if (/security|vulnerability|exploit|patch|audit|penetration/i.test(text)) return { category: 'security_research', confidence: 0.85 };
  if (/privacy|data.protec|gdpr|pii|retention|encrypt/i.test(text)) return { category: 'privacy_research', confidence: 0.85 };
  if (/architecture|design.pattern|refactor|code.structur/i.test(text)) return { category: 'coding_architecture', confidence: 0.80 };
  if (/docs?|dokumentasi|readme|pedoman|panduan/i.test(text)) return { category: 'documentation_review', confidence: 0.80 };
  if (/error|gagal|fail|troubleshoot|bug|fix|problem|issue/i.test(text)) return { category: 'troubleshooting', confidence: 0.85 };
  return { category: 'product_decision', confidence: 0.50 };
}

function detectResearchSensitivity(input = '', services = {}) {
  const text = String(input).toLowerCase();
  if (/secret|token|password|credential|api.key/i.test(text)) return 'high';
  if (/private|personal|mood|energy|health|finance|salary/i.test(text)) return 'high';
  if (/internal|confidential|restricted|proprietary/i.test(text)) return 'medium';
  if (/life.?os|my.?data|my.?note/i.test(text)) return 'high';
  return 'low';
}

function detectResearchRequiresExternalSources(input = '', services = {}) {
  const text = String(input).toLowerCase();
  return /latest|terbaru|update|current|news|new|compare|bandingkan|tutorial|cara/i.test(text);
}

function detectResearchNeedsImplementationPlan(input = '', services = {}) {
  const text = String(input).toLowerCase();
  return /implementation|implementasi|build|buat|coding|code|develop|create|tulis|bikin/i.test(text);
}

function buildResearchIntentSummary(result = {}, services = {}) {
  return {
    category: result.category || 'unknown',
    confidence: result.confidence || 0,
    sensitivity: result.sensitivity || 'low',
    needsExternal: result.needsExternal || false,
    needsImplementationPlan: result.needsImplementationPlan || false,
    summary: `Kategori: ${result.category || 'unknown'} | Sensitivitas: ${result.sensitivity || 'low'}${result.needsExternal ? ' | Membutuhkan sumber eksternal' : ''}${result.needsImplementationPlan ? ' | Membutuhkan implementation plan' : ''}`
  };
}

module.exports = {
  classifyResearchIntent, detectResearchSensitivity, detectResearchRequiresExternalSources,
  detectResearchNeedsImplementationPlan, buildResearchIntentSummary, categories
};
