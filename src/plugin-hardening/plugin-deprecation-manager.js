'use strict';

function createDeprecationNotice(pluginId, reason, alternativePlugin) {
  return {
    pluginId,
    reason: reason || 'No reason specified',
    alternative: alternativePlugin || null,
    deprecatedAt: new Date().toISOString(),
    removalDate: null,
    status: 'deprecated',
    migrationSteps: [],
    notifiedUsers: []
  };
}

function detectDeprecatedPlugin(manifest) {
  if (!manifest) return null;
  const warnings = [];
  if (manifest.deprecated === true) {
    warnings.push('Plugin is explicitly marked as deprecated');
  }
  if (manifest.deprecatedAt) {
    const depDate = new Date(manifest.deprecatedAt);
    const now = new Date();
    const daysSince = Math.floor((now - depDate) / (1000 * 60 * 60 * 24));
    warnings.push('Deprecated for ' + daysSince + ' days');
  }
  if (manifest.removalDate) {
    const remDate = new Date(manifest.removalDate);
    const now = new Date();
    if (remDate <= now) {
      warnings.push('Removal date has passed: ' + manifest.removalDate);
    } else {
      const daysUntil = Math.ceil((remDate - now) / (1000 * 60 * 60 * 24));
      warnings.push('Removal scheduled in ' + daysUntil + ' days: ' + manifest.removalDate);
    }
  }
  return { deprecated: manifest.deprecated === true || warnings.length > 0, warnings };
}

function createMigrationPlan(notice, targetPluginId) {
  if (!notice) return null;
  return {
    pluginId: notice.pluginId,
    targetPluginId: targetPluginId || null,
    steps: [
      { step: 1, action: 'export_data', description: 'Export plugin data and configuration' },
      { step: 2, action: 'install_replacement', description: 'Install replacement plugin if available' },
      { step: 3, action: 'migrate_config', description: 'Migrate configuration to new plugin' },
      { step: 4, action: 'import_data', description: 'Import data into new plugin' },
      { step: 5, action: 'verify', description: 'Verify migration completed successfully' },
      { step: 6, action: 'disable_old', description: 'Disable deprecated plugin' },
      { step: 7, action: 'cleanup', description: 'Remove deprecated plugin after confirmation' }
    ],
    status: 'planned',
    createdAt: new Date().toISOString()
  };
}

function checkDeprecationUrgency(notice) {
  if (!notice) return { urgency: 'unknown' };
  if (!notice.removalDate) return { urgency: 'low', reason: 'No removal date set' };
  const remDate = new Date(notice.removalDate);
  const now = new Date();
  const daysUntil = Math.ceil((remDate - now) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 0) return { urgency: 'critical', reason: 'Removal date passed', daysUntil };
  if (daysUntil <= 7) return { urgency: 'high', reason: 'Removal within 7 days', daysUntil };
  if (daysUntil <= 30) return { urgency: 'medium', reason: 'Removal within 30 days', daysUntil };
  return { urgency: 'low', reason: 'Removal in ' + daysUntil + ' days', daysUntil };
}

function summarizeDeprecations(notices) {
  if (!Array.isArray(notices)) return { total: 0 };
  return {
    total: notices.length,
    withRemovalDate: notices.filter(n => n.removalDate).length,
    overdue: notices.filter(n => n.removalDate && new Date(n.removalDate) <= new Date()).length,
    withMigration: notices.filter(n => n.alternative).length
  };
}

function isPluginDeprecated(manifest) {
  if (!manifest) return false;
  return manifest.deprecated === true || !!manifest.deprecatedAt;
}

function getDeprecationMessage(notice) {
  if (!notice) return '';
  const parts = ['Plugin ' + notice.pluginId + ' is deprecated.'];
  if (notice.reason) parts.push('Reason: ' + notice.reason);
  if (notice.alternative) parts.push('Use ' + notice.alternative + ' instead.');
  if (notice.removalDate) parts.push('Removal date: ' + notice.removalDate);
  return parts.join(' ');
}

module.exports = {
  createDeprecationNotice, detectDeprecatedPlugin, createMigrationPlan,
  checkDeprecationUrgency, summarizeDeprecations, isPluginDeprecated,
  getDeprecationMessage
};
