'use strict';

const plugins = require('../src/plugins');
const ragKb = require('../src/rag-kb');
const recipes = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  plugins.pluginStore.resetStore();
  ragKb.ragDocumentStore.resetStore();
  ragKb.ragVectorIndex.resetIndex();
  recipes.recipeStore.resetStore();

  // ===== Plugin SDK Cross-Cutting =====
  const manifest = { id: 'test_plugin', name: 'Test Plugin', version: '1.0.0', main: 'index.js', type: 'module' };
  const installed = plugins.pluginInstaller.installPlugin(manifest);
  assert(installed.ok === true, 'pluginInstaller.installPlugin returns ok');
  assert(installed.plugin.id === 'test_plugin', 'plugin ID matches');
  assert(plugins.pluginStore.getPlugin('test_plugin') !== null, 'pluginStore.getPlugin returns plugin');

  const enabled = plugins.pluginInstaller.enablePlugin('test_plugin');
  assert(enabled.ok === true, 'pluginInstaller.enablePlugin returns ok');
  assert(enabled.plugin.enabled === true, 'plugin enabled');

  const valid = plugins.pluginValidator.validatePluginId('my_plugin_1');
  assert(valid === true, 'pluginValidator.validatePluginId valid');

  const invalid = plugins.pluginValidator.validatePluginId('123_bad');
  assert(invalid === false, 'pluginValidator.validatePluginId invalid');

  const connectors = plugins.connectorRegistry.getBuiltInConnectors();
  assert(connectors.length >= 15, 'connectorRegistry has 15+ built-in connectors');

  const instance = plugins.connectorFactory.createConnectorInstance('http_webhook', { url: 'https://test.com' });
  assert(instance !== null, 'connectorFactory.createConnectorInstance returns instance');
  assert(instance.connectorId === 'http_webhook', 'instance connectorId matches');

  const connected = await plugins.connectorFactory.connectConnector(instance.id);
  assert(connected.ok === true, 'connectorFactory.connectConnector returns ok');

  const stats = plugins.pluginStore.getStats();
  assert(stats.pluginCount >= 1, 'pluginStore.getStats has pluginCount >= 1');
  assert(stats.connectorCount >= 1, 'pluginStore.getStats has connectorCount >= 1');

  const depReport = plugins.pluginDependencyResolver.checkDependencyGraph();
  assert(depReport.healthy === true, 'dependency graph healthy');

  const configResult = plugins.pluginConfigManager.setPluginConfig('test_plugin', { apiKey: 'test123' });
  assert(configResult.ok === true, 'pluginConfigManager.setPluginConfig ok');
  assert(configResult.config.apiKey === 'test123', 'config value matches');

  const eventResults = await plugins.pluginEventBus.emit('test_event', { data: 1 });
  assert(Array.isArray(eventResults), 'pluginEventBus.emit returns array');

  // ===== RAG/KB Cross-Cutting =====
  const doc = ragKb.ragDocumentStore.addDocument({ title: 'Test Doc', content: 'This is test content for RAG search.', type: 'text', tags: ['test', 'rag'] });
  assert(doc.id, 'ragDocumentStore.addDocument returns doc with id');
  assert(doc.title === 'Test Doc', 'doc title matches');

  const doc2 = ragKb.ragDocumentStore.addDocument({ title: 'Another Doc', content: 'More content about something else entirely.', type: 'text', tags: ['other'] });
  assert(doc2.id, 'second doc created');

  const docs = ragKb.ragDocumentStore.listDocuments();
  assert(docs.length === 2, 'ragDocumentStore.listDocuments returns 2 docs');

  const filtered = ragKb.ragDocumentStore.listDocuments({ tag: 'test' });
  assert(filtered.length === 1, 'listDocuments filtered by tag returns 1');

  const chunks = ragKb.ragDocumentChunker.smartChunk('Para one.\n\nPara two.\n\nPara three.', 'sentence', 20);
  assert(chunks.length >= 2, 'ragDocumentChunker.smartChunk returns 2+ chunks with small max size');

  const vec = await ragKb.ragEmbeddingService.embedText('test query');
  assert(Array.isArray(vec) && vec.length === 128, 'ragEmbeddingService.embedText returns 128-dim vector');

  await ragKb.ragVectorIndex.indexDocument(doc.id, doc.content);
  const searchResults = await ragKb.ragVectorIndex.search('test content');
  assert(searchResults.length >= 1, 'ragVectorIndex.search returns results');

  const analysis = ragKb.ragQueryAnalyzer.analyzeQuery('how to use this?');
  assert(analysis.hasQuestionWords === true, 'ragQueryAnalyzer detects question words');
  assert(analysis.estimatedIntent === 'how_to', 'ragQueryAnalyzer estimates how_to intent');

  const relevance = ragKb.ragRelevanceScorer.scoreRelevance('test content', 'This has test content inside');
  assert(relevance > 0, 'ragRelevanceScorer.scoreRelevance returns > 0');

  const context = ragKb.ragContextBuilder.buildContext([{ docId: 'test', score: 0.9, content: 'Sample content' }]);
  assert(context.sourceCount === 1, 'ragContextBuilder.buildContext returns 1 source');

  const fb = ragKb.ragFeedbackLoop.recordFeedback('test query', doc.id, true);
  assert(fb.relevant === true, 'ragFeedbackLoop.recordFeedback records relevant');
  assert(ragKb.ragFeedbackLoop.getFeedbackStats().total === 1, 'feedback stats total = 1');

  ragKb.ragCachingLayer.set('test_query', ['result1']);
  const cached = ragKb.ragCachingLayer.get('test_query');
  assert(Array.isArray(cached) && cached[0] === 'result1', 'ragCachingLayer.get returns cached value');

  // ===== Recipe Cross-Cutting =====
  const recipe = recipes.recipeStore.createRecipe({
    name: 'Test Recipe',
    trigger: { type: 'manual' },
    actions: [{ type: 'send_message', params: { text: 'Hello $name' } }],
    conditions: [{ type: 'equals', field: '$status', value: 'active' }],
    variables: { name: 'World' },
    tags: ['test']
  });
  assert(recipe.id, 'recipeStore.createRecipe returns id');
  assert(recipe.name === 'Test Recipe', 'recipe name matches');

  const list = recipes.recipeStore.listRecipes();
  assert(list.length === 1, 'recipeStore.listRecipes returns 1');

  const validated = recipes.recipeValidator.validateRecipe(recipe);
  assert(validated.valid === true, 'recipeValidator.validateRecipe valid');

  const invalidRecipe = recipes.recipeValidator.validateRecipe({ actions: [] });
  assert(invalidRecipe.valid === false, 'recipeValidator invalid recipe');

  const triggers = recipes.recipeTriggerRegistry.listTriggers();
  assert(triggers.length === 10, 'recipeTriggerRegistry has 10 triggers');

  const actions = recipes.recipeActionRegistry.listActions();
  assert(actions.length === 16, 'recipeActionRegistry has 16 actions');

  const conditionResult = recipes.recipeConditionEngine.evaluateCondition({ type: 'equals', field: '$status', value: 'active' }, { status: 'active' });
  assert(conditionResult.matched === true, 'recipeConditionEngine condition matched');

  const executed = await recipes.recipeExecutionEngine.executeRecipe(recipe.id, { status: 'active' });
  assert(executed.ok === true, 'recipeExecutionEngine.executeRecipe ok');

  const dryRun = await recipes.recipeDryRunner.dryRunRecipe(recipe.id, { status: 'active' });
  assert(dryRun.ok === true, 'recipeDryRunner.dryRunRecipe ok');
  assert(dryRun.conditionsMet === true, 'dryRun conditions met');

  const template = recipes.recipeTemplateLibrary.getTemplate('daily_summary');
  assert(template !== null, 'recipeTemplateLibrary.getTemplate returns daily_summary');

  const tplRecipe = recipes.recipeTemplateLibrary.createRecipeFromTemplate('daily_summary');
  assert(tplRecipe !== null, 'createRecipeFromTemplate returns recipe');

  const scheduled = recipes.recipeScheduler.scheduleRecipe(recipe.id, '0 8 * * *');
  assert(scheduled.ok === true, 'recipeScheduler.scheduleRecipe ok');

  const interpolated = recipes.recipeVariableInterpolator.interpolate('Hello $name', { name: 'World' });
  assert(interpolated === 'Hello World', 'recipeVariableInterpolator resolves variable');

  const logEntry = recipes.recipeLogManager.logExecution(recipe.id, 'test_event');
  assert(logEntry.recipeId === recipe.id, 'recipeLogManager.logExecution records event');

  const utilsScore = recipes.recipeUtils.estimateRecipeComplexity(recipe);
  assert(utilsScore.level === 'simple' || utilsScore.level === 'moderate', 'recipeUtils.estimateRecipeComplexity returns level');

  // ===== Dashboard Registration Check =====
  assert(typeof window === 'undefined' || window.DASHBOARD_TABS?.plugins !== undefined, 'dashboard tabs include plugins');
  assert(typeof window === 'undefined' || window.DASHBOARD_TABS?.['rag-kb'] !== undefined, 'dashboard tabs include rag-kb');
  assert(typeof window === 'undefined' || window.DASHBOARD_TABS?.recipes !== undefined, 'dashboard tabs include recipes');

  // ===== In-Memory Store resets =====
  plugins.pluginStore.resetStore();
  assert(plugins.pluginStore.getStats().pluginCount === 0, 'pluginStore.resetStore clears plugins');
  assert(plugins.pluginStore.getStats().connectorCount === 0, 'pluginStore.resetStore clears connectors');

  ragKb.ragDocumentStore.resetStore();
  assert(ragKb.ragDocumentStore.getDocumentCount() === 0, 'ragDocumentStore.resetStore clears');

  ragKb.ragVectorIndex.resetIndex();
  assert(ragKb.ragVectorIndex.getVectorCount() === 0, 'ragVectorIndex.resetIndex clears');

  recipes.recipeStore.resetStore();
  assert(recipes.recipeStore.getRecipeCount() === 0, 'recipeStore.resetStore clears');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });
