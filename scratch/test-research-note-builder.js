'use strict';

const noteBuilder = require('../src/research/research-note-builder');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

const sources = [{ id: 'src1', title: 'Test Source', notes: 'some notes', trustLevel: 'high', freshness: 'medium' }];
const notes = noteBuilder.createResearchNotes('task1', sources);
assert(notes.taskId === 'task1', 'createResearchNotes has taskId');
assert(notes.notes.length === 1, 'createResearchNotes has 1 note');
assert(notes.notes[0].keyFacts.length > 0, 'extractKeyFacts returns facts');

const summary = noteBuilder.summarizeSourceNotes(notes.notes);
assert(summary.length > 0, 'summarizeSourceNotes returns non-empty');

const constraints = noteBuilder.extractImplementationConstraints(sources[0]);
assert(Array.isArray(constraints), 'extractImplementationConstraints returns array');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
