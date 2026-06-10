'use strict';

function createReadOnlySimulator(connectorId, config) {
  return {
    connectorId,
    config: config || {},
    operations: [],
    status: 'idle',
    createdAt: new Date().toISOString()
  };
}

function simulateReadOperation(simulator, operation) {
  if (!simulator) return { ok: false, error: 'No simulator' };
  if (!operation || !operation.type) return { ok: false, error: 'Operation type required' };

  const readOnlyOps = ['read', 'get', 'list', 'fetch', 'search', 'query', 'inspect', 'status', 'health'];
  const opType = String(operation.type).toLowerCase();

  if (!readOnlyOps.some(op => opType.includes(op))) {
    return { ok: false, error: 'Not a read-only operation: ' + operation.type };
  }

  const result = {
    simulatorId: simulator.connectorId,
    operation: operation.type,
    target: operation.target || null,
    params: operation.params || {},
    simulatedAt: new Date().toISOString(),
    readOnly: true,
    output: null
  };

  try {
    if (typeof operation.mockFn === 'function') {
      result.output = operation.mockFn(simulator.config);
      result.status = 'success';
    } else {
      result.output = { mock: true, message: 'Simulated read operation' };
      result.status = 'mock';
    }
  } catch (err) {
    result.status = 'error';
    result.error = err.message;
  }

  simulator.operations.push(result);
  return { ok: true, result };
}

function simulateBatchRead(simulator, operations) {
  if (!Array.isArray(operations)) return { ok: false, error: 'Operations must be an array' };
  const results = [];
  let allOk = true;
  for (const op of operations) {
    const result = simulateReadOperation(simulator, op);
    results.push(result);
    if (!result.ok) allOk = false;
  }
  return {
    ok: allOk,
    total: operations.length,
    succeeded: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results
  };
}

function validateReadOnly(operation) {
  if (!operation || !operation.type) return { readOnly: false, reason: 'No operation type' };
  const lower = String(operation.type).toLowerCase();
  const readOnlyOps = ['read', 'get', 'list', 'fetch', 'search', 'query', 'inspect', 'status', 'health', 'count'];
  const isReadOnly = readOnlyOps.some(op => lower.includes(op));

  if (operation.target && /write|delete|create|update|deploy|push|release|rollback|restore/.test(lower)) {
    return { readOnly: false, reason: 'Write-like operation detected' };
  }

  return { readOnly: isReadOnly, reason: isReadOnly ? 'Read-only operation' : 'Non-read-only operation' };
}

function getSimulationSummary(simulator) {
  if (!simulator) return {};
  return {
    connectorId: simulator.connectorId,
    status: simulator.status,
    totalOperations: simulator.operations.length,
    successful: simulator.operations.filter(o => o.status === 'success' || o.status === 'mock').length,
    failed: simulator.operations.filter(o => o.status === 'error').length
  };
}

module.exports = {
  createReadOnlySimulator, simulateReadOperation, simulateBatchRead,
  validateReadOnly, getSimulationSummary
};
