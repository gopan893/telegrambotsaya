/**
 * Dashboard API Contract v3
 * Builds and validates dashboard API contracts from registry v3
 */

function buildDashboardApiContractV3(item, services) {
  if (!item) {
    return { success: false, error: 'Item is required' };
  }

  if (item.type !== 'dashboard_api') {
    return { success: false, error: `Item type must be dashboard_api, got ${item.type}` };
  }

  const contract = {
    id: item.id,
    method: item.method || 'GET',
    path: item.path || `/api/dashboard/${item.id}`,
    tabId: item.tabId || null,
    module: item.module || null,
    requiresAuth: Boolean(item.requiresAuth),
    requiresOwner: Boolean(item.requiresOwner),
    requiresAdmin: Boolean(item.requiresAdmin),
    riskLevel: item.riskLevel || 'low',
    actionType: item.actionType || 'read',
    responseContract: item.responseContract || {
      ok: true,
      status: 200,
      data: {}
    },
    errorContract: item.errorContract || {
      ok: false,
      status: 500,
      error: 'ERROR'
    },
    cachePolicy: item.cachePolicy || 'no-cache',
    redactionPolicy: item.redactionPolicy || 'secrets',
    directRunAllowed: item.directRunAllowed !== false,
    enabled: item.enabled !== false
  };

  return { success: true, contract };
}

function validateDashboardApiContractV3(contract, services) {
  const errors = [];
  const warnings = [];

  if (!contract) {
    errors.push('Contract is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (!contract.id) {
    errors.push('Missing API id');
  }

  if (!contract.path) {
    errors.push('Missing API path');
  }

  if (contract.path && !contract.path.startsWith('/api/dashboard/')) {
    errors.push(`API path must start with /api/dashboard/, got ${contract.path}`);
  }

  if (!contract.method) {
    errors.push('Missing HTTP method');
  }

  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  if (contract.method && !validMethods.includes(contract.method)) {
    errors.push(`Invalid HTTP method: ${contract.method}`);
  }

  if (contract.actionType === 'dangerous' && contract.directRunAllowed) {
    errors.push(`Dangerous API ${contract.id} cannot have directRunAllowed=true`);
  }

  if (contract.actionType === 'external_write' && contract.directRunAllowed) {
    errors.push(`External write API ${contract.id} cannot have directRunAllowed=true`);
  }

  if (contract.cachePolicy !== 'no-cache') {
    warnings.push(`Dashboard API ${contract.id} should use no-cache policy`);
  }

  if (!contract.responseContract) {
    warnings.push(`API ${contract.id} missing response contract`);
  }

  if (!contract.errorContract) {
    warnings.push(`API ${contract.id} missing error contract`);
  }

  if (contract.visibility === 'public' && contract.requiresAuth) {
    warnings.push(`Public API ${contract.id} should not require auth`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function normalizeApiContractFromV2(v2Api, services) {
  if (!v2Api) {
    return { success: false, error: 'v2Api is required' };
  }

  const normalizedItem = {
    id: v2Api.id,
    type: 'dashboard_api',
    method: v2Api.method || 'GET',
    path: v2Api.path || `/api/dashboard/${v2Api.id}`,
    tabId: v2Api.tabId || v2Api.tab,
    module: v2Api.module || null,
    requiresAuth: Boolean(v2Api.requiresAuth),
    requiresOwner: Boolean(v2Api.requiresOwner),
    requiresAdmin: Boolean(v2Api.requiresAdmin),
    riskLevel: v2Api.riskLevel || 'low',
    actionType: v2Api.actionType || 'read',
    responseContract: v2Api.responseContract || null,
    errorContract: v2Api.errorContract || null,
    cachePolicy: v2Api.cachePolicy || 'no-cache',
    redactionPolicy: v2Api.redactionPolicy || 'secrets',
    directRunAllowed: v2Api.directRunAllowed !== false,
    enabled: v2Api.enabled !== false,
    compatibility: {
      v2Source: 'dashboard-api-registry-v2',
      v2Id: v2Api.id
    }
  };

  return buildDashboardApiContractV3(normalizedItem, services);
}

function buildDashboardApiContractReport(apis, services) {
  if (!Array.isArray(apis)) {
    return {
      success: false,
      error: 'apis must be an array'
    };
  }

  const report = {
    totalApis: apis.length,
    validApis: 0,
    invalidApis: 0,
    dangerousApis: 0,
    protectedApis: 0,
    errors: [],
    warnings: [],
    contracts: []
  };

  for (const api of apis) {
    const buildResult = buildDashboardApiContractV3(api, services);

    if (!buildResult.success) {
      report.invalidApis++;
      report.errors.push({
        apiId: api.id,
        error: buildResult.error
      });
      continue;
    }

    const contract = buildResult.contract;
    const validation = validateDashboardApiContractV3(contract, services);

    report.contracts.push({
      contract,
      validation
    });

    if (validation.valid) {
      report.validApis++;
    } else {
      report.invalidApis++;
    }

    if (contract.actionType === 'dangerous' || contract.actionType === 'external_write') {
      report.dangerousApis++;
    }

    if (contract.requiresAuth || contract.requiresOwner || contract.requiresAdmin) {
      report.protectedApis++;
    }

    report.errors.push(...validation.errors.map(e => ({
      apiId: contract.id,
      error: e
    })));

    report.warnings.push(...validation.warnings.map(w => ({
      apiId: contract.id,
      warning: w
    })));
  }

  report.success = true;
  report.allValid = report.invalidApis === 0 && report.errors.length === 0;

  return report;
}

function detectUnsafeDashboardApiContractV3(contract, services) {
  const issues = [];

  if (!contract) {
    return { safe: true, issues };
  }

  if (contract.actionType === 'dangerous' && contract.directRunAllowed) {
    issues.push({
      severity: 'critical',
      type: 'dangerous_direct_run',
      message: `API ${contract.id} allows direct dangerous actions`
    });
  }

  if (contract.actionType === 'external_write' && contract.directRunAllowed) {
    issues.push({
      severity: 'critical',
      type: 'external_write_direct_run',
      message: `API ${contract.id} allows direct external writes`
    });
  }

  if (contract.visibility === 'public' && !contract.path.includes('/health')) {
    issues.push({
      severity: 'critical',
      type: 'protected_api_public',
      message: `Protected API ${contract.id} marked as public`
    });
  }

  if (contract.cachePolicy !== 'no-cache') {
    issues.push({
      severity: 'medium',
      type: 'api_caching',
      message: `API ${contract.id} uses cache policy ${contract.cachePolicy}`
    });
  }

  return {
    safe: issues.filter(i => i.severity === 'critical').length === 0,
    issues
  };
}

module.exports = {
  buildDashboardApiContractV3,
  validateDashboardApiContractV3,
  normalizeApiContractFromV2,
  buildDashboardApiContractReport,
  detectUnsafeDashboardApiContractV3
};
