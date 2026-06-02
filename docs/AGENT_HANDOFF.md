# Agent Handoff

Agent handoff memungkinkan sebuah task dipindahkan ke agent yang lebih cocok jika assignment awal kurang tepat.

## Kapan Handoff Terjadi

Handoff bisa disarankan saat:

- task coding ternyata lebih dominan deploy atau ops;
- task planning ternyata mengandung restore/import/security risk;
- task memory ternyata perlu graph/context review;
- agent target confidence rendah.

## Batasan

- Max handoff depth default `2`.
- Handoff loop dicegah.
- Handoff tidak menjalankan task otomatis.
- Accept/reject handoff dicatat di audit.

## Command

```text
/handoffs
/handoff <taskId> | <targetAgentId>
```

Jika `targetAgentId` kosong, sistem mencoba memilih target terbaik dari isi task.

## Safety

Handoff hanya mengubah assignment task. Aksi write, restore, import, tool run, dan external action tetap harus lewat executor approval.
