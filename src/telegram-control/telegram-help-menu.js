'use strict';

const registry = require('./telegram-command-registry');
const utils = require('./telegram-utils');

function buildTelegramMainMenu() {
  const categories = registry.getCategories();
  const lines = [
    '🤖 *Telegram AI OS — Menu Utama*\n',
    'Gunakan /help <kategori> untuk detail.',
    'Contoh: /help deploy, /help lifeos\n'
  ];

  for (const cat of categories) {
    if (cat.count > 0) {
      lines.push(`▸ *${cat.label}* — ${cat.count} perintah`);
    }
  }

  lines.push('\n_Gunakan /menu untuk menu ini._');
  lines.push('_Gunakan /help <nama> untuk bantuan perintah spesifik._');

  return lines.join('\n');
}

function buildTelegramCategoryMenu(category) {
  const cmds = registry.listTelegramCommands({ category, enabled: true });
  if (!cmds || cmds.length === 0) {
    return `Tidak ada perintah dalam kategori *${category}*.`;
  }

  const catLabel = registry.COMMAND_CATEGORIES[category] || category;
  const riskEmoji = { read_only: '📖', low: '🟢', medium: '🟡', high: '🟠', danger: '🔴' };

  const lines = [`📂 *${catLabel}* — ${cmds.length} perintah\n`];
  for (const cmd of cmds) {
    const aliasText = cmd.aliases && cmd.aliases.length > 0 ? ` (${cmd.aliases.slice(0, 3).join(', ')})` : '';
    const riskIcon = riskEmoji[cmd.riskLevel] || '';
    const ownerOnly = cmd.requiresOwner ? '👑' : '';
    lines.push(`${riskIcon} \`/${cmd.name}\`${aliasText} ${ownerOnly}`);
    lines.push(`   ${cmd.description || 'Tidak ada deskripsi'}`);
  }

  lines.push('\n_Gunakan /help <nama> untuk detail perintah._');
  return lines.join('\n');
}

function buildTelegramCommandHelp(commandName) {
  const cmd = registry.getTelegramCommand(commandName);
  if (!cmd) {
    const suggestions = searchTelegramHelp(commandName);
    if (suggestions && suggestions.length > 0) {
      return `Perintah \`/${commandName}\` tidak ditemukan.\nMungkin maksud Anda:\n${suggestions.map(s => `• /${s.name} — ${s.description}`).join('\n')}`;
    }
    return `Perintah \`/${commandName}\` tidak ditemukan. Gunakan /menu untuk melihat semua perintah.`;
  }

  const riskEmoji = { read_only: '📖', low: '🟢', medium: '🟡', high: '🟠', danger: '🔴' };
  const catLabel = registry.COMMAND_CATEGORIES[cmd.category] || cmd.category;

  const lines = [
    `📖 *Bantuan: /${cmd.name}*`,
    ``,
    `Deskripsi: ${cmd.description}`,
    `Kategori: ${catLabel}`,
    `Modul: ${cmd.module}`,
    `Tingkat Risiko: ${riskEmoji[cmd.riskLevel]} ${cmd.riskLevel}`,
    `Status: ${cmd.enabled ? '✅ Aktif' : '❌ Nonaktif'}`
  ];

  if (cmd.aliases && cmd.aliases.length > 0) {
    const aliasList = cmd.aliases.map(function(a) { return '/' + a; }).join(', ');
    lines.push('Alias: ' + aliasList);
  }

  if (cmd.examples && cmd.examples.length > 0) {
    const exampleList = cmd.examples.map(function(e) { return '  ' + e; }).join('\n');
    lines.push('\nContoh:\n' + exampleList);
  }

  if (cmd.requiresOwner) {
    lines.push('\n👑 *Hanya pemilik*');
  } else if (cmd.requiresAdmin) {
    lines.push('\n🛡️ *Hanya admin*');
  }

  if (cmd.requiresApproval) {
    lines.push('\n⚠️ *Memerlukan persetujuan* — buat proposal terlebih dahulu');
  }
  if (cmd.requiresEvaluation) {
    lines.push('🔬 *Memerlukan Evaluation v2*');
  }

  return lines.join('\n');
}

function searchTelegramHelp(query) {
  if (!query) return [];
  const results = registry.listTelegramCommands({ search: query, enabled: true });
  return results.slice(0, 8);
}

function suggestTelegramCommands(intent) {
  if (!intent) return [];
  const cmd = registry.findTelegramCommandByIntent(intent);
  if (cmd) return [cmd];
  return [];
}

module.exports = {
  buildTelegramMainMenu,
  buildTelegramCategoryMenu,
  buildTelegramCommandHelp,
  searchTelegramHelp,
  suggestTelegramCommands
};
