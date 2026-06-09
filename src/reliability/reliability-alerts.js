'use strict';

const utils = require('./reliability-utils');

const alertsStore = { alerts: [], suppressed: {} };

const ReliabilityAlerts = {
  buildReliabilityAlert(event = {}, services = {}) {
    return {
      id: utils.generateId('alert'),
      type: event.type || 'info',
      severity: event.severity || 'info',
      message: event.message || 'Reliability alert',
      module: event.module || 'unknown',
      timestamp: utils.formatTimestamp(),
      acknowledged: false
    };
  },

  sendReliabilityAlert(alert, services = {}) {
    if (!alert || !alert.id) return { ok: false };
    const key = alert.module + '_' + alert.type;
    if (this.suppressDuplicateReliabilityAlert(key, services)) {
      return { ok: true, suppressed: true };
    }
    alertsStore.alerts.push(alert);
    alertsStore.suppressed[key] = Date.now();
    return { ok: true, alert };
  },

  suppressDuplicateReliabilityAlert(key, services = {}) {
    const last = alertsStore.suppressed[key];
    if (last && (Date.now() - last) < 300000) return true;
    return false;
  },

  buildRollbackRecommendationAlert(reason = '', services = {}) {
    return {
      id: utils.generateId('alert'),
      type: 'rollback_recommendation',
      severity: 'critical',
      message: `Rollback recommended: ${reason}`,
      module: 'reliability',
      proposalRequired: true,
      timestamp: utils.formatTimestamp(),
      acknowledged: false
    };
  },

  getAlerts() { return alertsStore.alerts; },
  clearAlerts() { alertsStore.alerts = []; alertsStore.suppressed = {}; }
};

module.exports = ReliabilityAlerts;
