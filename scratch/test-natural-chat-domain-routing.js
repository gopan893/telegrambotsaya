'use strict';

const assert = require('assert');
const router = require('../src/agents/agent-router');
const renderer = require('../src/agents/agent-response-renderer');

function route(text, context = {}) {
  return router.routeMessage(text, {
    groupSettings: { mode: 'natural_smart', maxAutoAgents: 5 },
    ...context
  }, {});
}

const teacher = route('Bagaimana caranya menghadapi guru yang sedang marah besar?');
assert(teacher.topics.includes('school_life'), 'teacher question should be school_life');
assert(teacher.topics.includes('social_advice'), 'teacher question should be social_advice');
assert(teacher.selectedAgents.includes('orchestrator'), 'orchestrator should be selected');
assert(teacher.selectedAgents.includes('reflection'), 'reflection should be selected');
assert(!teacher.selectedAgents.includes('coder'), 'coder must not be selected for teacher advice');
assert(!teacher.selectedAgents.includes('ops'), 'ops must not be selected for teacher advice');
assert.equal(teacher.policy.mode, 'emotional_support');

const answer = renderer.renderNaturalSmartReply({}, teacher, [], {
  text: 'Bagaimana caranya menghadapi guru yang sedang marah besar?',
  topics: teacher.topics,
  route: teacher
});
assert(/tenang/i.test(answer), 'teacher advice should mention calmness');
assert(/minta maaf/i.test(answer), 'teacher advice should mention apology');
assert(/dengarkan/i.test(answer), 'teacher advice should mention listening');
assert(!/Python|regresi|deploy|debug|stack trace/i.test(answer), 'teacher advice must not leak technical template');

const late = route('Pagi ini aku telat sekolah dan nanti dimarahin guru');
assert(late.selectedAgents.includes('reflection'), 'school lateness should select reflection');
assert(!late.selectedAgents.includes('coder'), 'school lateness must not select coder');

const python = route('Bot saya error Python');
assert(python.topics.includes('coding'), 'Python error should remain coding');
assert(python.selectedAgents.includes('coder'), 'Python error should select coder');

console.log('test-natural-chat-domain-routing: ok');
