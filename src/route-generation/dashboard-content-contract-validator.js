/**
 * Dashboard Content Contract Validator
 * Validates dashboard content matches expected contracts
 */

const store = require('../registry-v3/registry-v3-store');

async function validateDashboardContentContractsV3(services) {
  const { logger } = services;

  try {
    const frozen = store.getFrozen();

    if (!frozen || !frozen.items) {
      return {
        success: false,
        error: 'No frozen registry v3 available'
      };
    }

    const tabs = frozen.items.filter(i => i.type === 'dashboard_tab' && i.enabled);

    const results = [];

    for (const tab of tabs) {
      const validation = await validateExpectedContentKeywords(tab, services);
      results.push({
        tabId: tab.id,
        validation
      });
    }

    const summary = {
      totalTabs: tabs.length,
      validTabs: results.filter(r => r.validation.valid).length,
      invalidTabs: results.filter(r => !r.validation.valid).length,
      warnings: results.reduce((sum, r) => sum + r.validation.warnings.length, 0)
    };

    if (logger) {
      logger.info('[Content Validator] Validated', {
        totalTabs: summary.totalTabs,
        validTabs: summary.validTabs,
        invalidTabs: summary.invalidTabs
      });
    }

    return {
      success: true,
      results,
      summary
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function validateExpectedContentKeywords(tabContract, services) {
  const errors = [];
  const warnings = [];

  if (!tabContract) {
    errors.push('Tab contract is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (tabContract.status === 'active' && !tabContract.expectedContent) {
    warnings.push(`Active tab ${tabContract.id} has no expected content defined`);
  }

  if (!tabContract.expectedContentKeywords || tabContract.expectedContentKeywords.length === 0) {
    if (tabContract.status === 'active') {
      warnings.push(`Active tab ${tabContract.id} has no expected content keywords`);
    }
    return { valid: true, errors, warnings };
  }

  for (const keyword of tabContract.expectedContentKeywords) {
    if (!keyword || typeof keyword !== 'string') {
      errors.push(`Invalid keyword in tab ${tabContract.id}: ${keyword}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    expectedKeywords: tabContract.expectedContentKeywords
  };
}

async function detectContentContractMissing(tabContract, services) {
  const issues = [];

  if (!tabContract) {
    return { hasIssues: false, issues };
  }

  if (tabContract.status === 'active') {
    if (!tabContract.expectedContent) {
      issues.push({
        tabId: tabContract.id,
        type: 'missing_expected_content',
        severity: 'medium',
        message: `Active tab ${tabContract.id} missing expected content specification`
      });
    }

    if (!tabContract.expectedContentKeywords || tabContract.expectedContentKeywords.length === 0) {
      issues.push({
        tabId: tabContract.id,
        type: 'missing_content_keywords',
        severity: 'medium',
        message: `Active tab ${tabContract.id} missing expected content keywords`
      });
    }

    if (!tabContract.emptyState) {
      issues.push({
        tabId: tabContract.id,
        type: 'missing_empty_state',
        severity: 'low',
        message: `Tab ${tabContract.id} missing empty state definition`
      });
    }

    if (!tabContract.degradedState) {
      issues.push({
        tabId: tabContract.id,
        type: 'missing_degraded_state',
        severity: 'low',
        message: `Tab ${tabContract.id} missing degraded state definition`
      });
    }

    if (!tabContract.errorState) {
      issues.push({
        tabId: tabContract.id,
        type: 'missing_error_state',
        severity: 'low',
        message: `Tab ${tabContract.id} missing error state definition`
      });
    }
  }

  return {
    hasIssues: issues.length > 0,
    issues
  };
}

function buildContentContractValidationReport(services) {
  const validationResult = validateDashboardContentContractsV3(services);

  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error
    };
  }

  const frozen = store.getFrozen();
  const tabs = frozen?.items?.filter(i => i.type === 'dashboard_tab' && i.enabled) || [];

  const allIssues = [];

  for (const tab of tabs) {
    const contentIssues = detectContentContractMissing(tab, services);
    if (contentIssues.hasIssues) {
      allIssues.push(...contentIssues.issues);
    }
  }

  return {
    success: true,
    validation: validationResult,
    contentIssues: allIssues,
    summary: {
      totalTabs: validationResult.summary.totalTabs,
      validTabs: validationResult.summary.validTabs,
      invalidTabs: validationResult.summary.invalidTabs,
      warnings: validationResult.summary.warnings,
      contentIssues: allIssues.length,
      highSeverity: allIssues.filter(i => i.severity === 'high').length,
      mediumSeverity: allIssues.filter(i => i.severity === 'medium').length,
      lowSeverity: allIssues.filter(i => i.severity === 'low').length
    },
    recommendations: generateContentValidationRecommendations(
      validationResult.summary,
      allIssues
    )
  };
}

function generateContentValidationRecommendations(summary, issues) {
  const recommendations = [];

  if (summary.invalidTabs > 0) {
    recommendations.push(`Fix ${summary.invalidTabs} tabs with content validation errors`);
  }

  const mediumIssues = issues.filter(i => i.severity === 'medium');
  if (mediumIssues.length > 0) {
    recommendations.push(`Address ${mediumIssues.length} medium severity content issues`);
  }

  if (summary.warnings > 5) {
    recommendations.push('Review and address content validation warnings');
  }

  const missingContent = issues.filter(i => i.type === 'missing_expected_content');
  if (missingContent.length > 0) {
    recommendations.push(`${missingContent.length} active tabs need expected content specifications`);
  }

  if (summary.invalidTabs === 0 && mediumIssues.length === 0) {
    recommendations.push('Content contracts are valid and ready');
  }

  return recommendations;
}

function validateTabContentStates(tabContract) {
  const errors = [];
  const warnings = [];

  if (!tabContract) {
    errors.push('Tab contract is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (tabContract.fallbackPolicy === 'overview') {
    errors.push(`Tab ${tabContract.id} cannot use Overview as fallback`);
  }

  if (!tabContract.loadingState) {
    warnings.push(`Tab ${tabContract.id} missing loading state`);
  }

  if (!tabContract.emptyState) {
    warnings.push(`Tab ${tabContract.id} missing empty state`);
  }

  if (!tabContract.degradedState) {
    warnings.push(`Tab ${tabContract.id} missing degraded state`);
  }

  if (!tabContract.errorState) {
    warnings.push(`Tab ${tabContract.id} missing error state`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  validateDashboardContentContractsV3,
  validateExpectedContentKeywords,
  detectContentContractMissing,
  buildContentContractValidationReport,
  validateTabContentStates
};
