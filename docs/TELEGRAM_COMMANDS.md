# Telegram Commands Reference

174 built-in commands across 20 categories. Risk levels: 📖 read_only, 🟢 low, 🟡 medium, 🟠 high, 🔴 danger. 👑 = owner only.

---

## Core (11 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/start` | mulai | Start the bot and show welcome message | 📖 | - | - | - |
| `/help` | bantuan, tolong | Show help menu or help for a specific command | 📖 | - | - | - |
| `/menu` | mainmenu | Show main command menu | 📖 | - | - | - |
| `/status` | stats, server | Show bot and system status | 📖 | - | - | - |
| `/health` | ping, live | Health check the bot | 📖 | - | - | - |
| `/whoami` | me, saya | Show your user info and permissions | 📖 | - | - | - |
| `/telegramcheck` | tgcheck | Diagnose Telegram runtime message normalization and routing | 📖 | - | - | - |
| `/webhookcheck` | webhook_check | Diagnose Telegram webhook route and multi-bot mapping safely | 📖 | - | - | - |
| `/messagecheck` | msgcheck | Show the normalized current Telegram message without secrets | 📖 | - | - | - |
| `/settings` | config, set | Show or update bot settings | 🟢 | 👑 | - | - |

## Agents (10 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/agents` | bots, dafataragen | List all registered agents | 📖 | - | - | - |
| `/agent` | bot, agen | View details about a specific agent | 📖 | - | - | - |
| `/router` | routing | Show agent routing configuration | 📖 | - | - | - |
| `/botmapping` | mapping, botmap | Show bot-to-agent mapping | 📖 | - | - | - |
| `/multibot` | multibots | List multi-bot configuration | 📖 | - | - | - |
| `/multibot_on` | multiboton | Enable multi-bot mode | 🟢 | 👑 | - | - |
| `/multibot_off` | multibotoff | Disable multi-bot mode | 🟢 | 👑 | - | - |
| `/visibleagents` | visible, visiblebots | Show visible agents in chat | 📖 | - | - | - |
| `/council` | dewan | Call agent council for discussion | 🟢 | - | - | - |
| `/debate` | perdebatan | Start agent debate on a topic | 🟢 | - | - | - |
| `/riskreview` | risk, reviewrisk | Review risk of a proposed action | 📖 | - | - | - |

## Executor (7 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/executions` | execs, exec, daftarexec | List recent and pending executions | 📖 | - | - | - |
| `/pending` | pendingexec, menunggu | Show pending executions | 📖 | - | - | - |
| `/propose` | usul, proposalbaru | Create a new proposal for an action | 🟢 | - | - | - |
| `/approve` | setuju, acc, izinkan | Approve a pending proposal | 🟠 | 👑 | - | - |
| `/reject` | tolak, batal | Reject a pending proposal | 🟡 | 👑 | - | - |
| `/runexec` | jalankan, run, execnow | Run an approved proposal | 🔴 | 👑 | - | - |
| `/cancel_exec` | batalkan, cancel | Cancel a pending execution | 🟡 | 👑 | - | - |

## Dashboard (3 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/dbstatus` | db, database, pgstatus | Show database connection status | 📖 | - | - | - |
| `/redisstatus` | redis, redischeck | Show Redis connection status | 📖 | - | - | - |
| `/dashboard` | panel, adminpanel | Show dashboard access info | 📖 | - | - | - |
| `/audit` | log, catatan | Show recent audit log entries | 📖 | - | - | - |

## Goals / Planner (5 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/plans` | rencana, semuarencana | List all plans | 📖 | - | - | - |
| `/goals` | tujuan, target | List all goals | 📖 | - | - | - |
| `/workflows` | alurkerja, alur | List workflows | 📖 | - | - | - |
| `/next` | selanjutnya | Show next planned action | 📖 | - | - | - |
| `/priorities` | prioritas, skala | Show priority list | 📖 | - | - | - |

## Backup (6 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/backup` | cadangan | Show backup overview | 📖 | - | - | - |
| `/backupcreate` | buatcadangan, backupbaru | Create a new backup | 🟡 | 👑 | ✅ | ✅ |
| `/backups` | daftarcadangan | List all backups | 📖 | - | - | - |
| `/backupstatus` | statuscadangan | Show backup system status | 📖 | - | - | - |
| `/recovery` | pulihkan, restore | Show recovery options | 📖 | 👑 | - | - |
| `/integrity` | cekintegritas, cekbackup | Check backup integrity | 📖 | - | - | - |

