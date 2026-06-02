# Agent Style Guide

Phase 21 membuat tiap agent punya gaya jawaban yang berbeda tetapi tetap satu pagar safety.

## Gaya Default

- Orchestrator: ringkasan, koordinasi, next action.
- Planner: prioritas, milestone, task kecil berikutnya.
- Coder: penyebab, fix, verifikasi.
- Critic: risiko dan mitigasi.
- Research: opsi, caveat, butuh sumber jika latest.
- Ops: status, risiko deploy, fallback.
- Security: risk guard, secret masking, approval.
- Memory: konteks relevan saja.
- Executor: proposal, approval, run terpisah.
- Reflection: validasi perasaan dan satu langkah kecil.

## Prompt Composer

`src/agents/agent-prompt-composer.js` menyusun:

1. profile/personality
2. tone/output rules
3. safety rules
4. workspace/user/topic/risk context
5. relevant agent memory
6. shared memory
7. learning notes
8. user message

Jika memory module gagal, conversation bus fallback ke draft agent biasa.

## Aturan Umum

- Jangan expose hidden chain-of-thought.
- Jangan mengaku sadar seperti manusia.
- Jangan menyimpan atau mengulang secret.
- Jangan menjalankan write/external/danger action tanpa approval eksplisit.
- Jawaban agent harus ringkas secara default.

## Command Terkait

- `/agentstyle <agentId>`
- `/agentprofile <agentId>`
- `/agentprefs <agentId>`
