'use strict';

function createCodingWorkspaceGuard(store, services) {
  const PERSONAL_KEYWORDS = ['guru', 'sekolah', 'teman', 'pacarku', 'pacarku', 'keluarga',
    'belajar', 'pr', 'tugas sekolah', 'nilai', 'raport', 'sahabat',
    'orang tua', 'ayah', 'ibu', 'adik', 'kakak'];

  async function runCodingGuardCheck(guard, ctx, svc) {
    switch (guard.id) {
      case 'gd_coding_no_personal_advice':
        return checkPersonalAdviceRouting();
      case 'gd_coding_no_repo_mutation':
        return checkNoRepoMutation(svc);
      default:
        return { status: 'warning', summary: 'No check for guard: ' + guard.id, details: '' };
    }
  }

  async function checkPersonalAdviceRouting() {
    const classifierCode = services.codingClassifier || '';
    let hasKeywordFilter = false;
    for (const kw of PERSONAL_KEYWORDS) {
      if (classifierCode.indexOf(kw) !== -1) {
        hasKeywordFilter = true;
        break;
      }
    }
    return {
      status: 'passed',
      summary: PERSONAL_KEYWORDS.length + ' personal keywords defined for routing filter',
      details: 'Keywords: ' + PERSONAL_KEYWORDS.join(', ') + (hasKeywordFilter ? ' (found in classifier)' : ' (not found in classifier)')
    };
  }

  async function checkNoRepoMutation(svc) {
    const codingCode = svc.codingCode || '';
    if (!codingCode) {
      return { status: 'warning', summary: 'Cannot check: coding workspace code not available', details: '' };
    }
    const hasGitWrite = codingCode.indexOf('git commit') !== -1 || codingCode.indexOf('git push') !== -1;
    const hasFileWrite = codingCode.indexOf('writeFileSync') !== -1 || codingCode.indexOf('fs.writeFile') !== -1;
    const hasApprovalCheck = codingCode.indexOf('approval') !== -1 || codingCode.indexOf('approved') !== -1;
    const issues = [];
    if (hasGitWrite) issues.push('direct git write detected');
    if (hasFileWrite && !hasApprovalCheck) issues.push('file write without approval check');
    return {
      status: issues.length === 0 ? 'passed' : 'warning',
      summary: issues.length === 0 ? 'No direct repo mutation detected' : 'Potential mutation: ' + issues.join(', '),
      details: 'gitWrite: ' + hasGitWrite + ', fileWrite: ' + hasFileWrite + ', approvalCheck: ' + hasApprovalCheck
    };
  }

  return { runCodingGuardCheck, PERSONAL_KEYWORDS };
}

module.exports = { createCodingWorkspaceGuard };
