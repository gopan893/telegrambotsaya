'use strict';

const utils = require('./workflow-utils');

const PLUGIN_ACTION_TYPES = ['invoke', 'configure', 'enable', 'disable', 'health_check', 'list', 'status'];

function createPluginReadStep(pluginId, params) {
  if (!pluginId) return { ok: false, error: 'Plugin ID is required' };
  return {
    ok: true,
    step: {
      id: `plugin_read_${pluginId}_${Date.now().toString(36)}`,
      type: 'read',
      name: `Read plugin: ${pluginId}`,
      source: 'plugin_store',
      plugin: pluginId,
      params: { action: 'status', ...(params || {}) }
    }
  };
}

function createPluginActionStep(pluginId, action, params) {
  if (!pluginId) return { ok: false, error: 'Plugin ID is required' };
  if (!action) return { ok: false, error: 'Action is required' };
  const actionLower = String(action).toLowerCase();
  if (!PLUGIN_ACTION_TYPES.includes(actionLower)) {
    return { ok: false, error: `Invalid plugin action: ${action}`, validActions: PLUGIN_ACTION_TYPES };
  }
  const isWrite = ['configure', 'enable', 'disable'].includes(actionLower);
  return {
    ok: true,
    step: {
      id: `plugin_action_${pluginId}_${actionLower}_${Date.now().toString(36)}`,
      type: isWrite ? 'plugin_action' : 'read',
      name: `${actionLower} plugin: ${pluginId}`,
      plugin: pluginId,
      action: actionLower,
      params: params || {}
    }
  };
}

function createPluginHealthCheckStep(pluginId, params) {
  if (!pluginId) return { ok: false, error: 'Plugin ID is required' };
  return {
    ok: true,
    step: {
      id: `plugin_health_${pluginId}_${Date.now().toString(36)}`,
      type: 'plugin_action',
      name: `Health check: ${pluginId}`,
      plugin: pluginId,
      action: 'health_check',
      params: { scope: 'quick', ...(params || {}) }
    }
  };
}

function createPluginConnectorStep(pluginId, connectorId, action, params) {
  if (!pluginId) return { ok: false, error: 'Plugin ID is required' };
  if (!connectorId) return { ok: false, error: 'Connector ID is required' };
  return {
    ok: true,
    step: {
      id: `plugin_connector_${pluginId}_${connectorId}_${Date.now().toString(36)}`,
      type: 'plugin_action',
      name: `Connector ${action || 'invoke'}: ${pluginId}/${connectorId}`,
      plugin: pluginId,
      action: action || 'invoke',
      params: { connectorId, ...(params || {}) }
    }
  };
}

function createPluginAnalyzeStep(pluginId, params) {
  if (!pluginId) return { ok: false, error: 'Plugin ID is required' };
  return {
    ok: true,
    step: {
      id: `plugin_analyze_${pluginId}_${Date.now().toString(36)}`,
      type: 'analyze',
      name: `Analyze plugin: ${pluginId}`,
      source: 'plugin_store',
      plugin: pluginId,
      params: { metrics: ['uptime', 'error_rate', 'event_throughput'], ...(params || {}) }
    }
  };
}

function createPluginNotifyStep(pluginId, channel, message, params) {
  return {
    ok: true,
    step: {
      id: `plugin_notify_${Date.now().toString(36)}`,
      type: 'notify',
      name: `Plugin notification: ${pluginId || 'system'}`,
      channel: channel || 'telegram',
      message: message || '',
      params: { plugin: pluginId, ...(params || {}) }
    }
  };
}

function getPluginActionTypes() {
  return [...PLUGIN_ACTION_TYPES];
}

function validatePluginParams(pluginId, action, params) {
  const errors = [];
  if (!pluginId) errors.push('Plugin ID is required');
  if (action && !PLUGIN_ACTION_TYPES.includes(String(action).toLowerCase())) {
    errors.push(`Invalid plugin action: ${action}`);
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  createPluginReadStep, createPluginActionStep,
  createPluginHealthCheckStep, createPluginConnectorStep,
  createPluginAnalyzeStep, createPluginNotifyStep,
  getPluginActionTypes, validatePluginParams, PLUGIN_ACTION_TYPES
};
