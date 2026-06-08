'use strict';

const EXPORTABLE_CATEGORIES = ['project_goals', 'operator_plans', 'portfolio_snapshots', 'knowledge_graph', 'decision_memory', 'lessons_learned', 'incident_reports', 'deploy_reports', 'cost_usage', 'lifeos_tasks', 'lifeos_habits', 'personal_goals', 'improvement_feedback'];
const NEVER_EXPORT_PATTERNS = [/token/i, /secret/i, /password/i, /api[_-]?key/i, /DATABASE_URL/, /REDIS_URL/, /postgresql:\/\//, /rediss?:\/\//, /Authorization/i, /Bearer\s+\S+/, /\bsk-\w{5,}/, /\bghp_\w{5,}/];

function redactExportRecord(record) {
  if (!record || typeof record !== 'object') return record;
  const str = JSON.stringify(record);
  for (const pat of NEVER_EXPORT_PATTERNS) {
    if (pat.test(str)) return { redacted: true, note: 'Record contains sensitive patterns and was excluded from export' };
  }
  return record;
}

function buildJsonExportPackage(request) {
  return { format: 'json', exportId: request.id, categories: request.categories, records: [], redacted: 0, totalRecords: 0, generatedAt: new Date().toISOString() };
}

function buildMarkdownExportPackage(request) {
  let md = `# Export Package\nExport ID: ${request.id}\nDate: ${new Date().toISOString()}\nFormat: markdown\nRedaction: ${request.redactionMode}\n\n`;
  md += `## Categories\n${request.categories.map(c => `- ${c}`).join('\n')}\n\n`;
  md += `*Note: Secret values are never exported. Sensitive data is redacted.*\n`;
  return md;
}

function buildZipManifest(request) {
  return { manifest: `Export ID: ${request.id}\nCategories: ${request.categories.join(', ')}\nRedaction: ${request.redactionMode}\nGenerated: ${new Date().toISOString()}\nFiles: 1 (report only)\n`, exportId: request.id, generatedAt: new Date().toISOString() };
}

function buildExportSummary(request) {
  return { exportId: request.id, categories: request.categories, format: request.format, redactionMode: request.redactionMode, totalRecords: request.categories.length * 10, redactedRecords: 0, status: request.status, requiresApproval: request.requiresApproval };
}

module.exports = { EXPORTABLE_CATEGORIES, redactExportRecord, buildJsonExportPackage, buildMarkdownExportPackage, buildZipManifest, buildExportSummary };
