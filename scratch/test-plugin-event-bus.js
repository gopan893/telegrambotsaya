'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  plugins.pluginEventBus.clearAll();

  // Initial state
  assert(plugins.pluginEventBus.listActiveEvents().length === 0, 'no active events initially');

  // Register listeners
  const results = [];
  const handler1 = (data) => { results.push('h1:' + data.payload.msg); };
  const handler2 = (data) => { results.push('h2:' + data.payload.msg); };

  const unsub1 = plugins.pluginEventBus.on('test:event', handler1, 'plugin_a');
  assert(typeof unsub1 === 'function', 'on returns unsubscribe function');
  plugins.pluginEventBus.on('test:event', handler2, 'plugin_b');

  assert(plugins.pluginEventBus.getListenerCount('test:event') === 2, 'listener count 2 after registering');
  assert(plugins.pluginEventBus.getListenerCount('nonexistent') === 0, 'listener count 0 for unknown event');

  // Emit
  const emitResults = await plugins.pluginEventBus.emit('test:event', { msg: 'hello' });
  assert(emitResults.length === 2, 'emit returns 2 results');
  assert(emitResults[0].ok === true, 'first handler ok');
  assert(emitResults[0].pluginId === 'plugin_a', 'first handler pluginId');
  assert(results.includes('h1:hello'), 'handler1 received data');
  assert(results.includes('h2:hello'), 'handler2 received data');

  // listActiveEvents
  const events = plugins.pluginEventBus.listActiveEvents();
  assert(events.length === 1, '1 active event');
  assert(events[0] === 'test:event', 'active event name');

  // off - remove handler1
  plugins.pluginEventBus.off('test:event', handler1);
  assert(plugins.pluginEventBus.getListenerCount('test:event') === 1, 'listener count 1 after off');

  // unsubscribe via returned function
  unsub1(); // remove handler1 again (no-op)
  assert(plugins.pluginEventBus.getListenerCount('test:event') === 1, 'unsub1 no-op since already removed');

  // Emit after handler removal
  const results2 = [];
  const handler3 = (data) => { results2.push('h3:' + data.payload.msg); };
  plugins.pluginEventBus.on('another:event', handler3);
  const emit2 = await plugins.pluginEventBus.emit('another:event', { msg: 'world' });
  assert(emit2.length === 1, 'emit on another:event returns 1');
  assert(results2.includes('h3:world'), 'handler3 called');

  // Handler throwing error
  plugins.pluginEventBus.on('error:event', () => { throw new Error('oops'); });
  const emitError = await plugins.pluginEventBus.emit('error:event', {});
  assert(emitError.length === 1, 'error handler result returned');
  assert(emitError[0].ok === false, 'error handler fails');
  assert(emitError[0].error === 'oops', 'error message captured');

  // clearAll
  plugins.pluginEventBus.clearAll();
  assert(plugins.pluginEventBus.listActiveEvents().length === 0, 'no events after clearAll');
  assert(plugins.pluginEventBus.getListenerCount('test:event') === 0, 'listener count 0 after clearAll');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
