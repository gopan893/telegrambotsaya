'use strict';

const gen = require('../src/research/research-prompt-generator');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

const codex = gen.generateCodexPromptFromResearch('task1');
assert(codex.target === 'Codex', 'codex prompt target');
assert(codex.prompt, 'codex prompt has content');

const opencode = gen.generateOpenCodePromptFromResearch('task1');
assert(opencode.target === 'OpenCode', 'opencode prompt target');

const hermes = gen.generateHermesPromptFromResearch('task1');
assert(hermes.target === 'Hermes', 'hermes prompt target');

const security = gen.generateSecurityReviewPromptFromResearch('task1');
assert(security.target === 'Security', 'security prompt target');

const docs = gen.generateDocsUpdatePromptFromResearch('task1');
assert(docs.target === 'Docs', 'docs prompt target');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
