'use strict';

const { normalizeCategory } = require('./coding-utils');

const CODING_KEYWORDS = {
  bug_fix: [
    'bug', 'error', 'fix', 'broken', 'crash', 'tidak bisa', 'gagal',
    'gak bisa', 'exception', 'fail', 'not working', 'masalah',
    'issue', 'problem', 'salah', 'keliru', 'ngaco', 'rusak',
    'debug', 'perbaiki', 'repair'
  ],
  feature_request: [
    'tambah', 'tambahkan', 'fitur', 'buat', 'add', 'new feature',
    'permintaan', 'request', 'ingin', 'mau', 'bisa', 'fitur baru',
    'develop', 'kembangkan'
  ],
  phase_prompt: [
    'phase', 'prompt', 'phase prompt', 'buat prompt', 'generate prompt',
    'codex prompt', 'claude prompt', 'buat phase'
  ],
  refactor: [
    'refactor', 'refactoring', 'bersihkan', 'rapihkan', 'restructure',
    'reorganize', 'simplify', 'sederhanakan', 'optimasi', 'optimize'
  ],
  dashboard_issue: [
    'dashboard', 'ui', 'tampilan', 'layout', 'menu', 'tab', 'button',
    'tombol', 'page', 'halaman', 'css', 'style', 'pwa', 'service worker'
  ],
  telegram_bot_issue: [
    'bot', 'telegram', 'reply', 'jawab', 'command', 'perintah',
    'message', 'pesan', 'chat', 'webhook', 'callback', 'inline keyboard'
  ],
  database_storage_issue: [
    'database', 'db', 'postgres', 'redis', 'storage', 'query', 'sql',
    'table', 'tabel', 'schema', 'migration', 'data', 'simpan', 'ambil'
  ],
  integration_issue: [
    'integration', 'integrasi', 'api', 'third party', 'external',
    'connector', 'github', 'google', 'calendar', 'oauth'
  ],
  security_issue: [
    'security', 'keamanan', 'vulnerability', 'vuln', 'exploit',
    'xss', 'csrf', 'injection', 'auth', 'permission', 'izin'
  ],
  test_regression: [
    'test', 'testing', 'regression', 'smoke test', 'unit test',
    'e2e', 'coverage', 'jest', 'mocha', 'test plan'
  ],
  deployment_issue: [
    'deploy', 'deployment', 'render', 'production', 'server',
    'hosting', 'domain', 'ssl', 'https', 'port', 'environment', 'env'
  ],
  github_issue_pr: [
    'github', 'git ', 'issue', 'pr', 'pull request', 'commit', 'push',
    'branch', 'merge', 'repo', 'repository', 'buat issue', 'buat pr',
    'create issue', 'create pr', 'pull request'
  ]
};

const AGENT_MAP = {
  bug_fix: ['Coder', 'Planner', 'Critic'],
  feature_request: ['Planner', 'Coder', 'Critic', 'Security'],
  phase_prompt: ['Planner', 'Coder', 'Critic'],
  refactor: ['Coder', 'Critic', 'Security', 'Planner'],
  dashboard_issue: ['Coder', 'Planner', 'Critic'],
  telegram_bot_issue: ['Coder', 'Planner', 'Critic'],
  database_storage_issue: ['Coder', 'Planner', 'Security', 'Critic'],
  integration_issue: ['Coder', 'Security', 'Planner', 'Critic'],
  security_issue: ['Security', 'Coder', 'Critic', 'Executor'],
  test_regression: ['Coder', 'Critic', 'Planner'],
  deployment_issue: ['Coder', 'Planner', 'Security', 'Executor'],
  github_issue_pr: ['Coder', 'Planner', 'Critic', 'Security', 'Executor']
};

const DANGEROUS_PATTERNS = [
  /hapus\s+semua/i, /delete\s+all/i, /drop\s+table/i,
  /rm\s+-rf/i, /hapus.*file/i, /delete.*file/i,
  /format/i, /wipe/i, /reset\s+semua/i, /hapus.*data/i,
  /hapus.*seluruh/i, /delete.*all/i
];

const PERSONAL_NON_CODING_PATTERNS = [
  /bagaimana\s+(menghadapi|menghadapi|menyikapi)/i,
  /cara\s+(menghadapi|menyikapi|mengatasi)\s+(guru|teman|orang\s+tua|bos)/i,
  /guru\s+marah/i, /teman\s+jelek/i, /pacar\s+(marah|selingkuhan?)/i,
  /orang\s+tua\s+marah/i, /bos\s+marah/i,
  /sedih\s+karena/i, /galau/i, /putus\s+cinta/i,
  /depresi/i, /cemas\s+berlebihan/i
];