## Integrations (6 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/integrations` | integrasi, connectors | List active integrations | 📖 | - | - | - |
| `/connectors` | konektor | List all connectors | 📖 | - | - | - |
| `/connector_status` | statuskonektor, connectorstatus | Show a connector status | 📖 | - | - | - |
| `/credstatus` | kredensial, credentialstatus | Show credential status (no secrets) | 📖 | 👑 | - | - |
| `/integration_pipeline` | pipelineintegrasi, integrationpipeline | Show integration pipeline status | 📖 | - | - | - |
| `/integration_eval` | evalintegrasi, integrationeval | Run integration evaluation gate | 🟢 | - | - | - |

## Coding (6 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/coding` | koding, code | Show coding workspace status | 📖 | - | - | - |
| `/codereq` | codingreq, permintaan_kode | Request a coding task | 🟢 | - | - | - |
| `/codeplan` | rencanakode, codingplan | Create a code change plan | 🟢 | - | - | - |
| `/codetasks` | tugaskode, codingtasks | List coding tasks | 📖 | - | - | - |
| `/codeprompt` | promptkode, codingprompt | Generate a coding prompt | 🟢 | - | - | - |
| `/testplan` | rencanates, testingplan | Generate a test plan | 🟢 | - | - | - |
| `/riskreview_code` | riskkode, codereview | Review risk of a coding change | 📖 | - | - | - |

## Routines (7 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/routines` | rutinitas | List all routines | 📖 | - | - | - |
| `/routine` | rutin | Show routine details | 📖 | - | - | - |
| `/routine_on` | rutinnyala, routinestart | Enable a routine | 🟢 | 👑 | - | - |
| `/routine_off` | rutinmati, routinestop | Disable a routine | 🟢 | 👑 | - | - |
| `/runroutine` | jalankanrutin | Run a routine now | 🟡 | 👑 | ✅ | - |
| `/dryrunroutine` | ujirutin, dryrun | Dry-run a routine without executing | 🟢 | 👑 | - | - |
| `/briefing` | ringkasan | Get daily briefing | 📖 | - | - | - |
| `/dailybrief` | briefharian | Get daily briefing | 📖 | - | - | - |

## Self-Healing (6 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/selfheal` | sembuhkan, heal | Run self-healing check | 🟢 | 👑 | - | - |
| `/healthcheck` | cekkesehatan | Run health check suite | 📖 | - | - | - |
| `/regressioncheck` | cekregresi | Run regression check | 📖 | - | - | - |
| `/dashboardcheck` | cekdashboard | Check dashboard health | 📖 | - | - | - |
| `/repairplans` | rencanperbaikan | List repair plans | 📖 | - | - | - |
| `/repairprompt` | promptperbaikan | Generate repair prompt | 📖 | - | - | - |

## Monitoring (2 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/monitor` | pantau | Show monitoring dashboard | 📖 | - | - | - |
| `/livehealth` | healthlive, realtimehealth | Show real-time health status | 📖 | - | - | - |

## CI/CD (3 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/cicd` | pipeline | Show CI/CD pipeline status | 📖 | - | - | - |
| `/cicd_status` | statuspipeline, cicdstatus | Show CI/CD status detail | 📖 | - | - | - |
| `/github_actions` | ghactions, githubactions | Show GitHub Actions status | 📖 | - | - | - |

## GitHub Ops (11 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/githubops` | ghops | Show GitHub Ops overview | 📖 | - | - | - |
| `/gitstatus` | git, statusgit | Show git repository status | 📖 | - | - | - |
| `/changes` | perubahan, diff | Show recent changes | 📖 | - | - | - |
| `/secretscan` | scansecret, cekkebocoran | Scan for secrets in recent changes | 📖 | 👑 | - | - |
| `/commitplan` | rencanacommit | Create a commit plan | 🟢 | 👑 | - | - |
| `/pushplan` | rencanapush | Create a push plan | 🟢 | 👑 | - | - |
| `/propose_push` | usulpush | Propose a git push | 🟠 | 👑 | ✅ | ✅ |
| `/github_workflows` | ghworkflows | List GitHub workflows | 📖 | - | - | - |
| `/workflow_runs` | ghruns | List GitHub workflow runs | 📖 | - | - | - |
| `/propose_workflow_run` | usulghrun | Propose running a GitHub workflow | 🟠 | 👑 | ✅ | ✅ |
| `/releasegate` | gerbangrilis | Check release gate status | 📖 | - | - | - |

