# Legacy Runtime Audit — `src/bot/legacy-runtime.js`

**File**: `src/bot/legacy-runtime.js`  
**Ukuran**: 12.620 baris / ~414KB  
**Status**: Monolitik — semua logika bot dalam satu file  
**Entry point**: Dipanggil dari `src/bot/legacy-adapter.js` → `src/bot/app.js` → `telebot.js`

---

## Ringkasan

| Domain | Jumlah Fungsi | SUDAH ADA MODUL | BELUM DIMIGRASI | DUPLIKAT |
|--------|:---:|:---:|:---:|:---:|
| Utility & Helpers | 25 | 3 | 20 | 2 |
| Storage & Persistence | 12 | 6 | 4 | 2 |
| AI Pipeline | 12 | 4 | 6 | 2 |
| Telegram API & Messaging | 7 | 2 | 5 | 0 |
| Web Search & External API | 6 | 1 | 5 | 0 |
| Calendar & OAuth | 6 | 0 | 6 | 0 |
| Command Handlers (Core) | 15 | 2 | 13 | 0 |
| Command Handlers (AIOS/Ops) | 12 | 8 | 4 | 0 |
| Agent/Governance Handlers | 20 | 15 | 3 | 2 |
| Portfolio/Research/LifeOS | 9 | 5 | 4 | 0 |
| Natural Language Routing | 8 | 3 | 5 | 0 |
| Dashboard Helpers | 6 | 3 | 3 | 0 |
| Bot Lifecycle | 5 | 1 | 3 | 1 |
| Formatting Utilities | 25 | 10 | 15 | 0 |
| **TOTAL** | **~168** | **63** | **96** | **9** |

**Persentase migrasi**: ~37% fungsi sudah memiliki modul pengganti di `src/`  
**Estimasi kode yang bisa dihapus**: ~35-40% dari 12.620 baris setelah migrasi penuh

---

## Inventory Fungsi per Domain

### 1. Utility & Helpers (25 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `rememberWithTTL()` | [BELUM DIMIGRASI] | — |
| `cleanupMapTTL()` | [BELUM DIMIGRASI] | — |
| `getMessageKey()` | [BELUM DIMIGRASI] | — |
| `isDuplicateIncomingUpdate()` | [BELUM DIMIGRASI] | — |
| `withUserActionLock()` | [BELUM DIMIGRASI] | — |
| `cleanupPatch4State()` | [BELUM DIMIGRASI] | — |
| `nowMs()` | [BELUM DIMIGRASI] | — |
| `isValidDate()` | [BELUM DIMIGRASI] | — |
| `safeLower()` | [BELUM DIMIGRASI] | — |
| `normalizeId()` | [BELUM DIMIGRASI] | — |
| `sleep()` | [SUDAH ADA MODUL] | `src/utils/retry.js` (setTimeout wrapper) |
| `cleanupSpaces()` | [BELUM DIMIGRASI] | — |
| `escapeRegExp()` | [BELUM DIMIGRASI] | — |
| `splitText()` | [SUDAH ADA MODUL] | `src/bot/message-handler.js` (split) |
| `getCommandBase()` | [BELUM DIMIGRASI] | — |
| `getCommandArgs()` | [BELUM DIMIGRASI] | — |
| `stripCodeFences()` | [BELUM DIMIGRASI] | — |
| `extractJsonObject()` | [BELUM DIMIGRASI] | — |
| `looksLikeIntentJSON()` | [BELUM DIMIGRASI] | — |
| `sanitizeOutgoingText()` | [SUDAH ADA MODUL] | `src/ai-os/output-sanitizer.js` |
| `splitTelegramSendOptions()` | [BELUM DIMIGRASI] | — |
| `simpleDetectLanguage()` | [BELUM DIMIGRASI] | — |
| `calculate()` | [BELUM DIMIGRASI] | — |
| `calcEntropyScore()` | [BELUM DIMIGRASI] | — |
| `autoFixText()` | [BELUM DIMIGRASI] | — |