function isDangerousRequest(lower) {
  for (const p of DANGEROUS_PATTERNS) {
    if (p.test(lower)) return true;
  }
  return false;
}

function isPersonalNonCoding(lower) {
  for (const p of PERSONAL_NON_CODING_PATTERNS) {
    if (p.test(lower)) return true;
  }
  return false;
}

function classifyRequest(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') {
    return {
      isCodingRelated: false,
      category: 'feature_request',
      selectedAgents: [],
      riskLevel: 'low',
      needsRepoContext: false,
      needsGitHubProposal: false,
      needsEvaluation: false,
      requiresApproval: false
    };
  }

  const lower = userMessage.toLowerCase().trim();

  // Check personal/non-coding first — highest priority exclusion
  if (isPersonalNonCoding(lower)) {
    return {
      isCodingRelated: false,
      category: 'feature_request',
      selectedAgents: [],
      riskLevel: 'low',
      needsRepoContext: false,
      needsGitHubProposal: false,
      needsEvaluation: false,
      requiresApproval: false
    };
  }

  // Check if coding-related
  const allKeywords = Object.values(CODING_KEYWORDS).flat();
  let isCodingRelated = allKeywords.some(kw => lower.includes(kw));

  // Dangerous patterns make it coding-related (bot/system related destructive ops)
  const isDangerous = isDangerousRequest(lower);

  // Score each category
  let bestCategory = 'feature_request';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CODING_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // If no keywords matched but dangerous, classify as feature_request (will be flagged)
  if (!isCodingRelated && isDangerous) {
    isCodingRelated = true;
    bestCategory = 'refactor'; // generic destructive change
  }

  if (!isCodingRelated) {
    return {
      isCodingRelated: false,
      category: 'feature_request',
      selectedAgents: [],
      riskLevel: 'low',
      needsRepoContext: false,
      needsGitHubProposal: false,
      needsEvaluation: false,
      requiresApproval: false
    };
  }

  const category = normalizeCategory(bestCategory);
  const selectedAgents = AGENT_MAP[category] || ['Coder', 'Planner'];

  // Determine risk level
  let riskLevel = 'low';
  if (isDangerous) {
    riskLevel = 'critical';
  } else if (['security_issue', 'deployment_issue', 'database_storage_issue'].includes(category)) {
    riskLevel = 'high';
  } else if (['refactor', 'integration_issue', 'github_issue_pr'].includes(category)) {
    riskLevel = 'medium';
  }

  // Check for constraint violations
  const constraintViolations = [
    /pakai\s+react/i, /gunakan\s+react/i, /react\s+dashboard/i,
    /pakai\s+typescript/i, /gunakan\s+ts\b/i, /next\.js/i, /vue\.js/i,
    /nuxt/i, /svelte/i
  ];
  if (!isDangerous && constraintViolations.some(p => p.test(lower))) {
    riskLevel = 'high';
  }

  const needsRepoContext = [
    'bug_fix', 'feature_request', 'refactor', 'dashboard_issue',
    'telegram_bot_issue', 'database_storage_issue', 'integration_issue',
    'security_issue', 'test_regression', 'deployment_issue'
  ].includes(category);

  const needsGitHubProposal = category === 'github_issue_pr' ||
    /\bbuat\s+issue\b/i.test(lower) || /\bbuat\s+pr\b/i.test(lower) ||
    /\bcreate\s+issue\b/i.test(lower) || /\bcreate\s+pr\b/i.test(lower) ||
    /\bpull\s+request\b/i.test(lower) || /\bpull\s+request\b/i.test(lower);

  const needsEvaluation = needsGitHubProposal || riskLevel === 'high' || riskLevel === 'critical';

  const requiresApproval = needsGitHubProposal || riskLevel === 'critical' ||
    category === 'deployment_issue' || category === 'security_issue' ||
    isDangerous;

  return {
    isCodingRelated: true,
    category,
    selectedAgents,
    riskLevel,
    needsRepoContext,
    needsGitHubProposal,
    needsEvaluation,
    requiresApproval
  };
}

module.exports = {
  classifyRequest,
  CODING_KEYWORDS,
  AGENT_MAP,
  DANGEROUS_PATTERNS,
  PERSONAL_NON_CODING_PATTERNS
};
