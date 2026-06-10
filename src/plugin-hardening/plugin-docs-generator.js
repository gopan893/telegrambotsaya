'use strict';

function generatePluginDocs(manifest, metadata) {
  if (!manifest) return { error: 'No manifest provided' };
  const docs = {
    pluginId: manifest.id,
    name: manifest.name,
    version: manifest.version,
    type: manifest.type || 'module',
    description: manifest.description || 'No description provided',
    author: manifest.author || 'Unknown',
    sections: []
  };

  docs.sections.push(generateOverviewSection(manifest));
  docs.sections.push(generateInstallationSection(manifest));
  docs.sections.push(generateConfigurationSection(manifest, metadata));
  docs.sections.push(generatePermissionsSection(manifest));
  docs.sections.push(generateConnectorsSection(manifest));
  docs.sections.push(generateChangelogSection(manifest));

  return docs;
}

function generateOverviewSection(manifest) {
  return {
    title: 'Overview',
    content: [
      'Plugin: ' + manifest.name,
      'Version: ' + manifest.version,
      'Type: ' + (manifest.type || 'module'),
      'Description: ' + (manifest.description || 'No description'),
      manifest.author ? 'Author: ' + manifest.author : '',
      manifest.license ? 'License: ' + manifest.license : ''
    ].filter(Boolean).join('\n')
  };
}

function generateInstallationSection(manifest) {
  const steps = ['Install the plugin via the plugin manager.'];
  if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
    steps.push('Required dependencies: ' + Object.entries(manifest.dependencies).map(([k, v]) => k + '@' + v).join(', '));
  }
  steps.push('Enable the plugin after installation.');
  return {
    title: 'Installation',
    content: steps.join('\n')
  };
}

function generateConfigurationSection(manifest, metadata) {
  const config = manifest.config || {};
  const fields = Object.entries(config).map(([key, rules]) => {
    const parts = ['  ' + key + ':'];
    if (rules.type) parts.push('Type: ' + rules.type);
    if (rules.required) parts.push('(required)');
    if (rules.default !== undefined) parts.push('Default: ' + rules.default);
    if (rules.description) parts.push(rules.description);
    return parts.join(' ');
  });

  return {
    title: 'Configuration',
    content: fields.length > 0 ? fields.join('\n') : 'No configuration required.'
  };
}

function generatePermissionsSection(manifest) {
  const perms = manifest.permissions || [];
  if (perms.length === 0) return { title: 'Permissions', content: 'No special permissions required.' };

  const categorized = { read: [], write: [], admin: [], other: [] };
  for (const perm of perms) {
    if (perm.includes('read')) categorized.read.push(perm);
    else if (perm.includes('write')) categorized.write.push(perm);
    else if (perm.includes('admin')) categorized.admin.push(perm);
    else categorized.other.push(perm);
  }

  const lines = [];
  if (categorized.read.length) lines.push('Read: ' + categorized.read.join(', '));
  if (categorized.write.length) lines.push('Write: ' + categorized.write.join(', '));
  if (categorized.admin.length) lines.push('Admin: ' + categorized.admin.join(', '));
  if (categorized.other.length) lines.push('Other: ' + categorized.other.join(', '));

  return { title: 'Permissions', content: lines.join('\n') };
}

function generateConnectorsSection(manifest) {
  const connectors = manifest.connectors || [];
  if (connectors.length === 0) return { title: 'Connectors', content: 'No connectors required.' };
  const lines = connectors.map(c => {
    const id = typeof c === 'string' ? c : c.id;
    const type = typeof c === 'object' ? c.type : '';
    return '  - ' + id + (type ? ' (' + type + ')' : '');
  });
  return { title: 'Connectors', content: lines.join('\n') };
}

function generateChangelogSection(manifest) {
  const changelog = manifest.changelog || [];
  if (changelog.length === 0) return { title: 'Changelog', content: 'No changelog available.' };
  const lines = changelog.map(entry => {
    const version = entry.version || '';
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    return version + ':\n' + changes.map(c => '  - ' + c).join('\n');
  });
  return { title: 'Changelog', content: lines.join('\n') };
}

function generateMarkdownDocs(docs) {
  if (!docs || docs.error) return '# Plugin Documentation\n\nError: ' + (docs && docs.error ? docs.error : 'No data');
  const lines = ['# ' + docs.name + ' (v' + docs.version + ')', ''];
  for (const section of docs.sections) {
    lines.push('## ' + section.title, '', section.content, '');
  }
  return lines.join('\n');
}

function generateQuickRef(manifest) {
  if (!manifest) return '';
  return [
    manifest.name + ' v' + manifest.version,
    'Type: ' + (manifest.type || 'module'),
    'Permissions: ' + (manifest.permissions || []).length,
    'Connectors: ' + (manifest.connectors || []).length
  ].join(' | ');
}

module.exports = {
  generatePluginDocs, generateMarkdownDocs, generateQuickRef,
  generateOverviewSection, generateInstallationSection, generateConfigurationSection,
  generatePermissionsSection, generateConnectorsSection, generateChangelogSection
};
