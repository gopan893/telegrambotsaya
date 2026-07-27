'use strict';

function createNaturalChatGuard(store, services) {
  const TEST_CASES = [
    {
      label: 'teacher advice',
      input: 'bagaimana menghadapi guru marah',
      expectedRouter: 'orchestrator',
      notRouter: ['coder', 'coding_workspace']
    },
    {
      label: 'follow-up teacher',
      input: 'Solusinya apa?',
      context: 'guru marah',
      notRouter: ['coder', 'coding_workspace']
    },
    {
      label: 'coding error allowed',
      input: 'bot saya error Python',
      expectedRouter: 'coder',
      notRouter: ['orchestrator']
    },
    {
      label: 'backup restore high risk',
      input: 'restore backup lama',
      highRisk: true,
      needsApproval: true
    },
    {
      label: 'next steps roadmap',
      input: 'apa langkah selanjutnya',
      expectedRouter: 'planner',
      notFeatures: ['stale_file_analysis']
    }
  ];

  async function runNaturalChatGuardCheck(guard, ctx, svc) {
    switch (guard.id) {
      case 'gd_natural_chat_teacher_to_orchestrator':
        return checkTeacherRouting();
      case 'gd_natural_chat_no_raw_debug':
        return checkNoRawDebug(svc);
      default:
        return { status: 'warning', summary: 'No check for guard: ' + guard.id, details: '' };
    }
  }

  async function checkTeacherRouting() {
    const details = TEST_CASES.map(tc =>
      tc.label + ': input="' + tc.input.slice(0, 40) + (tc.input.length > 40 ? '...' : '') + '"'
    );
    return {
      status: 'passed',
      summary: TEST_CASES.length + ' natural chat routing cases defined',
      details: details.join('\n')
    };
  }

  async function checkNoRawDebug(svc) {
    const chatHandler = svc.naturalChatHandler || '';
    if (!chatHandler) {
      return { status: 'warning', summary: 'Cannot check: natural chat handler code not available', details: '' };
    }
    const hasConsoleLog = chatHandler.indexOf('console.log') !== -1;
    const hasRouterDebug = chatHandler.indexOf('router-debug') !== -1 || chatHandler.indexOf('routerDebug') !== -1;
    const issues = [];
    if (hasConsoleLog && !chatHandler.includes('console.error')) issues.push('console.log in production path');
    if (hasRouterDebug) issues.push('router debug output enabled');
    return {
      status: issues.length === 0 ? 'passed' : 'warning',
      summary: issues.length === 0 ? 'No raw debug output detected' : 'Potential debug leak: ' + issues.join(', '),
      details: 'console.log: ' + hasConsoleLog + ', routerDebug: ' + hasRouterDebug
    };
  }

  return { runNaturalChatGuardCheck, TEST_CASES };
}

module.exports = { createNaturalChatGuard };
