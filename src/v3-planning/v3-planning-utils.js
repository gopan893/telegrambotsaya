'use strict';

/**
 * V3 Planning Utilities
 * Shared utilities for V3 planning modules
 */

/**
 * Sanitize planning data for output
 * @param {Object} data - Data to sanitize
 * @returns {Object} - Sanitized data
 */
function sanitizePlanningData(data) {
  if (!data || typeof data !== 'object') return data;

  const sanitized = Array.isArray(data) ? [] : {};

  for (const [key, value] of Object.entries(data)) {
    // Skip secret-related keys
    if (isSecretKey(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    if (value && typeof value === 'object') {
      sanitized[key] = sanitizePlanningData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Check if a key name indicates a secret value
 * @param {string} key - Key name to check
 * @returns {boolean} - True if key is secret-related
 */
function isSecretKey(key) {
  const secretPatterns = [
    'token',
    'key',
    'secret',
    'password',
    'credential',
    'auth',
    'api_key',
    'apikey'
  ];

  const lowerKey = (key || '').toLowerCase();
  return secretPatterns.some(pattern => lowerKey.includes(pattern));
}

/**
 * Validate planning item ID
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid
 */
function isValidPlanningId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length <= 128;
}

/**
 * Generate unique planning item ID
 * @param {string} prefix - ID prefix
 * @returns {string} - Unique ID
 */
function generatePlanningId(prefix = 'plan') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Format timestamp for planning
 * @param {Date|string|number} date - Date to format
 * @returns {string} - ISO formatted timestamp
 */
function formatPlanningTimestamp(date) {
  try {
    return new Date(date || Date.now()).toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

/**
 * Calculate priority score
 * @param {Object} item - Item to score
 * @returns {number} - Priority score (0-100)
 */
function calculatePriorityScore(item) {
  let score = 50; // Base score

  // Urgency factor
  if (item.urgency === 'high') score += 20;
  if (item.urgency === 'medium') score += 10;

  // Importance factor
  if (item.importance === 'high') score += 20;
  if (item.importance === 'medium') score += 10;

  // Blocker severity
  if (item.hasBlockers) score += 15;

  // Risk factor (inverse - high risk reduces priority)
  if (item.risk === 'high') score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Classify planning item category
 * @param {Object} item - Item to classify
 * @returns {string} - Category
 */
function classifyCategory(item) {
  const categories = [
    'project',
    'learning',
    'career',
    'lifeos',
    'maintenance',
    'research',
    'release',
    'finance',
    'health'
  ];

  if (item.category && categories.includes(item.category)) {
    return item.category;
  }

  // Simple keyword-based classification
  const text = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();

  if (text.includes('learn') || text.includes('study')) return 'learning';
  if (text.includes('release') || text.includes('deploy')) return 'release';
  if (text.includes('personal') || text.includes('life')) return 'lifeos';
  if (text.includes('research') || text.includes('investigate')) return 'research';

  return 'project';
}

/**
 * Merge planning reports
 * @param {Array} reports - Reports to merge
 * @returns {Object} - Merged report
 */
function mergePlanningReports(reports) {
  const merged = {
    reports: reports.length,
    mergedAt: formatPlanningTimestamp(),
    summary: [],
    warnings: [],
    errors: [],
    data: {}
  };

  for (const report of reports) {
    if (!report) continue;

    if (report.summary) merged.summary.push(report.summary);
    if (report.warnings) merged.warnings.push(...(Array.isArray(report.warnings) ? report.warnings : [report.warnings]));
    if (report.errors) merged.errors.push(...(Array.isArray(report.errors) ? report.errors : [report.errors]));

    if (report.data && typeof report.data === 'object') {
      Object.assign(merged.data, report.data);
    }
  }

  return merged;
}

/**
 * Validate planning configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} - Validation result
 */
function validatePlanningConfig(config) {
  const result = {
    valid: true,
    errors: []
  };

  if (!config || typeof config !== 'object') {
    result.valid = false;
    result.errors.push('Configuration must be an object');
    return result;
  }

  if (config.horizon && !['weekly', 'monthly', 'quarterly', 'yearly', 'long_term'].includes(config.horizon)) {
    result.valid = false;
    result.errors.push('Invalid horizon value');
  }

  if (config.status && !['draft', 'active', 'paused', 'blocked', 'completed', 'archived'].includes(config.status)) {
    result.valid = false;
    result.errors.push('Invalid status value');
  }

  return result;
}

module.exports = {
  sanitizePlanningData,
  isSecretKey,
  isValidPlanningId,
  generatePlanningId,
  formatPlanningTimestamp,
  calculatePriorityScore,
  classifyCategory,
  mergePlanningReports,
  validatePlanningConfig
};