### 2. Storage & Persistence (12 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `initRedis()` | [DUPLIKAT] | `src/storage/` (redis connection) |
| `initStorage()` | [DUPLIKAT] | `src/storage/storage-manager.js` |
| `loadData()` | [SUDAH ADA MODUL] | `src/storage/json-store.js` (readJsonFile) |
| `saveData()` | [SUDAH ADA MODUL] | `src/storage/json-store.js` (writeJsonFileAtomic) |
| `saveAll()` | [SUDAH ADA MODUL] | `src/storage/json-store.js` |
| `persist()` | [SUDAH ADA MODUL] | `src/storage/json-store.js` |
| `loadAllMemories()` | [BELUM DIMIGRASI] | — |
| `cleanupStaleUserState()` | [BELUM DIMIGRASI] | — |
| `pushChatHistory()` | [BELUM DIMIGRASI] | — |
| `generateTagsFromText()` | [BELUM DIMIGRASI] | — |
| `updateUserTags()` | [BELUM DIMIGRASI] | — |
| `scoreAnswerQuality()` | [BELUM DIMIGRASI] | — |

### 3. AI Pipeline (12 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `askMistral()` | [SUDAH ADA MODUL] | `services/ai-router.js` (Mistral provider) |
| `askGroq()` | [SUDAH ADA MODUL] | `services/ai-router.js` (Groq provider) |
| `chooseAIModel()` | [SUDAH ADA MODUL] | `src/model-router/` |
| `askAI()` | [DUPLIKAT] | `src/bot/response-pipeline.js` |
| `getAnswerWithAB()` | [BELUM DIMIGRASI] | — |
| `getSmartAnswer()` | [BELUM DIMIGRASI] | — |
| `autoSummarizeMemory()` | [BELUM DIMIGRASI] | — |
| `getCachedAnswer()` | [SUDAH ADA MODUL] | `src/core/ttl-map.js` |
| `getModePrompt()` | [BELUM DIMIGRASI] | — |
| `getEffectiveMode()` | [BELUM DIMIGRASI] | — |
| `getSystemPrompt()` | [BELUM DIMIGRASI] | — |
| `buildContext()` | [BELUM DIMIGRASI] | — |

### 4. Telegram API & Messaging (7 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `telegramPost()` | [SUDAH ADA MODUL] | `src/utils/telegram-sender.js` |
| `safeSendMessage()` | [SUDAH ADA MODUL] | `src/utils/telegram-sender.js` (sendTelegramMessage) |
| `sendChunkedMessage()` | [BELUM DIMIGRASI] | — |
| `sendPhotoUrl()` | [BELUM DIMIGRASI] | — |
| `sendPhotoBuffer()` | [BELUM DIMIGRASI] | — |
| `sendStreamingAnswer()` | [BELUM DIMIGRASI] | — |
| `downloadTelegramFile()` | [BELUM DIMIGRASI] | — |

### 5. Web Search & External API (6 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `getWeather()` | [BELUM DIMIGRASI] | — |
| `searchLocation()` | [BELUM DIMIGRASI] | — |
| `generateImage()` | [BELUM DIMIGRASI] | — |
| `searchWebTavilyRaw()` | [BELUM DIMIGRASI] | — |
| `searchWebTavily()` | [SUDAH ADA MODUL] | `services/ai-router.js` (search fallback) |
| `summarizeSearchWithRefs()` | [BELUM DIMIGRASI] | — |

### 6. Calendar & OAuth (6 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `createOAuthClient()` | [BELUM DIMIGRASI] | — |
| `getAuthUrl()` | [BELUM DIMIGRASI] | — |
| `getTokensFromCode()` | [BELUM DIMIGRASI] | — |
| `saveUserTokens()` | [BELUM DIMIGRASI] | — |
| `getUserTokens()` | [BELUM DIMIGRASI] | — |
| `getCalendarClient()` | [BELUM DIMIGRASI] | — |

### 7. Command Handlers — Core (15 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `handlePing()` | [BELUM DIMIGRASI] | — |
| `handleReset()` | [BELUM DIMIGRASI] | — |
| `handleSettings()` | [BELUM DIMIGRASI] | — |
| `handleCalibration()` | [BELUM DIMIGRASI] | — |
| `handleStats()` | [BELUM DIMIGRASI] | — |
| `handleSystemStatus()` | [BELUM DIMIGRASI] | — |
| `handleImproveStatus()` | [BELUM DIMIGRASI] | — |
| `handleHelp()` | [BELUM DIMIGRASI] | — |
| `handleSummary()` | [BELUM DIMIGRASI] | — |
| `handleMode()` | [BELUM DIMIGRASI] | — |
| `handleAlias()` | [BELUM DIMIGRASI] | — |
| `handleRiwayat()` | [BELUM DIMIGRASI] | — |
| `handleDigest()` | [BELUM DIMIGRASI] | — |
| `handleModeration()` | [BELUM DIMIGRASI] | — |
| `handleFeedback()` | [BELUM DIMIGRASI] | — |

