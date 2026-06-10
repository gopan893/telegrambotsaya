'use strict';

const store = require('./local-node-store');
const crypto = require('crypto');

function generateChallenge() {
  return crypto.randomBytes(16).toString('hex');
}

function createHandshakeRequest(params) {
  if (!params || !params.nodeId) {
    return { ok: false, error: 'Missing nodeId' };
  }
  const node = store.getNode(params.nodeId);
  if (!node) return { ok: false, error: 'Node not found in registry' };
  const challenge = generateChallenge();
  const handshake = {
    id: 'hs_' + Date.now().toString(36),
    nodeId: params.nodeId,
    challenge,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  store.setHandshake(handshake.id, handshake);
  return {
    ok: true,
    nodeId: params.nodeId,
    handshakeId: handshake.id,
    challenge,
    timestamp: new Date().toISOString()
  };
}

function validateHandshakeResponse(params) {
  if (!params || !params.handshakeId || !params.response) {
    return { ok: false, error: 'Missing handshakeId or response' };
  }
  const handshake = store.getHandshake(params.handshakeId);
  if (!handshake) return { ok: false, error: 'Handshake not found' };
  const valid = typeof params.response === 'string' && params.response.length > 0;
  if (valid) {
    store.setHandshake(params.handshakeId, { ...handshake, status: 'accepted', resolvedAt: new Date().toISOString() });
    store.setNode(handshake.nodeId, { ...(store.getNode(handshake.nodeId) || {}), status: 'connected' });
  }
  return {
    ok: valid,
    nodeId: handshake.nodeId,
    authenticated: valid,
    timestamp: new Date().toISOString()
  };
}

function completeHandshake(params) {
  const req = createHandshakeRequest(params);
  if (!req.ok) return req;
  return {
    ok: true,
    nodeId: params.nodeId,
    handshakeId: req.handshakeId,
    challenge: req.challenge,
    status: 'challenge_sent',
    timestamp: new Date().toISOString()
  };
}

function getHandshakeStatus(nodeId) {
  const node = store.getNode(nodeId);
  if (!node) return { ok: false, error: 'Node not found' };
  return {
    ok: true,
    nodeId,
    status: node.status,
    lastSeenAt: node.lastSeenAt
  };
}

module.exports = {
  generateChallenge, createHandshakeRequest, validateHandshakeResponse,
  completeHandshake, getHandshakeStatus
};
