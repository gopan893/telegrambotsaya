'use strict';

const recipes = require('../recipes');

function registerRecipeRoutes(router, services = {}) {
  router.get('/recipes', async (req, res) => {
    try {
      res.json({ ok: true, status: 'Recipe Builder routes active', endpoints: ['list', 'triggers', 'actions', 'templates', 'run', 'dry-run', 'logs', 'schedule'] });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/recipes/list', async (req, res) => {
    try {
      const recipeList = recipes.recipeStore.listRecipes(req.query);
      res.json({ ok: true, recipes: recipeList, count: recipeList.length, total: recipes.recipeStore.getRecipeCount() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/recipes/create', async (req, res) => {
    try {
      const validation = recipes.recipeValidator.validateRecipe(req.body);
      if (!validation.valid) return res.status(400).json({ ok: false, errors: validation.errors });
      const recipe = recipes.recipeStore.createRecipe(req.body);
      res.json({ ok: true, recipe });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/recipes/update', async (req, res) => {
    try {
      const updated = recipes.recipeStore.updateRecipe(req.body?.id, req.body?.updates || {});
      if (!updated) return res.status(404).json({ ok: false, error: 'Recipe not found' });
      res.json({ ok: true, recipe: updated });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/recipes/:id', async (req, res) => {
    try {
      const removed = recipes.recipeStore.removeRecipe(req.params.id);
      res.json({ ok: removed });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/recipes/:id/toggle', async (req, res) => {
    try {
      const recipe = recipes.recipeStore.getRecipe(req.params.id);
      if (!recipe) return res.status(404).json({ ok: false, error: 'Recipe not found' });
      const updated = recipes.recipeStore.updateRecipe(req.params.id, { enabled: !recipe.enabled });
      res.json({ ok: true, recipe: updated });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/recipes/triggers', async (req, res) => {
    try {
      const triggers = recipes.recipeTriggerRegistry.listTriggers(req.query?.category);
      const categories = recipes.recipeTriggerRegistry.listTriggerCategories();
      res.json({ ok: true, triggers, categories });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/recipes/actions', async (req, res) => {
    try {
      const actions = recipes.recipeActionRegistry.listActions(req.query?.category);
      const categories = recipes.recipeActionRegistry.listActionCategories();
      res.json({ ok: true, actions, categories });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/recipes/templates', async (req, res) => {
    try {
      const templates = recipes.recipeTemplateLibrary.listTemplates(req.query?.tag);
      res.json({ ok: true, templates });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/recipes/templates/apply', async (req, res) => {
    try {
      const recipe = recipes.recipeTemplateLibrary.createRecipeFromTemplate(req.body?.templateId, req.body?.overrides || {});
      if (!recipe) return res.status(404).json({ ok: false, error: 'Template not found' });
      res.json({ ok: true, recipe });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/recipes/run', async (req, res) => {
    try {
      const result = await recipes.recipeExecutionEngine.executeRecipe(req.body?.recipeId, req.body?.context || {});
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/recipes/dry-run', async (req, res) => {
    try {
      const result = await recipes.recipeDryRunner.dryRunRecipe(req.body?.recipeId, req.body?.context || {});
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/recipes/logs', async (req, res) => {
    try {
      const recipeLogs = recipes.recipeLogManager.getAllLogs(Number(req.query?.limit) || 100);
      const stats = recipes.recipeLogManager.getLogStats();
      res.json({ ok: true, logs: recipeLogs, stats });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/recipes/schedule', async (req, res) => {
    try {
      const result = recipes.recipeScheduler.scheduleRecipe(req.body?.recipeId, req.body?.cron);
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/recipes/schedules', async (req, res) => {
    try {
      const schedules = recipes.recipeScheduler.getScheduledRecipes();
      res.json({ ok: true, schedules });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/recipes/schedules/pause', async (req, res) => {
    try {
      const ok = recipes.recipeScheduler.pauseSchedule(req.body?.scheduleId);
      res.json({ ok });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/recipes/schedules/resume', async (req, res) => {
    try {
      const ok = recipes.recipeScheduler.resumeSchedule(req.body?.scheduleId);
      res.json({ ok });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerRecipeRoutes };
