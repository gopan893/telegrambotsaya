'use strict';

const store = require('./local-node-store');

const VALID_MESSAGE_TYPES = ['heartbeat', 'handshake', 'health_check', 'capability_report', 'action_request', 'action_result', 'error', 'status_update'];

function validateMessage(msg) {
  if (!msg || typeof msg !== 'object') return { valid: false, errors: ['Message must be an object'] };
  const errors = [];
  if (!msg.type) errors.push('Missing message type');
  else if (!VALID_MESSAGE_TYPES.includes(msg.type)) errors.push('Invalid message type: ' + msg.type);
  if (!msg.nodeId) errors.push('Missing nodeId');
  if (!msg.timestamp) errors.push('Missing timestamp');
  return { valid: errors.length === 0, errors };
}

function createMessage(params) {
  if (!params || !params.type || !params.nodeId) {
    return { ok: false, error: 'Missing type or nodeId' };
  }
  return {
    ok: true,
    message: {
      type: params.type,
      nodeId: params.nodeId,
      payload: params.payload || {},
      timestamp: new Date().toISOString(),
      version: params.version || '1.0'
    }
  };
}

function sanitizeMessage(msg) {
  if (!msg || typeof msg !== 'object') return msg;
  const sanitized = { ...msg };
  if (sanitized.payload) {
    const p = { ...sanitized.payload };
    delete p.token;
    delete p.secret;
    delete p.password;
    delete p.apiKey;
    sanitized.payload = p;
  }
  return sanitized;
}

function isMessageFresh(msg, maxAgeMs) {
  if (!msg || !msg.timestamp) return false;
  const age = Date.now() - new Date(msg.timestamp).getTime();
  return age <= (maxAgeMs || 60000);
}

module.exports = {
  validateMessage, createMessage, sanitizeMessage, isMessageFresh,
  VALID_MESSAGE_TYPES
};
