# Telegram UX Stabilization (Phase T1)

## Goal
Membuat jawaban Telegram rapi, aman, tidak terpotong, enak dibaca, dan tidak crash karena format Markdown/HTML.

## Modules

### src/telegram-ux/telegram-message-renderer.js
- `renderTelegramReply(input, options)` — Render jawaban normal
- `renderShortAnswer(input, options)` — Jawaban pendek (max 500 chars)
- `renderDetailedAnswer(input, options)` — Jawaban detail dengan split
- `renderActionSummary(input, options)` — Ringkasan aksi
- `renderSafeError(error, options)` — Error aman tanpa stack trace
- `renderDegradedNotice(message, options)` — Modul tidak tersedia
- `renderProposalSummary(proposal, options)` — Proposal dengan tombol approval
- `renderStatusCard(status, options)` — Kartu status

### src/telegram-ux/telegram-message-splitter.js
- `splitTelegramMessage(text, options)` — Split pesan panjang
- `splitByParagraph(text, maxLength)` — Split di batas paragraf
- `splitCodeBlockSafely(text, maxLength)` — Split tanpa merusak code block
- `addPartHeaders(parts)` — Tambah header "Bagian 1/3"
- `validateTelegramMessageLength(parts)` — Validasi panjang

### src/telegram-ux/telegram-markdown-sanitizer.js
- Sanitasi Markdown/HTML untuk Telegram
- Redaksi secret/token
- Deteksi risiko formatting

### src/telegram-ux/telegram-code-block-formatter.js
- Format code block dengan bahasa
- Trim code block terlalu besar
- Redaksi secret dalam code

### src/telegram-ux/telegram-reply-template.js
Templates: normal_chat, coding_answer, project_status, task_plan, test_plan, risk_review, security_warning, privacy_warning, approval_required, proposal_created, workflow_draft, device_status, degraded_module, unknown_command_help, error_safe

### src/telegram-ux/telegram-inline-keyboard-builder.js
- `buildMainMenuKeyboard()` — Menu utama
- `buildCodingKeyboard()` — Menu coding
- `buildApprovalKeyboard(proposalId)` — Tombol approval
- `buildDeviceKeyboard(deviceId)` — Tombol device
- `buildSafeBackKeyboard()` — Tombol back

### src/telegram-ux/telegram-error-presenter.js
Presentasi error aman tanpa stack trace/secret.

### src/telegram-ux/telegram-progress-presenter.js
Progress message dengan update/edit support.