### 8. Command Handlers — AIOS/Ops/System (12 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `handleAiosCommands()` | [SUDAH ADA MODUL] | `src/ai-os/` |
| `handleObservabilityCommands()` | [SUDAH ADA MODUL] | `src/observability/` |
| `handleSelfHealingCommands()` | [SUDAH ADA MODUL] | `src/selfhealing/` |
| `handlePhase33OpsCommands()` | [SUDAH ADA MODUL] | `src/ops/` |
| `handleOpsCommands()` | [SUDAH ADA MODUL] | `src/ops/` |
| `handleAdaptiveCommands()` | [SUDAH ADA MODUL] | `src/adaptive/` |
| `handleCollaborationCommands()` | [SUDAH ADA MODUL] | `src/collaboration/` |
| `handleTelegramControlCommands()` | [SUDAH ADA MODUL] | `src/telegram-control/` |
| `handleNaturalTelegramControlRoute()` | [SUDAH ADA MODUL] | `src/telegram-control/` |
| `handleFileCommands()` | [BELUM DIMIGRASI] | — |
| `handlePluginsList()` | [SUDAH ADA MODUL] | `src/plugins/` |
| `handleReloadPlugins()` | [BELUM DIMIGRASI] | — |

### 9. Agent & Governance Handlers (20 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `handleAgentCommands()` | [SUDAH ADA MODUL] | `src/agents/` |
| `handleNaturalAgentRoute()` | [SUDAH ADA MODUL] | `src/agents/` |
| `runCouncilTelegramCommand()` | [SUDAH ADA MODUL] | `src/agents/council/` |
| `runDelegationTelegramCommand()` | [SUDAH ADA MODUL] | `src/agents/delegation/` |
| `runDecisionTelegramCommand()` | [SUDAH ADA MODUL] | `src/governance/decision-engine.js` |
| `formatCouncilTelegramResult()` | [SUDAH ADA MODUL] | `src/agents/council/` |
| `formatAgentProfile()` | [SUDAH ADA MODUL] | `src/agents/` |
| `formatAgentMemoryList()` | [SUDAH ADA MODUL] | `src/agents/memory/` |
| `formatSharedAgentMemory()` | [SUDAH ADA MODUL] | `src/agents/memory/` |
| `formatAgentPreferences()` | [SUDAH ADA MODUL] | `src/agents/` |
| `formatDelegationTelegramResult()` | [SUDAH ADA MODUL] | `src/agents/delegation/` |
| `formatDecisionTelegramResult()` | [DUPLIKAT] | `src/governance/` |
| `formatAgentActionPlanLine()` | [DUPLIKAT] | `src/agents/` |
| `formatAgentProposalResult()` | [BELUM DIMIGRASI] | — |
| `formatIntegrationResult()` | [BELUM DIMIGRASI] | — |
| `parseIntegrationPayload()` | [BELUM DIMIGRASI] | — |
| `handleNaturalIntegrationRoute()` | [SUDAH ADA MODUL] | `src/integrations/` |
| `detectNaturalIntegrationIntent()` | [SUDAH ADA MODUL] | `src/integrations/` |
| `formatPermissionFlags()` | [SUDAH ADA MODUL] | `src/governance/permission-engine.js` |
| `formatBotStatusList()` | [BELUM DIMIGRASI] | — |

### 10. Portfolio, Research & LifeOS (9 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `handlePortfolioCommands()` | [SUDAH ADA MODUL] | `src/portfolio/` |
| `handleNaturalPortfolioRoute()` | [SUDAH ADA MODUL] | `src/portfolio/` |
| `handleResearchCommands()` | [SUDAH ADA MODUL] | `src/research/` |
| `handleNaturalResearchRoute()` | [SUDAH ADA MODUL] | `src/research/` |
| `handleLifeOsCommands()` | [SUDAH ADA MODUL] | `src/lifeos/` |
| `handleNaturalLifeOsRoute()` | [SUDAH ADA MODUL] | `src/lifeos/` |
| `formatPortfolioPriorityLine()` | [BELUM DIMIGRASI] | — |
| `formatResearchBriefForTelegram()` | [BELUM DIMIGRASI] | — |
| `formatLifeDailyPlan()` | [BELUM DIMIGRASI] | — |

