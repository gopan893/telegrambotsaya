'use strict';

const utils = require('./reliability-utils');

const UptimeLatencyTracker = {
  recordSample(sample = {}) {
    return {
      timestamp: utils.formatTimestamp(),
      uptime: utils.safeNumber(sample.uptime, 100),
      latency: utils.safeNumber(sample.latency, 0),
      responseTime: utils.safeNumber(sample.responseTime, 0),
      source: sample.source || 'unknown'
    };
  },

  calculateAverageUptime(samples = []) {
    if (samples.length === 0) return 100;
    return samples.reduce((s, sm) => s + (sm.uptime || 100), 0) / samples.length;
  },

  calculateAverageLatency(samples = []) {
    if (samples.length === 0) return 0;
    return samples.reduce((s, sm) => s + (sm.latency || 0), 0) / samples.length;
  }
};

module.exports = UptimeLatencyTracker;
