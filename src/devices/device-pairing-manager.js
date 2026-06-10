'use strict';

const store = require('./device-store');
const utils = require('./device-utils');
const crypto = require('crypto');

const PAIRING_STATUSES = ['pending', 'approved', 'rejected', 'expired'];

function generatePairingSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function createPairingRequest(params) {
  if (!params || !params.deviceId || !params.requestedBy) {
    return { ok: false, error: 'Missing deviceId or requestedBy' };
  }
  const device = store.getDevice(params.deviceId);
  if (!device) return { ok: false, error: 'Device not found' };

  const existing = store.listPairings({ deviceId: params.deviceId, status: 'pending' });
  if (existing.length > 0) {
    return { ok: false, error: 'Pending pairing already exists for this device' };
  }

  const id = utils.createId('pair');
  const pairing = {
    id,
    deviceId: params.deviceId,
    requestedBy: params.requestedBy,
    status: 'pending',
    secretHash: crypto.createHash('sha256').update(generatePairingSecret()).digest('hex'),
    metadata: params.metadata || {},
    requestedAt: new Date().toISOString(),
    resolvedAt: null
  };
  store.setPairing(id, pairing);
  return { ok: true, pairingId: id, status: 'pending' };
}

function approvePairing(pairingId, approvedBy) {
  const pairing = store.getPairing(pairingId);
  if (!pairing) return { ok: false, error: 'Pairing not found' };
  if (pairing.status !== 'pending') return { ok: false, error: 'Pairing is not pending' };

  const updated = {
    ...pairing,
    status: 'approved',
    approvedBy: approvedBy || 'system',
    resolvedAt: new Date().toISOString()
  };
  store.setPairing(pairingId, updated);

  const device = store.getDevice(pairing.deviceId);
  if (device) {
    store.setDevice(pairing.deviceId, { ...device, status: 'paired' });
  }

  return { ok: true, pairingId, deviceId: pairing.deviceId };
}

function rejectPairing(pairingId, rejectedBy, reason) {
  const pairing = store.getPairing(pairingId);
  if (!pairing) return { ok: false, error: 'Pairing not found' };
  if (pairing.status !== 'pending') return { ok: false, error: 'Pairing is not pending' };

  const updated = {
    ...pairing,
    status: 'rejected',
    rejectedBy: rejectedBy || 'system',
    rejectReason: reason || 'rejected',
    resolvedAt: new Date().toISOString()
  };
  store.setPairing(pairingId, updated);
  return { ok: true, pairingId, deviceId: pairing.deviceId };
}

function listPairings(filter) {
  return store.listPairings(filter);
}

function expirePairings(maxAgeMs) {
  const now = Date.now();
  const pairings = store.listPairings({ status: 'pending' });
  let expiredCount = 0;
  for (const p of pairings) {
    const age = now - new Date(p.requestedAt).getTime();
    if (age > (maxAgeMs || 3600000)) {
      store.setPairing(p.id, { ...p, status: 'expired', resolvedAt: new Date().toISOString() });
      expiredCount++;
    }
  }
  return { expiredCount };
}

function getPairingStatus(pairingId) {
  const pairing = store.getPairing(pairingId);
  if (!pairing) return { ok: false, error: 'Pairing not found' };
  return {
    ok: true,
    pairingId: pairing.id,
    deviceId: pairing.deviceId,
    status: pairing.status,
    requestedAt: pairing.requestedAt,
    resolvedAt: pairing.resolvedAt
  };
}

module.exports = {
  createPairingRequest, approvePairing, rejectPairing,
  listPairings, expirePairings, getPairingStatus,
  PAIRING_STATUSES
};
