'use strict';

const utils = require('./workflow-utils');

const DEVICE_TYPES = ['nas', 'homelab', 'phone', 'tablet', 'desktop', 'router', 'camera', 'sensor'];

const DEVICE_ACTIONS = {
  nas: ['health_check', 'check_backups', 'list_shares', 'disk_usage', 'restart_service'],
  homelab: ['health_check', 'list_services', 'check_docker', 'system_stats', 'restart_container'],
  phone: ['health_check', 'battery_status', 'storage_check'],
  tablet: ['health_check', 'battery_status', 'storage_check'],
  desktop: ['health_check', 'cpu_usage', 'memory_usage', 'disk_usage'],
  router: ['health_check', 'connected_devices', 'bandwidth_usage', 'restart'],
  camera: ['health_check', 'snapshot', 'list_recordings'],
  sensor: ['health_check', 'read_values', 'calibrate']
};

function createDeviceReadStep(device, params) {
  if (!device) return { ok: false, error: 'Device is required' };
  const deviceLower = String(device).toLowerCase();
  return {
    ok: true,
    step: {
      id: `device_read_${deviceLower}_${Date.now().toString(36)}`,
      type: 'read',
      name: `Read from ${deviceLower}`,
      source: deviceLower,
      params: { device: deviceLower, ...(params || {}) }
    }
  };
}

function createDeviceHealthCheckStep(device, params) {
  if (!device) return { ok: false, error: 'Device is required' };
  const deviceLower = String(device).toLowerCase();
  if (!DEVICE_TYPES.includes(deviceLower)) {
    return { ok: false, error: `Unknown device type: ${deviceLower}`, validTypes: DEVICE_TYPES };
  }
  return {
    ok: true,
    step: {
      id: `device_health_${deviceLower}_${Date.now().toString(36)}`,
      type: 'device_action',
      name: `Health check: ${deviceLower}`,
      device: deviceLower,
      action: 'health_check',
      params: { scope: 'quick', ...(params || {}) }
    }
  };
}

function createDeviceActionStep(device, action, params) {
  if (!device) return { ok: false, error: 'Device is required' };
  if (!action) return { ok: false, error: 'Action is required' };
  const deviceLower = String(device).toLowerCase();
  const actionLower = String(action).toLowerCase();
  if (!DEVICE_TYPES.includes(deviceLower)) {
    return { ok: false, error: `Unknown device type: ${deviceLower}`, validTypes: DEVICE_TYPES };
  }
  const validActions = DEVICE_ACTIONS[deviceLower] || ['health_check'];
  if (!validActions.includes(actionLower)) {
    return { ok: false, error: `Invalid action '${actionLower}' for device '${deviceLower}'`, validActions };
  }
  return {
    ok: true,
    step: {
      id: `device_action_${deviceLower}_${actionLower}_${Date.now().toString(36)}`,
      type: 'device_action',
      name: `${actionLower} on ${deviceLower}`,
      device: deviceLower,
      action: actionLower,
      params: params || {}
    }
  };
}

function createDeviceNotifyStep(device, channel, message, params) {
  return {
    ok: true,
    step: {
      id: `device_notify_${Date.now().toString(36)}`,
      type: 'notify',
      name: `Device notification from ${device || 'system'}`,
      channel: channel || 'telegram',
      message: message || '',
      params: { device: device, ...(params || {}) }
    }
  };
}

function getDeviceTypes() {
  return [...DEVICE_TYPES];
}

function getDeviceActions(deviceType) {
  const deviceLower = String(deviceType).toLowerCase();
  return DEVICE_ACTIONS[deviceLower] || [];
}

function validateDeviceParams(device, action, params) {
  const errors = [];
  if (!device) errors.push('Device is required');
  else if (!DEVICE_TYPES.includes(String(device).toLowerCase())) {
    errors.push(`Invalid device type: ${device}`);
  }
  if (action) {
    const deviceLower = String(device).toLowerCase();
    const validActions = DEVICE_ACTIONS[deviceLower] || [];
    if (validActions.length > 0 && !validActions.includes(String(action).toLowerCase())) {
      errors.push(`Invalid action '${action}' for device '${device}'`);
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  createDeviceReadStep, createDeviceHealthCheckStep,
  createDeviceActionStep, createDeviceNotifyStep,
  getDeviceTypes, getDeviceActions, validateDeviceParams,
  DEVICE_TYPES, DEVICE_ACTIONS
};