## Deploy (10 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/deploy` | sebar | Show deploy overview | 📖 | - | - | - |
| `/deploycheck` | cekdeploy | Check deploy readiness | 📖 | - | - | - |
| `/rendercheck` | cekrender | Check Render deployment status | 📖 | - | - | - |
| `/envcheck` | ceken环境, environment | Check environment variables (no secrets) | 📖 | 👑 | - | - |
| `/releasecandidates` | kandidatrilis, rc | List release candidates | 📖 | - | - | - |
| `/deployplan` | rencanadeploy | Create a deploy plan | 🟢 | 👑 | - | - |
| `/propose_deploy` | usuldeploy | Propose a deploy to Render | 🟠 | 👑 | ✅ | ✅ |
| `/postdeploycheck` | cekpostdeploy | Run post-deploy health check | 🟢 | 👑 | - | - |
| `/rollbackplan` | rencanarollback | Create a rollback plan | 🟢 | 👑 | - | - |
| `/propose_rollback` | usulrollback | Propose a rollback | 🟠 | 👑 | ✅ | ✅ |

## Observability (8 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/prodhealth` | kesehatanproduksi, ph | Check production health | 📖 | - | - | - |
| `/incidents` | insiden, kejadian | List incidents | 📖 | - | - | - |
| `/incident` | detailinsiden | Show incident details | 📖 | - | - | - |
| `/analyze_incident` | analisainsiden | Analyze an incident | 📖 | - | - | - |
| `/incident_timeline` | kronologiinsiden | Show incident timeline | 📖 | - | - | - |
| `/responseplan` | rencanarespons | Show or create incident response plan | 📖 | - | - | - |
| `/propose_incident_repair` | usulperbaikaninsiden | Propose incident repair | 🟠 | 👑 | ✅ | ✅ |
| `/propose_incident_rollback` | usulrollbackinsiden | Propose incident rollback | 🟠 | 👑 | ✅ | ✅ |
| `/close_incident` | tutupinsiden | Close an incident | 🟡 | 👑 | - | - |

## Cost (9 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/usage` | pemakaian | Show token/usage summary | 📖 | - | - | - |
| `/tokens` | token, tokenusage | Show token usage details | 📖 | - | - | - |
| `/cost` | biaya | Show cost summary | 📖 | - | - | - |
| `/budget` | anggaran | Show budget status | 📖 | - | - | - |
| `/budget_set` | aturanggaran | Set budget limits | 🟡 | 👑 | - | - |
| `/modelusage` | usagemodel | Show per-model usage | 📖 | - | - | - |
| `/agentusage` | usageagen | Show per-agent usage | 📖 | - | - | - |
| `/costalerts` | peringatanbiaya | Show cost alerts | 📖 | - | - | - |
| `/economymode` | hemat, economy | Toggle economy mode | 🟢 | 👑 | - | - |
| `/qualitymode` | kualitas, quality | Toggle quality mode | 🟢 | 👑 | - | - |
| `/compressprompt` | kompresprompt | Toggle prompt compression | 🟢 | 👑 | - | - |

## Operator (8 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/operator` | operators | Show operator overview | 📖 | - | - | - |
| `/goal` | detailgoal, detailtujuan | Show goal details | 📖 | - | - | - |
| `/newgoal` | goalbarn, tujuanbaru | Create a new goal | 🟢 | 👑 | - | - |
| `/operatorplan` | rencanaoperator | Show operator plan | 📖 | - | - | - |
| `/operatortasks` | tugasoperator | Show operator tasks | 📖 | - | - | - |
| `/nextaction` | aksiberikutnya | Show next operator action | 📖 | - | - | - |
| `/projectstatus` | statusproyek | Show project status | 📖 | - | - | - |
| `/operatorreport` | laporanoperator | Generate operator report | 📖 | - | - | - |
| `/operatorproposal` | usuloperator | Create operator proposal | 🟡 | 👑 | ✅ | ✅ |

