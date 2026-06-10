'use strict';

const utils = require('./module-boundary-utils');

function scanImportRequirePatterns(services) {
  const fs = require('fs');
  const path = require('path');
  const srcDir = path.join(__dirname, '..');
  const results = [];
  try {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.js')) {
        const content = fs.readFileSync(path.join(srcDir, entry.name), 'utf8');
        const requires = [];
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = requireRegex.exec(content)) !== null) {
          requires.push({ file: entry.name, requirePath: match[1], line: content.substring(0, match.index).split('\n').length });
        }
        if (requires.length > 0) results.push(...requires);
      }
    }
  } catch (e) {
    return [];
  }
  return results;
}

function detectMissingFilesReferencedByRequire(services) {
  const fs = require('fs');
  const path = require('path');
  const patterns = scanImportRequirePatterns(services);
  const missing = [];
  for (const p of patterns) {
    const resolved = p.requirePath.startsWith('.') ? path.resolve(path.join(__dirname, '..', p.requirePath)) : null;
    if (resolved && !resolved.endsWith('.js')) {
      const withJs = resolved + '.js';
      if (!fs.existsSync(withJs)) {
        missing.push({ file: p.file, requirePath: p.requirePath, line: p.line, issue: 'referenced file not found' });
      }
    } else if (resolved && !fs.existsSync(resolved)) {
      missing.push({ file: p.file, requirePath: p.requirePath, line: p.line, issue: 'referenced file not found' });
    }
  }
  return missing;
}

function detectUnsafeTopLevelSideEffects(services) {
  const fs = require('fs');
  const path = require('path');
  const srcDir = path.join(__dirname, '..');
  const unsafe = [];
  try {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.js')) {
        const content = fs.readFileSync(path.join(srcDir, entry.name), 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < Math.min(lines.length, 20); i++) {
          const trimmed = lines[i].trim();
          if (trimmed.startsWith('process.env') || trimmed.startsWith('process.exit') || trimmed.startsWith('fs.write') || trimmed.startsWith('fs.append')) {
            if (!trimmed.startsWith('//') && !trimmed.startsWith('*')) {
              unsafe.push({ file: entry.name, line: i + 1, code: trimmed.substring(0, 80), issue: 'potential top-level side effect' });
            }
          }
        }
      }
    }
  } catch (e) {
    return [];
  }
  return unsafe;
}

function detectOptionalModuleWithoutGuard(services) {
  const results = [];
  const patterns = scanImportRequirePatterns(services);
  const optionalModules = ['react', 'express', 'socket.io', 'graphql', 'dockerode', 'aws-sdk', '@azure/identity'];
  for (const p of patterns) {
    if (optionalModules.includes(p.requirePath)) {
      results.push({ file: p.file, requirePath: p.requirePath, line: p.line, issue: 'optional module required without guard' });
    }
  }
  return results;
}

function buildImportGuardReport(services) {
  const missing = detectMissingFilesReferencedByRequire(services);
  const sideEffects = detectUnsafeTopLevelSideEffects(services);
  const optionalWithoutGuard = detectOptionalModuleWithoutGuard(services);
  return {
    totalIssues: missing.length + sideEffects.length + optionalWithoutGuard.length,
    missingFiles: missing,
    unsafeTopLevelSideEffects: sideEffects,
    optionalWithoutGuard
  };
}

module.exports = {
  scanImportRequirePatterns,
  detectMissingFilesReferencedByRequire,
  detectUnsafeTopLevelSideEffects,
  detectOptionalModuleWithoutGuard,
  buildImportGuardReport
};