### 11. Natural Language Routing (8 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `handleNaturalLanguageRoute()` | [SUDAH ADA MODUL] | `src/natural-language/natural-router.js` |
| `handleNaturalToolRoute()` | [SUDAH ADA MODUL] | `src/natural-language/natural-tool-router.js` |
| `universalNLP()` | [SUDAH ADA MODUL] | `src/natural-language/` |
| `heuristicIntent()` | [BELUM DIMIGRASI] | — |
| `executeUniversalIntent()` | [BELUM DIMIGRASI] | — |
| `askClarification()` | [BELUM DIMIGRASI] | — |
| `buildNaturalChatPrompt()` | [BELUM DIMIGRASI] | — |
| `sendNaturalLanguageAnswer()` | [BELUM DIMIGRASI] | — |

### 12. Dashboard Helpers (6 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `getDashboardBaseUrl()` | [BELUM DIMIGRASI] | — |
| `getDashboardStatusText()` | [SUDAH ADA MODUL] | `src/dashboard/dashboard-auth.js` |
| `buildDashboardInfoText()` | [SUDAH ADA MODUL] | `src/dashboard/` |
| `isRelationalStorageActive()` | [SUDAH ADA MODUL] | `src/storage/` |
| `getStorageRepositoriesSafe()` | [BELUM DIMIGRASI] | — |
| `getUsersSnapshot()` | [BELUM DIMIGRASI] | — |

### 13. Bot Lifecycle (5 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `startLegacyBotServer()` | [BELUM DIMIGRASI] | — |
| `createLegacyBotApp()` | [BELUM DIMIGRASI] | — |
| `shutdown()` | [DUPLIKAT] | `src/bot/app.js` |
| `loadPlugins()` | [SUDAH ADA MODUL] | `src/plugins/plugin-installer.js` |
| `initRedis()` | [DUPLIKAT] | `src/storage/` |

### 14. Formatting Utilities (25 fungsi)

| Fungsi | Status | Modul Pengganti |
|--------|--------|-----------------|
| `formatGoalLine()` | [SUDAH ADA MODUL] | `src/planner/` |
| `formatWorkflowLine()` | [SUDAH ADA MODUL] | `src/planner/` |
| `formatMemoryLine()` | [BELUM DIMIGRASI] | — |
| `formatInsightLine()` | [BELUM DIMIGRASI] | — |
| `formatPlanLine()` | [BELUM DIMIGRASI] | — |
| `formatTaskLine()` | [BELUM DIMIGRASI] | — |
| `formatExecutionProposalLine()` | [BELUM DIMIGRASI] | — |
| `formatExecutionActionLine()` | [BELUM DIMIGRASI] | — |
| `formatToolLine()` | [BELUM DIMIGRASI] | — |
| `formatToolResult()` | [BELUM DIMIGRASI] | — |
| `formatBackupLine()` | [SUDAH ADA MODUL] | `src/backup/` |
| `formatBackupScheduleLine()` | [SUDAH ADA MODUL] | `src/backup/` |
| `formatBackupScheduleRunLine()` | [SUDAH ADA MODUL] | `src/backup/` |
| `formatSelfHealingRunSummary()` | [SUDAH ADA MODUL] | `src/selfhealing/` |
| `formatRepairPlanBrief()` | [SUDAH ADA MODUL] | `src/selfhealing/` |
| `formatIncidentLine()` | [SUDAH ADA MODUL] | `src/observability/incident-detector.js` |
| `formatIncidentDetail()` | [SUDAH ADA MODUL] | `src/observability/incident-detector.js` |
| `formatBenchmarkRun()` | [BELUM DIMIGRASI] | — |
| `formatBenchmarkHistory()` | [BELUM DIMIGRASI] | — |
| `formatRecoveryPlan()` | [BELUM DIMIGRASI] | — |
| `formatProductionHealth()` | [BELUM DIMIGRASI] | — |
| `formatProductionIncidentLine()` | [BELUM DIMIGRASI] | — |
| `formatProductionIncidentDetail()` | [BELUM DIMIGRASI] | — |
| `formatBotMappingList()` | [BELUM DIMIGRASI] | — |
| `formatRouterStatus()` | [BELUM DIMIGRASI] | — |