## Portfolio (11 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/portfolio` | portofolio | Show portfolio overview | 📖 | - | - | - |
| `/projects` | proyek | List all projects | 📖 | - | - | - |
| `/projecthealth` | kesehatanproyek | Show project health | 📖 | - | - | - |
| `/nextproject` | proyekberikutnya | Show next recommended project | 📖 | - | - | - |
| `/portfolio_next` | nextportofolio | Show next portfolio action | 📖 | - | - | - |
| `/weeklyplan` | rencanamingguan | Show weekly portfolio plan | 📖 | - | - | - |
| `/monthlyplan` | rencanabulanan | Show monthly portfolio plan | 📖 | - | - | - |
| `/staleprojects` | proyekmandek | Show stale projects | 📖 | - | - | - |
| `/projectrisks` | riskoproyek | Show project risks | 📖 | - | - | - |
| `/portfolioreport` | laporanportofolio | Generate portfolio report | 📖 | - | - | - |
| `/portfolio_proposal` | usulportofolio | Create portfolio proposal | 🟡 | 👑 | ✅ | ✅ |

## Knowledge (12 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/knowledge` | pengetahuan | Show knowledge overview | 📖 | - | - | - |
| `/kg` | knowledgegraph | Show knowledge graph | 📖 | - | - | - |
| `/remember_project` | ingatproyek | Remember project context | 🟢 | 👑 | - | - |
| `/decision_memory` | memorikeputusan | Show decision memory | 📖 | - | - | - |
| `/project_context` | konteksproyek | Get project context | 📖 | - | - | - |
| `/phase_context` | konteksfase | Get phase context | 📖 | - | - | - |
| `/incident_context` | konteksinsiden | Get incident context | 📖 | - | - | - |
| `/knowledge_search` | caripengetahuan | Search knowledge | 📖 | - | - | - |
| `/memory_review` | reviewmemori | Review memory quality | 📖 | - | - | - |
| `/memory_cleanup` | bersihkanmemori | Clean up duplicate/stale memory | 🟡 | 👑 | - | - |
| `/docs_status` | statusdokumen | Show documentation status | 📖 | - | - | - |
| `/contextpack` | paketkonteks | Get context pack for agent handoff | 📖 | - | - | - |

## Life OS (16 commands)

| Command | Aliases | Description | Risk | Owner | Approval | Eval |
|---------|---------|-------------|------|-------|----------|------|
| `/lifeos` | life, hidup | Show Life OS overview | 📖 | - | - | - |
| `/daily` | harian | Show or create daily plan | 📖 | - | - | - |
| `/weekly` | mingguan | Show or create weekly plan | 📖 | - | - | - |
| `/today` | hariini | Show today plan | 📖 | - | - | - |
| `/tasks` | tugas | List personal tasks | 📖 | - | - | - |
| `/taskdone` | tugasselesai | Mark a task as done | 🟢 | - | - | - |
| `/habits` | kebiasaan | Show habit tracker | 📖 | - | - | - |
| `/habitcheck` | cekkebiasaan | Check in a habit | 🟢 | - | - | - |
| `/reminders` | pengingat | Show reminders | 📖 | - | - | - |
| `/focus` | fokus | Show focus sessions | 📖 | - | - | - |
| `/mood` | suasana | Log your mood | 🟢 | - | - | - |
| `/energy` | energi | Log your energy level | 🟢 | - | - | - |
| `/lifegoals` | tujuanhidup | Show life goals | 📖 | - | - | - |
| `/lifereport` | laporanhidup | Generate life report | 📖 | - | - | - |
| `/eveningreview` | reviewmalam | Run evening review | 📖 | - | - | - |

## Security Notes

- **Approval required**: `/runroutine`, `/backupcreate`, `/propose_push`, `/propose_workflow_run`, `/propose_deploy`, `/propose_rollback`, `/propose_incident_repair`, `/propose_incident_rollback`, `/operatorproposal`, `/portfolio_proposal`
- **Evaluation required**: Same set as approval — high/danger commands require Evaluation v2 gate
- **Owner-only (👑)**: All approval-required commands, settings, budget changes, secret scanning, commit/push plans, deploy ops, Life OS management
- **No auto-approve**: No command auto-approves itself. `/approve` and `/runexec` are separate explicit steps
