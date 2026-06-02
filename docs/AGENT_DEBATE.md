# Agent Debate

Agent Debate adalah mode council eksplisit untuk membandingkan opsi secara ringkas. Phase 22 sengaja menjaga debate satu ronde agar hemat dan tidak membuat Telegram ramai.

## Flow

```text
topic
-> opening positions
-> cross-agent critique
-> revision summary
-> decision synthesis
-> final recommendation
```

Tidak ada hidden chain-of-thought yang dibuka. Bot hanya menyimpan summary aman.

## Agent Default

- Planner memberi rencana atau opsi maju.
- Critic mencari blind spot dan risiko.
- Coder ikut jika topik teknis.
- Security ikut jika ada restore/import/secret/action.
- Orchestrator menyatukan keputusan.

## Command

```text
/debate <topic>
```

Contoh:

```text
/debate lebih baik mulai 10 bot atau 4 dulu?
```

Expected:

- rekomendasi bertahap
- risiko spam/debugging disebut
- next step jelas

## Batasan

- Tidak menjalankan action.
- Tidak memanggil shell.
- Tidak membuat proposal executor otomatis kecuali flow lain memintanya.
- Debate disimpan sebagai sanitized session/summary saja.