---

## Urutan Migrasi yang Disarankan (dari paling tidak berisiko)

### Fase 1 — Utility Functions (risiko rendah)
Migrasi fungsi-fungsi utilitas murni yang tidak punya side effect:
1. `nowMs()`, `sleep()`, `cleanupSpaces()`, `escapeRegExp()`, `normalizeId()`, `safeLower()`
2. `splitText()`, `stripCodeFences()`, `extractJsonObject()`, `sanitizeOutgoingText()`
3. `getCommandBase()`, `getCommandArgs()`, `isValidDate()`

**Mengapa aman**: Fungsi murni (pure functions), tidak menyentuh state global.

### Fase 2 — Storage Layer (risiko rendah-sedang)
4. `loadData()` / `saveData()` → ganti dengan `src/storage/json-store.js`
5. `saveAll()` / `persist()` → ganti dengan `src/storage/` manager
6. `initRedis()` / `initStorage()` → ganti dengan `src/storage/storage-manager.js`

**Mengapa**: Storage sudah punya abstraksi yang baik di `src/storage/`.

### Fase 3 — Telegram Messaging (risiko sedang)
7. `safeSendMessage()` → ganti dengan `src/utils/telegram-sender.js`
8. `sendChunkedMessage()`, `sendPhotoUrl()`, `sendPhotoBuffer()`
9. `telegramPost()` → ganti dengan `src/utils/telegram-sender.js`

### Fase 4 — AI Pipeline (risiko sedang)
10. `askMistral()` / `askGroq()` → panggil via `services/ai-router.js`
11. `chooseAIModel()` → ganti dengan `src/model-router/`
12. `askAI()` → ganti dengan `src/bot/response-pipeline.js`

### Fase 5 — Dashboard Helpers (risiko rendah)
13. `getDashboardStatusText()` → ganti dengan `src/dashboard/dashboard-auth.js`
14. `buildDashboardInfoText()` → ganti dengan `src/dashboard/`

### Fase 6 — Command Handlers (risiko tinggi)
15. `handleAiosCommands()` → ganti routing ke `src/ai-os/`
16. `handleObservabilityCommands()` → ganti routing ke `src/observability/`
17. `handleAgentCommands()` → ganti routing ke `src/agents/`
18. `handlePortfolioCommands()` → ganti routing ke `src/portfolio/`
19. `handleResearchCommands()` → ganti routing ke `src/research/`
20. `handleLifeOsCommands()` → ganti routing ke `src/lifeos/`
21. `handleTelegramControlCommands()` → ganti routing ke `src/telegram-control/`

**Mengapa risiko tinggi**: Command handlers adalah entry point utama. Setiap perubahan harus di-test dengan bot nyata.

### Fase 7 — Natural Language Routing (risiko tinggi)
22. `handleNaturalLanguageRoute()` → ganti dengan `src/natural-language/natural-router.js`
23. `universalNLP()` → ganti dengan `src/natural-language/`

### Fase 8 — Bot Lifecycle (risiko tertinggi)
24. `startLegacyBotServer()` → refactor penuh
25. `shutdown()` → pindahkan ke `src/bot/app.js`
26. Hapus `legacy-runtime.js` setelah semua fungsi termigrasi

---

## Catatan Penting

### Fungsi dengan [DUPLIKAT] — perlu konsolidasi
- `initRedis()` / `initStorage()` — logika sama di `src/storage/` dan legacy
- `askAI()` — logika AI pipeline tercerai antara legacy dan `response-pipeline.js`
- `formatDecisionTelegramResult()` — ada di legacy dan `src/governance/`
- Untuk setiap duplikasi, pilih satu versi sebagai canonical dan hapus versi lainnya.

### Modul yang sudah siap dipakai penuh
- `src/telegram-control/` — command registry, intent classifier, permission guard
- `src/agents/` — agent routing, council, delegation, memory
- `src/dashboard/` — auth, guards, serializers
- `src/storage/` — storage manager, json-store
- `src/observability/` — incident detection
- `src/governance/` — permission, risk, approval engine
- `src/model-router/` — provider selection, cost-aware routing

### Modul yang masih perlu integrasi
- Calendar/OAuth — belum ada modul baru
- Image generation/download/processing — belum dimigrasi
- Web search utilities — masih di legacy
- Core command handlers `/ping`, `/reset`, `/settings` — belum dipisah
