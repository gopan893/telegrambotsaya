'use strict';

const utils = require('./telegram-utils');

const COMMAND_CATEGORIES = {
  core: 'Core',
  dashboard: 'Dashboard',
  agents: 'Agents',
  executor: 'Executor',
  integrations: 'Integrations',
  coding: 'Coding',
  routines: 'Routines',
  selfhealing: 'Self-Healing',
  monitoring: 'Monitoring',
  cicd: 'CI/CD',
  githubops: 'GitHub Ops',
  deploy: 'Deploy',
  observability: 'Observability',
  cost: 'Cost',
  operator: 'Operator',
  portfolio: 'Portfolio',
  knowledge: 'Knowledge',
  lifeos: 'Life OS',
  backup: 'Backup',
  memory: 'Memory',
  goals: 'Goals',
  workflows: 'Workflows',
  devgovernance: 'Dev Governance'
};

const RISK_LEVELS = { read_only: 0, low: 1, medium: 2, high: 3, danger: 4 };

const BUILTIN_COMMANDS = [
  { name: 'start', aliases: ['mulai'], module: 'core', category: 'core', description: 'Start the bot and show welcome message', examples: ['/start'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'help', aliases: ['bantuan', 'tolong'], module: 'core', category: 'core', description: 'Show help menu or help for a specific command', examples: ['/help', '/help deploy', '/help lifeos'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'menu', aliases: ['mainmenu'], module: 'core', category: 'core', description: 'Show main command menu', examples: ['/menu'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'status', aliases: ['stats', 'server'], module: 'core', category: 'core', description: 'Show bot and system status', examples: ['/status'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'health', aliases: ['ping', 'live'], module: 'core', category: 'core', description: 'Health check the bot', examples: ['/health'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'whoami', aliases: ['me', 'saya'], module: 'core', category: 'core', description: 'Show your user info and permissions', examples: ['/whoami'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'settings', aliases: ['config', 'set'], module: 'core', category: 'core', description: 'Show or update bot settings', examples: ['/settings'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'agents', aliases: ['bots', 'dafataragen'], module: 'agents', category: 'agents', description: 'List all registered agents', examples: ['/agents'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'agent', aliases: ['bot', 'agen'], module: 'agents', category: 'agents', description: 'View details about a specific agent', examples: ['/agent <name>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'router', aliases: ['routing'], module: 'agents', category: 'agents', description: 'Show agent routing configuration', examples: ['/router'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'botmapping', aliases: ['mapping', 'botmap'], module: 'agents', category: 'agents', description: 'Show bot-to-agent mapping', examples: ['/botmapping'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'multibot', aliases: ['multibots'], module: 'multibot', category: 'agents', description: 'List multi-bot configuration', examples: ['/multibot'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'multibot_on', aliases: ['multiboton'], module: 'multibot', category: 'agents', description: 'Enable multi-bot mode', examples: ['/multibot_on'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'multibot_off', aliases: ['multibotoff'], module: 'multibot', category: 'agents', description: 'Disable multi-bot mode', examples: ['/multibot_off'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'visibleagents', aliases: ['visible', 'visiblebots'], module: 'agents', category: 'agents', description: 'Show visible agents in chat', examples: ['/visibleagents'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'council', aliases: ['dewan'], module: 'agents', category: 'agents', description: 'Call agent council for discussion', examples: ['/council <topic>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'debate', aliases: ['perdebatan'], module: 'agents', category: 'agents', description: 'Start agent debate on a topic', examples: ['/debate <topic>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'riskreview', aliases: ['risk', 'reviewrisk'], module: 'agents', category: 'agents', description: 'Review risk of a proposed action', examples: ['/riskreview <proposalId>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'executions', aliases: ['execs', 'exec', 'daftarexec'], module: 'executor', category: 'executor', description: 'List recent and pending executions', examples: ['/executions'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'pending', aliases: ['pendingexec', 'menunggu'], module: 'executor', category: 'executor', description: 'Show pending executions', examples: ['/pending'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'propose', aliases: ['usul', 'proposalbaru'], module: 'executor', category: 'executor', description: 'Create a new proposal for an action', examples: ['/propose <action> <details>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'approve', aliases: ['setuju', 'acc', 'izinkan'], module: 'executor', category: 'executor', description: 'Approve a pending proposal', examples: ['/approve <proposalId>'], riskLevel: 'high', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'reject', aliases: ['tolak', 'batal'], module: 'executor', category: 'executor', description: 'Reject a pending proposal', examples: ['/reject <proposalId>'], riskLevel: 'medium', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'runexec', aliases: ['jalankan', 'run', 'execnow'], module: 'executor', category: 'executor', description: 'Run an approved proposal', examples: ['/runexec <proposalId>'], riskLevel: 'danger', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'cancel_exec', aliases: ['batalkan', 'cancel'], module: 'executor', category: 'executor', description: 'Cancel a pending execution', examples: ['/cancel_exec <executionId>'], riskLevel: 'medium', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'dbstatus', aliases: ['db', 'database', 'pgstatus'], module: 'storage', category: 'dashboard', description: 'Show database connection status', examples: ['/dbstatus'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'redisstatus', aliases: ['redis', 'redischeck'], module: 'storage', category: 'dashboard', description: 'Show Redis connection status', examples: ['/redisstatus'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'dashboard', aliases: ['panel', 'adminpanel'], module: 'dashboard', category: 'dashboard', description: 'Show dashboard access info', examples: ['/dashboard'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'audit', aliases: ['log', 'catatan'], module: 'audit', category: 'dashboard', description: 'Show recent audit log entries', examples: ['/audit'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'plans', aliases: ['rencana', 'semuarencana'], module: 'planner', category: 'goals', description: 'List all plans', examples: ['/plans'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'goals', aliases: ['tujuan', 'target'], module: 'planner', category: 'goals', description: 'List all goals', examples: ['/goals'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'workflows', aliases: ['alurkerja', 'alur'], module: 'planner', category: 'workflows', description: 'List workflows', examples: ['/workflows'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'next', aliases: ['selanjutnya'], module: 'planner', category: 'goals', description: 'Show next planned action', examples: ['/next'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'priorities', aliases: ['prioritas', 'skala'], module: 'planner', category: 'goals', description: 'Show priority list', examples: ['/priorities'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'backup', aliases: ['cadangan'], module: 'backup', category: 'backup', description: 'Show backup overview', examples: ['/backup'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'backupcreate', aliases: ['buatcadangan', 'backupbaru'], module: 'backup', category: 'backup', description: 'Create a new backup', examples: ['/backupcreate'], riskLevel: 'medium', requiresOwner: true, requiresAdmin: false, requiresApproval: true, requiresEvaluation: true, enabled: true },
  { name: 'backups', aliases: ['daftarcadangan'], module: 'backup', category: 'backup', description: 'List all backups', examples: ['/backups'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'backupstatus', aliases: ['statuscadangan'], module: 'backup', category: 'backup', description: 'Show backup system status', examples: ['/backupstatus'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'recovery', aliases: ['pulihkan', 'restore'], module: 'backup', category: 'backup', description: 'Show recovery options', examples: ['/recovery'], riskLevel: 'read_only', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'integrity', aliases: ['cekintegritas', 'cekbackup'], module: 'backup', category: 'backup', description: 'Check backup integrity', examples: ['/integrity'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'integrations', aliases: ['integrasi', 'connectors'], module: 'integrations', category: 'integrations', description: 'List active integrations', examples: ['/integrations'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'connectors', aliases: ['konektor'], module: 'integrations', category: 'integrations', description: 'List all connectors', examples: ['/connectors'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'connector_status', aliases: ['statuskonektor', 'connectorstatus'], module: 'integrations', category: 'integrations', description: 'Show a connector status', examples: ['/connector_status <name>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'credstatus', aliases: ['kredensial', 'credentialstatus'], module: 'integrations', category: 'integrations', description: 'Show credential status (no secrets)', examples: ['/credstatus'], riskLevel: 'read_only', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'integration_pipeline', aliases: ['pipelineintegrasi', 'integrationpipeline'], module: 'integrations', category: 'integrations', description: 'Show integration pipeline status', examples: ['/integration_pipeline'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'integration_eval', aliases: ['evalintegrasi', 'integrationeval'], module: 'integrations', category: 'integrations', description: 'Run integration evaluation gate', examples: ['/integration_eval'], riskLevel: 'low', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'coding', aliases: ['koding', 'code'], module: 'coding', category: 'coding', description: 'Show coding workspace status', examples: ['/coding'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'codereq', aliases: ['codingreq', 'permintaan_kode'], module: 'coding', category: 'coding', description: 'Request a coding task', examples: ['/codereq <description>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'codeplan', aliases: ['rencanakode', 'codingplan'], module: 'coding', category: 'coding', description: 'Create a code change plan', examples: ['/codeplan <task>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'codetasks', aliases: ['tugaskode', 'codingtasks'], module: 'coding', category: 'coding', description: 'List coding tasks', examples: ['/codetasks'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'codeprompt', aliases: ['promptkode', 'codingprompt'], module: 'coding', category: 'coding', description: 'Generate a coding prompt', examples: ['/codeprompt <task>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'testplan', aliases: ['rencanates', 'testingplan'], module: 'coding', category: 'coding', description: 'Generate a test plan', examples: ['/testplan <feature>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'riskreview_code', aliases: ['riskkode', 'codereview'], module: 'coding', category: 'coding', description: 'Review risk of a coding change', examples: ['/riskreview_code <planId>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'routines', aliases: ['rutinitas'], module: 'routines', category: 'routines', description: 'List all routines', examples: ['/routines'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'routine', aliases: ['rutin'], module: 'routines', category: 'routines', description: 'Show routine details', examples: ['/routine <name>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'routine_on', aliases: ['rutinnyala', 'routinestart'], module: 'routines', category: 'routines', description: 'Enable a routine', examples: ['/routine_on <name>'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'routine_off', aliases: ['rutinmati', 'routinestop'], module: 'routines', category: 'routines', description: 'Disable a routine', examples: ['/routine_off <name>'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'runroutine', aliases: ['jalankanrutin'], module: 'routines', category: 'routines', description: 'Run a routine now', examples: ['/runroutine <name>'], riskLevel: 'medium', requiresOwner: true, requiresAdmin: false, requiresApproval: true, requiresEvaluation: false, enabled: true },
  { name: 'dryrunroutine', aliases: ['ujirutin', 'dryrun'], module: 'routines', category: 'routines', description: 'Dry-run a routine without executing', examples: ['/dryrunroutine <name>'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'briefing', aliases: ['ringkasan'], module: 'routines', category: 'routines', description: 'Get daily briefing', examples: ['/briefing'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'dailybrief', aliases: ['briefharian'], module: 'routines', category: 'routines', description: 'Get daily briefing', examples: ['/dailybrief'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'selfheal', aliases: ['sembuhkan', 'heal'], module: 'selfhealing', category: 'selfhealing', description: 'Run self-healing check', examples: ['/selfheal'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'healthcheck', aliases: ['cekkesehatan'], module: 'selfhealing', category: 'selfhealing', description: 'Run health check suite', examples: ['/healthcheck'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'regressioncheck', aliases: ['cekregresi'], module: 'selfhealing', category: 'selfhealing', description: 'Run regression check', examples: ['/regressioncheck'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'dashboardcheck', aliases: ['cekdashboard'], module: 'selfhealing', category: 'selfhealing', description: 'Check dashboard health', examples: ['/dashboardcheck'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'repairplans', aliases: ['rencanperbaikan'], module: 'selfhealing', category: 'selfhealing', description: 'List repair plans', examples: ['/repairplans'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'repairprompt', aliases: ['promptperbaikan'], module: 'selfhealing', category: 'selfhealing', description: 'Generate repair prompt', examples: ['/repairprompt <planId>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'monitor', aliases: ['pantau'], module: 'monitoring', category: 'monitoring', description: 'Show monitoring dashboard', examples: ['/monitor'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'livehealth', aliases: ['healthlive', 'realtimehealth'], module: 'monitoring', category: 'monitoring', description: 'Show real-time health status', examples: ['/livehealth'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'cicd', aliases: ['pipeline'], module: 'cicd', category: 'cicd', description: 'Show CI/CD pipeline status', examples: ['/cicd'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'cicd_status', aliases: ['statuspipeline', 'cicdstatus'], module: 'cicd', category: 'cicd', description: 'Show CI/CD status detail', examples: ['/cicd_status'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'github_actions', aliases: ['ghactions', 'githubactions'], module: 'cicd', category: 'cicd', description: 'Show GitHub Actions status', examples: ['/github_actions'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'githubops', aliases: ['ghops'], module: 'githubops', category: 'githubops', description: 'Show GitHub Ops overview', examples: ['/githubops'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'gitstatus', aliases: ['git', 'statusgit'], module: 'githubops', category: 'githubops', description: 'Show git repository status', examples: ['/gitstatus'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'changes', aliases: ['perubahan', 'diff'], module: 'githubops', category: 'githubops', description: 'Show recent changes', examples: ['/changes'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'secretscan', aliases: ['scansecret', 'cekkebocoran'], module: 'githubops', category: 'githubops', description: 'Scan for secrets in recent changes', examples: ['/secretscan'], riskLevel: 'read_only', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'commitplan', aliases: ['rencanacommit'], module: 'githubops', category: 'githubops', description: 'Create a commit plan', examples: ['/commitplan'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'pushplan', aliases: ['rencanapush'], module: 'githubops', category: 'githubops', description: 'Create a push plan', examples: ['/pushplan'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'propose_push', aliases: ['usulpush'], module: 'githubops', category: 'githubops', description: 'Propose a git push', examples: ['/propose_push'], riskLevel: 'high', requiresOwner: true, requiresAdmin: false, requiresApproval: true, requiresEvaluation: true, enabled: true },
  { name: 'github_workflows', aliases: ['ghworkflows'], module: 'githubops', category: 'githubops', description: 'List GitHub workflows', examples: ['/github_workflows'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'workflow_runs', aliases: ['ghruns'], module: 'githubops', category: 'githubops', description: 'List GitHub workflow runs', examples: ['/workflow_runs'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'propose_workflow_run', aliases: ['usulghrun'], module: 'githubops', category: 'githubops', description: 'Propose running a GitHub workflow', examples: ['/propose_workflow_run <workflowId>'], riskLevel: 'high', requiresOwner: true, requiresAdmin: false, requiresApproval: true, requiresEvaluation: true, enabled: true },
  { name: 'releasegate', aliases: ['gerbangrilis'], module: 'githubops', category: 'githubops', description: 'Check release gate status', examples: ['/releasegate'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'deploy', aliases: ['sebar'], module: 'deploy', category: 'deploy', description: 'Show deploy overview', examples: ['/deploy'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'deploycheck', aliases: ['cekdeploy'], module: 'deploy', category: 'deploy', description: 'Check deploy readiness', examples: ['/deploycheck'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'rendercheck', aliases: ['cekrender'], module: 'deploy', category: 'deploy', description: 'Check Render deployment status', examples: ['/rendercheck'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'envcheck', aliases: ['cekenv', 'environment'], module: 'deploy', category: 'deploy', description: 'Check environment variables (no secrets)', examples: ['/envcheck'], riskLevel: 'read_only', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'releasecandidates', aliases: ['kandidatrilis', 'rc'], module: 'deploy', category: 'deploy', description: 'List release candidates', examples: ['/releasecandidates'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'deployplan', aliases: ['rencanadeploy'], module: 'deploy', category: 'deploy', description: 'Create a deploy plan', examples: ['/deployplan'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'propose_deploy', aliases: ['usuldeploy'], module: 'deploy', category: 'deploy', description: 'Propose a deploy to Render', examples: ['/propose_deploy'], riskLevel: 'high', requiresOwner: true, requiresAdmin: false, requiresApproval: true, requiresEvaluation: true, enabled: true },
  { name: 'postdeploycheck', aliases: ['cekpostdeploy'], module: 'deploy', category: 'deploy', description: 'Run post-deploy health check', examples: ['/postdeploycheck'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'rollbackplan', aliases: ['rencanarollback'], module: 'deploy', category: 'deploy', description: 'Create a rollback plan', examples: ['/rollbackplan'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'propose_rollback', aliases: ['usulrollback'], module: 'deploy', category: 'deploy', description: 'Propose a rollback', examples: ['/propose_rollback'], riskLevel: 'high', requiresOwner: true, requiresAdmin: false, requiresApproval: true, requiresEvaluation: true, enabled: true },
  { name: 'prodhealth', aliases: ['kesehatanproduksi', 'ph'], module: 'observability', category: 'observability', description: 'Check production health', examples: ['/prodhealth'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'incidents', aliases: ['insiden', 'kejadian'], module: 'observability', category: 'observability', description: 'List incidents', examples: ['/incidents'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'incident', aliases: ['detailinsiden'], module: 'observability', category: 'observability', description: 'Show incident details', examples: ['/incident <id>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'analyze_incident', aliases: ['analisainsiden'], module: 'observability', category: 'observability', description: 'Analyze an incident', examples: ['/analyze_incident <id>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'incident_timeline', aliases: ['kronologiinsiden'], module: 'observability', category: 'observability', description: 'Show incident timeline', examples: ['/incident_timeline <id>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'responseplan', aliases: ['rencanarespons'], module: 'observability', category: 'observability', description: 'Show or create incident response plan', examples: ['/responseplan <id>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'propose_incident_repair', aliases: ['usulperbaikaninsiden'], module: 'observability', category: 'observability', description: 'Propose incident repair', examples: ['/propose_incident_repair <id>'], riskLevel: 'high', requiresOwner: true, requiresAdmin: false, requiresApproval: true, requiresEvaluation: true, enabled: true },
  { name: 'propose_incident_rollback', aliases: ['usulrollbackinsiden'], module: 'observability', category: 'observability', description: 'Propose incident rollback', examples: ['/propose_incident_rollback <id>'], riskLevel: 'high', requiresOwner: true, requiresAdmin: false, requiresApproval: true, requiresEvaluation: true, enabled: true },
  { name: 'close_incident', aliases: ['tutupinsiden'], module: 'observability', category: 'observability', description: 'Close an incident', examples: ['/close_incident <id>'], riskLevel: 'medium', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'usage', aliases: ['pemakaian'], module: 'cost', category: 'cost', description: 'Show token/usage summary', examples: ['/usage'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'tokens', aliases: ['token', 'tokenusage'], module: 'cost', category: 'cost', description: 'Show token usage details', examples: ['/tokens'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'cost', aliases: ['biaya'], module: 'cost', category: 'cost', description: 'Show cost summary', examples: ['/cost'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'budget', aliases: ['anggaran'], module: 'cost', category: 'cost', description: 'Show budget status', examples: ['/budget'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'budget_set', aliases: ['aturanggaran'], module: 'cost', category: 'cost', description: 'Set budget limits', examples: ['/budget_set <limit>'], riskLevel: 'medium', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'modelusage', aliases: ['usagemodel'], module: 'cost', category: 'cost', description: 'Show per-model usage', examples: ['/modelusage'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'agentusage', aliases: ['usageagen'], module: 'cost', category: 'cost', description: 'Show per-agent usage', examples: ['/agentusage'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'costalerts', aliases: ['peringatanbiaya'], module: 'cost', category: 'cost', description: 'Show cost alerts', examples: ['/costalerts'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'economymode', aliases: ['hemat', 'economy'], module: 'cost', category: 'cost', description: 'Toggle economy mode', examples: ['/economymode'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'qualitymode', aliases: ['kualitas', 'quality'], module: 'cost', category: 'cost', description: 'Toggle quality mode', examples: ['/qualitymode'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'compressprompt', aliases: ['kompresprompt'], module: 'cost', category: 'cost', description: 'Toggle prompt compression', examples: ['/compressprompt'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'operator', aliases: ['operators'], module: 'operator', category: 'operator', description: 'Show operator overview', examples: ['/operator'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'goal', aliases: ['detailgoal', 'detailtujuan'], module: 'operator', category: 'operator', description: 'Show goal details', examples: ['/goal <id>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'newgoal', aliases: ['goalbarn', 'tujuanbaru'], module: 'operator', category: 'operator', description: 'Create a new goal', examples: ['/newgoal <description>'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'operatorplan', aliases: ['rencanaoperator'], module: 'operator', category: 'operator', description: 'Show operator plan', examples: ['/operatorplan'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'operatortasks', aliases: ['tugasoperator'], module: 'operator', category: 'operator', description: 'Show operator tasks', examples: ['/operatortasks'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'nextaction', aliases: ['aksiberikutnya'], module: 'operator', category: 'operator', description: 'Show next operator action', examples: ['/nextaction'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'projectstatus', aliases: ['statusproyek'], module: 'operator', category: 'operator', description: 'Show project status', examples: ['/projectstatus'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'operatorreport', aliases: ['laporanoperator'], module: 'operator', category: 'operator', description: 'Generate operator report', examples: ['/operatorreport'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'operatorproposal', aliases: ['usuloperator'], module: 'operator', category: 'operator', description: 'Create operator proposal', examples: ['/operatorproposal <action>'], riskLevel: 'medium', requiresOwner: true, requiresAdmin: false, requiresApproval: true, requiresEvaluation: true, enabled: true },
  { name: 'portfolio', aliases: ['portofolio'], module: 'portfolio', category: 'portfolio', description: 'Show portfolio overview', examples: ['/portfolio'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'projects', aliases: ['proyek'], module: 'portfolio', category: 'portfolio', description: 'List all projects', examples: ['/projects'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'projecthealth', aliases: ['kesehatanproyek'], module: 'portfolio', category: 'portfolio', description: 'Show project health', examples: ['/projecthealth <id>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'nextproject', aliases: ['proyekberikutnya'], module: 'portfolio', category: 'portfolio', description: 'Show next recommended project', examples: ['/nextproject'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'portfolio_next', aliases: ['nextportofolio'], module: 'portfolio', category: 'portfolio', description: 'Show next portfolio action', examples: ['/portfolio_next'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'weeklyplan', aliases: ['rencanamingguan'], module: 'portfolio', category: 'portfolio', description: 'Show weekly portfolio plan', examples: ['/weeklyplan'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'monthlyplan', aliases: ['rencanabulanan'], module: 'portfolio', category: 'portfolio', description: 'Show monthly portfolio plan', examples: ['/monthlyplan'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'staleprojects', aliases: ['proyekmandek'], module: 'portfolio', category: 'portfolio', description: 'Show stale projects', examples: ['/staleprojects'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'projectrisks', aliases: ['risikoproyek'], module: 'portfolio', category: 'portfolio', description: 'Show project risks', examples: ['/projectrisks'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'portfolioreport', aliases: ['laporanportofolio'], module: 'portfolio', category: 'portfolio', description: 'Generate portfolio report', examples: ['/portfolioreport'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'portfolio_proposal', aliases: ['usulportofolio'], module: 'portfolio', category: 'portfolio', description: 'Create portfolio proposal', examples: ['/portfolio_proposal <action>'], riskLevel: 'medium', requiresOwner: true, requiresAdmin: false, requiresApproval: true, requiresEvaluation: true, enabled: true },
  { name: 'knowledge', aliases: ['pengetahuan'], module: 'knowledge', category: 'knowledge', description: 'Show knowledge overview', examples: ['/knowledge'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'kg', aliases: ['knowledgegraph'], module: 'knowledge', category: 'knowledge', description: 'Show knowledge graph', examples: ['/kg'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'remember_project', aliases: ['ingatproyek'], module: 'knowledge', category: 'knowledge', description: 'Remember project context', examples: ['/remember_project <key=value>'], riskLevel: 'low', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'decision_memory', aliases: ['memorikeputusan'], module: 'knowledge', category: 'knowledge', description: 'Show decision memory', examples: ['/decision_memory'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'project_context', aliases: ['konteksproyek'], module: 'knowledge', category: 'knowledge', description: 'Get project context', examples: ['/project_context <project>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'phase_context', aliases: ['konteksfase'], module: 'knowledge', category: 'knowledge', description: 'Get phase context', examples: ['/phase_context <phase>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'incident_context', aliases: ['konteksinsiden'], module: 'knowledge', category: 'knowledge', description: 'Get incident context', examples: ['/incident_context <id>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'knowledge_search', aliases: ['caripengetahuan'], module: 'knowledge', category: 'knowledge', description: 'Search knowledge', examples: ['/knowledge_search <query>'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'memory_review', aliases: ['reviewmemori'], module: 'knowledge', category: 'knowledge', description: 'Review memory quality', examples: ['/memory_review'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'memory_cleanup', aliases: ['bersihkanmemori'], module: 'knowledge', category: 'knowledge', description: 'Clean up duplicate/stale memory', examples: ['/memory_cleanup'], riskLevel: 'medium', requiresOwner: true, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'docs_status', aliases: ['statusdokumen'], module: 'knowledge', category: 'knowledge', description: 'Show documentation status', examples: ['/docs_status'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'contextpack', aliases: ['paketkonteks'], module: 'knowledge', category: 'knowledge', description: 'Get context pack for agent handoff', examples: ['/contextpack'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'lifeos', aliases: ['life', 'hidup'], module: 'lifeos', category: 'lifeos', description: 'Show Life OS overview', examples: ['/lifeos'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'daily', aliases: ['harian'], module: 'lifeos', category: 'lifeos', description: 'Show or create daily plan', examples: ['/daily'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'weekly', aliases: ['mingguan'], module: 'lifeos', category: 'lifeos', description: 'Show or create weekly plan', examples: ['/weekly'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'today', aliases: ['hariini'], module: 'lifeos', category: 'lifeos', description: 'Show today plan', examples: ['/today'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'tasks', aliases: ['tugas'], module: 'lifeos', category: 'lifeos', description: 'List personal tasks', examples: ['/tasks'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'taskdone', aliases: ['tugasselesai'], module: 'lifeos', category: 'lifeos', description: 'Mark a task as done', examples: ['/taskdone <id>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'habits', aliases: ['kebiasaan'], module: 'lifeos', category: 'lifeos', description: 'Show habit tracker', examples: ['/habits'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'habitcheck', aliases: ['cekkebiasaan'], module: 'lifeos', category: 'lifeos', description: 'Check in a habit', examples: ['/habitcheck <id>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'reminders', aliases: ['pengingat'], module: 'lifeos', category: 'lifeos', description: 'Show reminders', examples: ['/reminders'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'focus', aliases: ['fokus'], module: 'lifeos', category: 'lifeos', description: 'Show focus sessions', examples: ['/focus'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'mood', aliases: ['suasana'], module: 'lifeos', category: 'lifeos', description: 'Log your mood', examples: ['/mood <feeling>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'energy', aliases: ['energi'], module: 'lifeos', category: 'lifeos', description: 'Log your energy level', examples: ['/energy <level>'], riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'lifegoals', aliases: ['tujuanhidup'], module: 'lifeos', category: 'lifeos', description: 'Show life goals', examples: ['/lifegoals'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'lifereport', aliases: ['laporanhidup'], module: 'lifeos', category: 'lifeos', description: 'Generate life report', examples: ['/lifereport'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true },
  { name: 'eveningreview', aliases: ['reviewmalam'], module: 'lifeos', category: 'lifeos', description: 'Run evening review', examples: ['/eveningreview'], riskLevel: 'read_only', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, enabled: true }
];

let registry = [...BUILTIN_COMMANDS];
let commandIndex = null;

function buildCommandIndex() {
  const index = {};
  for (const cmd of registry) {
    index[cmd.name] = cmd;
    if (cmd.aliases && Array.isArray(cmd.aliases)) {
      for (const alias of cmd.aliases) {
        index[alias] = cmd;
      }
    }
  }
  commandIndex = index;
  return index;
}

function registerTelegramCommand(commandDef) {
  if (!commandDef || !commandDef.name) {
    throw new Error('Command definition must have a name');
  }
  const existing = registry.findIndex(c => c.name === commandDef.name);
  if (existing >= 0) {
    registry[existing] = { ...registry[existing], ...commandDef };
  } else {
    registry.push({
      name: commandDef.name,
      aliases: commandDef.aliases || [],
      module: commandDef.module || 'custom',
      category: commandDef.category || 'core',
      description: commandDef.description || '',
      examples: commandDef.examples || [],
      riskLevel: commandDef.riskLevel || 'read_only',
      requiresOwner: commandDef.requiresOwner || false,
      requiresAdmin: commandDef.requiresAdmin || false,
      requiresApproval: commandDef.requiresApproval || false,
      requiresEvaluation: commandDef.requiresEvaluation || false,
      handler: commandDef.handler || null,
      enabled: commandDef.enabled !== false,
      createdAt: commandDef.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  commandIndex = null;
  return true;
}

function getTelegramCommand(name) {
  if (!name) return null;
  const clean = name.replace(/^\//, '').toLowerCase().trim();
  if (!commandIndex) buildCommandIndex();
  return commandIndex[clean] || null;
}

function listTelegramCommands(filters) {
  let result = [...registry];
  if (filters) {
    if (filters.category) {
      result = result.filter(c => c.category === filters.category);
    }
    if (filters.module) {
      result = result.filter(c => c.module === filters.module);
    }
    if (filters.riskLevel) {
      result = result.filter(c => c.riskLevel === filters.riskLevel);
    }
    if (filters.enabled !== undefined) {
      result = result.filter(c => c.enabled === filters.enabled);
    }
    if (filters.requiresOwner !== undefined) {
      result = result.filter(c => c.requiresOwner === filters.requiresOwner);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.aliases || []).some(a => a.toLowerCase().includes(q))
      );
    }
  }
  return result;
}

function findTelegramCommandByIntent(intent) {
  if (!intent) return null;
  const q = intent.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;
  for (const cmd of registry) {
    let score = 0;
    if (cmd.name.toLowerCase() === q) score = 100;
    else if ((cmd.aliases || []).some(a => a.toLowerCase() === q)) score = 90;
    else if (cmd.description.toLowerCase().includes(q)) score = 30;
    else if (q.includes(cmd.name.toLowerCase())) score = 20;
    else if ((cmd.aliases || []).some(a => q.includes(a.toLowerCase()))) score = 15;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cmd;
    }
  }
  return bestScore >= 15 ? bestMatch : null;
}

function validateTelegramCommandRegistry() {
  const issues = [];
  const names = new Set();
  for (const cmd of registry) {
    if (names.has(cmd.name)) {
      issues.push({ type: 'duplicate', name: cmd.name, message: `Duplicate command name: /${cmd.name}` });
    }
    names.add(cmd.name);
    if (!cmd.description) {
      issues.push({ type: 'missing_description', name: cmd.name, message: `Command /${cmd.name} has no description` });
    }
    if (!RISK_LEVELS[cmd.riskLevel] && cmd.riskLevel !== 'read_only') {
      issues.push({ type: 'invalid_risk', name: cmd.name, message: `Command /${cmd.name} has invalid risk level: ${cmd.riskLevel}` });
    }
    if (!cmd.category) {
      issues.push({ type: 'missing_category', name: cmd.name, message: `Command /${cmd.name} has no category` });
    }
  }
  return { valid: issues.length === 0, issues, totalCommands: registry.length };
}

function getCategories() {
  return Object.entries(COMMAND_CATEGORIES).map(([key, label]) => ({
    key,
    label,
    count: registry.filter(c => c.category === key).length
  }));
}

function getAllAliases(name) {
  const cmd = getTelegramCommand(name);
  if (!cmd) return [];
  return [cmd.name, ...(cmd.aliases || [])];
}

module.exports = {
  COMMAND_CATEGORIES,
  RISK_LEVELS,
  BUILTIN_COMMANDS,
  registerTelegramCommand,
  getTelegramCommand,
  listTelegramCommands,
  findTelegramCommandByIntent,
  validateTelegramCommandRegistry,
  buildCommandIndex,
  getCategories,
  getAllAliases
};
