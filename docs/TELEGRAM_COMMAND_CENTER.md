# Telegram Command Center (Phase T2)

## Goal
Pusat kontrol utama lewat Telegram, user tidak wajib dashboard.

## Commands
- /menu — Menu utama dengan inline keyboard
- /status — Status bot dan sistem
- /project — Ringkasan project
- /coding — Workspace coding
- /agents — Daftar agent
- /memory — Status memori/RAG
- /workflow — Workflow
- /devices — Perangkat
- /approval — Proposal pending
- /settings — Pengaturan
- /help — Bantuan

## Modules
### telegram-command-center.js
Command handler untuk semua menu command.

### telegram-menu-registry.js
Registrasi menu item dengan metadata (id, title, command, riskLevel, dll).

### telegram-menu-renderer.js
Render setiap menu dengan template dan keyboard.

### telegram-callback-router.js
Route callback dari inline button ke handler.

### telegram-session-state.js
Session state per user dengan TTL 30 menit.
